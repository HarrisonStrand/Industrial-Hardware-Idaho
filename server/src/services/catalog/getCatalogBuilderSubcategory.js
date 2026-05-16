import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import CatalogFamilyAsset from "../../models/CatalogFamilyAsset.js";
import {
	resolveProductPrice,
	getPricingContext,
	getPricingSettings,
} from "../../utils/resolveProductPrice.js";

function toTitle(value = "") {
	return String(value || "")
		.replace(/[-_]/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeSlug(value = "") {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/-/g, " ");
}


function normalizeBuilderDiameter(
	diameter = "",
	threadPitch = "",
	measurementSystem = "",
) {
	const system = String(measurementSystem || "").trim().toLowerCase();
	const rawDiameter = String(diameter || "").trim();
	const rawPitch = String(threadPitch || "").trim();
	if (!rawDiameter) return rawDiameter;

	if (system === "metric") {
		if (/^m\d+(?:\.\d+)?$/i.test(rawDiameter)) {
			return rawDiameter.toUpperCase();
		}

		if (/^\d+(?:\.\d+)?$/.test(rawDiameter)) {
			return `M${rawDiameter}`;
		}

		return rawDiameter;
	}

	if (system === "imperial") {
		if (!rawPitch) return rawDiameter;

		if (/^#?\d+$/.test(rawDiameter) && /^\d+(?:\.\d+)?$/.test(rawPitch)) {
			return `${rawDiameter.replace(/^#/, "")}-${rawPitch}`;
		}
	}

	return rawDiameter;
}

function buildThreadOption(threadSeries = "", threadPitch = "") {
	const series = String(threadSeries || "").trim();
	const pitch = String(threadPitch || "").trim();

	if (series && pitch) return `${series} - ${pitch}`;
	return pitch || series || "";
}

function isValidBuilderMeasurementPair(attrs = {}) {
	const system = String(attrs.measurementSystem || "").trim().toLowerCase();
	const diameter = String(attrs.diameter || "").trim();

	if (!system || !diameter) return true;
	if (system === "metric") return /^M\d+(?:\.\d+)?$/i.test(diameter);
	if (system === "imperial") return !/^M\d+(?:\.\d+)?$/i.test(diameter);

	return true;
}

function normalizeVariantAttributesForBuilder(
	attributes = {},
	subcategoryId = "",
) {
	const attrs = { ...(attributes || {}) };
	const sub = String(subcategoryId || "").toLowerCase();

	const materialFinish =
		attrs.materialFinish ||
		[attrs.displayMaterial, attrs.displayFinish]
			.filter(Boolean)
			.join(" / ")
			.replace(/^(.+?) \/ \1$/, "$1");

	if (materialFinish) {
		attrs.materialFinish = materialFinish;
	}

	if (sub.includes("washer") && !attrs.diameter && attrs.insideDiameter) {
		attrs.diameter = attrs.insideDiameter;
	}

	delete attrs.displayMaterial;
	delete attrs.displayFinish;
	delete attrs.familyType;
	delete attrs.familyTitleBase;
	delete attrs.insideDiameter;
	delete attrs.outsideDiameter;
	delete attrs.material;
	delete attrs.finish;
	delete attrs.size;

	if (sub === "flat washers") {
		return {
			measurementSystem: attrs.measurementSystem || "",
			washerStandard: attrs.washerStandard || "",
			materialFinish: attrs.materialFinish || "",
			diameter: attrs.diameter || "",
			grade: attrs.grade || "",
		};
	}

	if (sub === "fender washers") {
		return {
			measurementSystem: attrs.measurementSystem || "",
			materialFinish: attrs.materialFinish || "",
			diameter: attrs.diameter || "",
			width: attrs.width || "",
			grade: attrs.grade || "",
		};
	}

	if (sub === "lock washers") {
		return {
			measurementSystem: attrs.measurementSystem || "",
			washerType: attrs.washerType || "",
			materialFinish: attrs.materialFinish || "",
			diameter: attrs.diameter || "",
			grade: attrs.grade || "",
		};
	}

	if (sub === "hex cap screws") {
		const measurementSystem = attrs.measurementSystem || "";
		const threadPitch = attrs.threadPitch || "";
		const threadSeries = attrs.threadSeries || attrs.thread_series || "";
		const normalizedDiameter = normalizeBuilderDiameter(
			attrs.diameter || "",
			threadPitch,
			measurementSystem,
		);
		const threadOption = buildThreadOption(threadSeries, threadPitch);

		return {
			measurementSystem,
			diameter: normalizedDiameter,
			threadOption,
			threadSeries,
			threadPitch,
			length: attrs.length || "",
			materialFinish: attrs.materialFinish || "",
			grade: attrs.grade || "",
		};
	}

	return attrs;
}

function escapeRegex(value = "") {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asNumber(value, fallback = 0) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function collectAttributeOptions(variants = [], subcategoryId = "") {
	const map = new Map();
	const sub = String(subcategoryId || "").toLowerCase();

	for (const variant of variants) {
		const attrs = normalizeVariantAttributesForBuilder(
			variant.attributes || {},
			sub,
		);

		for (const [key, value] of Object.entries(attrs)) {
			if (value === undefined || value === null || value === "") continue;

			if (!map.has(key)) {
				map.set(key, new Set());
			}

			map.get(key).add(String(value));
		}
	}

	const result = {};
	for (const [key, values] of map.entries()) {
		result[key] = Array.from(values).sort((a, b) =>
			String(a).localeCompare(String(b), undefined, {
				numeric: true,
				sensitivity: "base",
			}),
		);
	}

	return result;
}

function buildSpecKey(attributes = {}, subcategoryId = "") {
	const sub = String(subcategoryId || "").toLowerCase();

	const keys =
		sub === "flat washers"
			? [
					"measurementSystem",
					"washerStandard",
					"materialFinish",
					"diameter",
					"grade",
				]
			: sub === "fender washers"
				? ["measurementSystem", "materialFinish", "diameter", "width", "grade"]
				: sub === "lock washers"
					? [
							"measurementSystem",
							"washerType",
							"materialFinish",
							"diameter",
							"grade",
						]
					: sub === "hex cap screws"
						? [
								"measurementSystem",
								"diameter",
								"threadOption",
								"length",
								"materialFinish",
								"grade",
							]
						: [
								"size",
								"diameter",
								"threadPitch",
								"length",
								"measurementSystem",
								"material",
								"finish",
								"grade",
								"fastenerTypeCanonical",
								"fastenerType",
							];

	return keys
		.map(
			(key) =>
				`${key}:${String(attributes?.[key] || "")
					.trim()
					.toLowerCase()}`,
		)
		.join("|");
}

function sortVariantsForSelection(a, b) {
	const aInStock = asNumber(a?.qtyAvailable, 0) > 0 ? 1 : 0;
	const bInStock = asNumber(b?.qtyAvailable, 0) > 0 ? 1 : 0;

	if (aInStock !== bInStock) {
		return bInStock - aInStock;
	}

	const aQty = asNumber(a?.qtyAvailable, 0);
	const bQty = asNumber(b?.qtyAvailable, 0);

	if (aQty !== bQty) {
		return bQty - aQty;
	}

	const aPrice = asNumber(a?.price, 0);
	const bPrice = asNumber(b?.price, 0);

	if (aPrice !== bPrice) {
		return aPrice - bPrice;
	}

	return String(a?.partNumber || "").localeCompare(
		String(b?.partNumber || ""),
		undefined,
		{
			numeric: true,
			sensitivity: "base",
		},
	);
}

function dedupeVariants(variants = []) {
	const grouped = new Map();

	for (const variant of variants) {
		const specKey = buildSpecKey(
			variant.attributes || {},
			variant.subcategoryId || "",
		);

		if (!grouped.has(specKey)) {
			grouped.set(specKey, []);
		}

		grouped.get(specKey).push(variant);
	}

	const deduped = [];

	for (const [, group] of grouped.entries()) {
		const sorted = [...group].sort(sortVariantsForSelection);
		const best = sorted[0];

		deduped.push({
			...best,
			duplicateCount: group.length,
			groupedPartNumbers: sorted.map((item) => item.partNumber).filter(Boolean),
		});
	}

	return deduped;
}

function normalizeText(value = "") {
	return String(value || "")
		.trim()
		.toLowerCase();
}

function isLikelyAssemblyText(value = "") {
	const text = normalizeText(value);
	if (!text) return false;

	return (
		text.includes(" assy") ||
		text.includes("assembly") ||
		text.includes(" w /") ||
		text.includes(" w/") ||
		text.includes("with locknut") ||
		text.includes("locknut assy")
	);
}

function isBuilderReadyHexCapScrew(variant) {
	const attrs = variant?.attributes || {};

	const diameter = String(attrs.diameter || "").trim();
	const length = String(attrs.length || "").trim();
	const threadOption = String(attrs.threadOption || "").trim();
	const threadPitch = String(attrs.threadPitch || "").trim();
	const size = String(attrs.size || "").trim();
	const fastenerType = normalizeText(
		attrs.fastenerTypeCanonical || attrs.fastenerType || "",
	);

	const textToInspect = [
		variant?.name,
		variant?.description,
		attrs?.fishbowlDescription,
		variant?.partNumber,
	]
		.filter(Boolean)
		.join(" ");

	if (isLikelyAssemblyText(textToInspect)) {
		return false;
	}

	if (
		fastenerType &&
		!["hex cap screw", "heavy hex bolt", "structural bolt"].includes(fastenerType)
	) {
		return false;
	}

	if (!diameter) return false;
	if (!isValidBuilderMeasurementPair(attrs)) return false;
	if (!length) return false;
	if (!threadOption && !threadPitch && !size) return false;

	return true;
}

function shouldApplyBuilderReadyFilter(categoryId, subcategoryId) {
	return (
		normalizeText(categoryId) === "bolts" &&
		normalizeText(subcategoryId) === "hex cap screws"
	);
}

export async function getCatalogBuilderSubcategory(
	categoryId,
	subcategoryId,
	options = {},
) {
	const normalizedCategoryId = normalizeSlug(categoryId);
	const normalizedSubcategoryId = normalizeSlug(subcategoryId);

	if (!normalizedCategoryId || !normalizedSubcategoryId) {
		throw new Error("categoryId and subcategoryId are required");
	}

	const pricingSettings = await getPricingSettings();
	const pricingContext = await getPricingContext(
		options?.pricingContext || {},
		pricingSettings,
	);

	const enrichments = await ProductEnrichment.find({
		category: new RegExp(`^${escapeRegex(normalizedCategoryId)}$`, "i"),
		subcategory: new RegExp(`^${escapeRegex(normalizedSubcategoryId)}$`, "i"),
	}).lean();

	if (!enrichments.length) {
		return {
			categoryId: String(categoryId || ""),
			subcategoryId: String(subcategoryId || ""),
			name: toTitle(subcategoryId),
			description: "",
			image: "",
			attributes: {},
			families: [],
			variants: [],
			pricing: {
				accountType: pricingContext.approvedType,
				label: pricingContext.label,
				multiplier: pricingContext.multiplier,
			},
			totals: {
				variantCount: 0,
				familyCount: 0,
				rawVariantCount: 0,
				omittedVariantCount: 0,
			},
		};
	}

	const productIds = enrichments.map((e) => e.productId);

	const products = await Product.find({
		_id: { $in: productIds },
		isPublished: true,
		isActive: true,
		catalogStatus: "published",
	}).lean();

	const productMap = new Map(products.map((p) => [String(p._id), p]));

	const rawVariants = (
		await Promise.all(
			enrichments.map(async (enrichment) => {
				const product = productMap.get(String(enrichment.productId));
				if (!product) return null;

				const resolvedPricing = await resolveProductPrice(
					product,
					pricingContext,
					pricingSettings,
				);
				const qtyAvailable = asNumber(product?.inventory?.qtyAvailable, 0);

				return {
					productId: product._id,
					enrichmentId: enrichment._id,
					slug: enrichment?.seo?.slug || "",
					sku: product.sku || "",
					internalPartNumber: product.internalPartNumber || "",
					partNumber:
						enrichment?.attributes?.fishbowlPartNum ||
						product?.fishbowl?.partNum ||
						product?.sku ||
						"",

					name:
						enrichment.title || enrichment.shortTitle || toTitle(subcategoryId),
					familyName:
						enrichment?.attributes?.familyTitle || toTitle(subcategoryId),
					shortDescription: enrichment.shortDescription || "",
					description: enrichment.description || "",
					image:
						enrichment.images?.find((img) => img.isPrimary)?.url ||
						enrichment.images?.[0]?.url ||
						"",

					attributes: normalizeVariantAttributesForBuilder(
						enrichment.attributes || {},
						normalizedSubcategoryId,
					),

					price: resolvedPricing.resolvedPrice,
					baseCatalogPrice: resolvedPricing.baseCatalogPrice,
					currency: resolvedPricing.currency || "USD",
					priceSource: resolvedPricing.source || "fishbowl",
					accountType: resolvedPricing.approvedType,
					priceLabel: resolvedPricing.label,

					qtyAvailable,
					qtyOnHand: asNumber(product?.inventory?.qtyOnHand, 0),
					qtyAllocated: asNumber(product?.inventory?.qtyAllocated, 0),
					qtyOnOrder: asNumber(product?.inventory?.qtyOnOrder, 0),
					inStock: qtyAvailable > 0,

					familyKey: enrichment?.attributes?.familyKey || "ungrouped",
					familySlug: enrichment?.attributes?.familySlug || "",
					familyTitle:
						enrichment?.attributes?.familyTitle ||
						enrichment.title ||
						enrichment.shortTitle ||
						toTitle(subcategoryId),
					familyAttributeOptions:
						enrichment?.attributes?.familyAttributeOptions || {},
				};
			}),
		)
	).filter(Boolean);

	const filteredVariants = shouldApplyBuilderReadyFilter(
		normalizedCategoryId,
		normalizedSubcategoryId,
	)
		? rawVariants.filter(isBuilderReadyHexCapScrew)
		: rawVariants;

	const workingVariants = shouldApplyBuilderReadyFilter(
		normalizedCategoryId,
		normalizedSubcategoryId,
	)
		? filteredVariants
		: rawVariants;

	const omittedVariantCount = rawVariants.length - workingVariants.length;

	const familyKeys = [
		...new Set(workingVariants.map((v) => v.familyKey).filter(Boolean)),
	];

	const familyAssets = await CatalogFamilyAsset.find({
		category: normalizedCategoryId,
		subcategory: normalizedSubcategoryId,
		familyKey: { $in: familyKeys },
	}).lean();

	const familyAssetMap = new Map(
		familyAssets.map((asset) => [asset.familyKey, asset]),
	);

	const familiesMap = new Map();

	for (const variant of workingVariants) {
		const familyKey = variant.familyKey || "ungrouped";
		const asset = familyAssetMap.get(familyKey);

		if (!familiesMap.has(familyKey)) {
			familiesMap.set(familyKey, {
				familyKey,
				familySlug: variant.familySlug || asset?.familySlug || "",
				familyTitle:
					variant.familyTitle ||
					asset?.familyTitle ||
					variant.familyName ||
					variant.name ||
					"",
				familyDescription:
					asset?.familyDescription || variant.description || "",
				familyAttributeOptions: variant.familyAttributeOptions || {},
				image: asset?.image?.url || variant.image || "",
				imageAlt: asset?.image?.alt || "",
				rawVariants: [],
			});
		}

		familiesMap.get(familyKey).rawVariants.push({
			...variant,
			image: variant.image || asset?.image?.url || "",
		});
	}

	const families = Array.from(familiesMap.values()).map((family) => {
		const dedupedVariants = dedupeVariants(family.rawVariants);

		return {
			subcategoryId: normalizedSubcategoryId,
			familyKey: family.familyKey,
			familySlug: family.familySlug,
			familyTitle: family.familyTitle,
			familyDescription: family.familyDescription,
			familyAttributeOptions:
				Object.keys(family.familyAttributeOptions || {}).length > 0
					? family.familyAttributeOptions
					: collectAttributeOptions(dedupedVariants, normalizedSubcategoryId),
			image: family.image,
			imageAlt: family.imageAlt,
			variants: dedupedVariants,
		};
	});

	const flattenedVariants = families
		.flatMap((family) => family.variants || [])
		.sort(sortVariantsForSelection);

	const first = flattenedVariants[0];
	const firstFamilyWithImage = families.find((f) => f.image);

	return {
		categoryId: String(categoryId || ""),
		subcategoryId: String(subcategoryId || ""),
		name: toTitle(subcategoryId),
		description: first?.familyTitle
			? `${first.familyTitle} options available in this category.`
			: "",
		image: firstFamilyWithImage?.image || "",
		attributes: collectAttributeOptions(
			flattenedVariants,
			normalizedSubcategoryId,
		),
		families,
		variants: flattenedVariants,
		pricing: {
			accountType: pricingContext.approvedType,
			label: pricingContext.label,
			multiplier: pricingContext.multiplier,
		},
		totals: {
			variantCount: flattenedVariants.length,
			familyCount: families.length,
			rawVariantCount: rawVariants.length,
			omittedVariantCount,
		},
	};
}

export default getCatalogBuilderSubcategory;

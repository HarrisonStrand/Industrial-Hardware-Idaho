import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import CatalogFamilyAsset from "../../models/CatalogFamilyAsset.js";
import { buildReviewerInfo, findPreviewRows, isDraftPreview } from "./draftPreview.js";
import { getCatalogPageFilters } from "./catalogLayoutDefaults.js";
import {
	NUMBERED_DIAMETER_SIZES,
	collectGeneralChoiceOptions,
	dedupeGeneralVariants,
	parseBuilderSizeSort,
	planGeneralBuilderChoices,
	shapeGeneralBuilderAttributes,
	unifyChoiceValueCase,
	usesGeneralBuilderShaping,
} from "./builderShaping.js";
import {
	applyPriceMultiplier,
	getPricingContext,
	getPricingSettings,
} from "../../utils/resolveProductPrice.js";
import { priceGroupInfo } from "../../config/fixedPriceGroups.js";
import { applySoldByLength, isSoldByLengthPage } from "./soldByLength.js";
import { withPageAttributes } from "./pageAttributes.js";
import { loadRulePrices, productPartNumber } from "../fishbowl/loadRulePrices.js";



function roundCurrency(value = 0) {
	return Number(Number(value || 0).toFixed(2));
}

function resolveBuilderPriceFast(
	product = {},
	pricingContext = {},
	includePricing = true,
	groupInfo = null,
	fixedPriceGroups = [],
	priceMode = "markup",
) {
	if (!includePricing) {
		return {
			resolvedPrice: null,
			baseCatalogPrice: null,
			currency: product?.pricing?.currency || "USD",
			source: "hidden",
			approvedType: "RETAIL",
			label: "Retail",
		};
	}

	const rawBasePrice = product?.pricing?.basePrice;
	const rawSalePrice = product?.pricing?.salePrice;
	const baseCatalogPrice = roundCurrency(
		rawBasePrice !== null && rawBasePrice !== undefined
			? rawBasePrice
			: rawSalePrice !== null && rawSalePrice !== undefined
				? rawSalePrice
				: 0,
	);

	// Same rule as checkout: fixed-price groups (strut, Diablo, ...) skip the account markup.
	const priced = applyPriceMultiplier(baseCatalogPrice, pricingContext, groupInfo, fixedPriceGroups, priceMode);

	return {
		resolvedPrice: priced.resolvedPrice,
		baseCatalogPrice,
		currency: product?.pricing?.currency || "USD",
		source: product?.pricing?.priceSource || "fishbowl",
		approvedType: pricingContext?.approvedType || "RETAIL",
		label: priced.priceRule
			? `${pricingContext?.label || "Retail"} (Fishbowl pricing)`
			: priced.fixedPriceGroup
				? `${priced.fixedPriceGroup} (fixed price)`
				: pricingContext?.label || "Retail",
	};
}

function shouldUseFastBuilderProjection(categoryId = "", subcategoryId = "") {
	const category = normalizeSlug(categoryId);
	const subcategory = normalizeSlug(subcategoryId);

	return (
		(category === "bolts" && subcategory === "hex cap screws") ||
		(category === "nuts" && subcategory === "hex nuts")
	);
}

const FAST_BUILDER_ENRICHMENT_PROJECTION = {
	_id: 1,
	productId: 1,
	title: 1,
	shortTitle: 1,
	shortDescription: 1,
	description: 1,
	category: 1,
	"manufacturer.name": 1,
	subcategory: 1,
	"seo.slug": 1,
	"images.url": 1,
	"images.alt": 1,
	"images.isPrimary": 1,
	"documents.type": 1,
	"documents.title": 1,
	"documents.url": 1,
	"specs.group": 1,
	"specs.name": 1,
	"specs.value": 1,
	"specs.unit": 1,
	"specs.basis": 1,
	"specs.reference": 1,
	"specs.sourceUrl": 1,
	"attributes.measurementSystem": 1,
	"attributes.diameter": 1,
	"attributes.threadSeries": 1,
	"attributes.thread_series": 1,
	"attributes.threadPitch": 1,
	"attributes.thread_pitch": 1,
	"attributes.length": 1,
	"attributes.driveType": 1,
	"attributes.drive_type": 1,
	"attributes.materialFinish": 1,
	"attributes.grade": 1,
	"attributes.headType": 1,
	"attributes.fastenerType": 1,
	"attributes.fastenerTypeCanonical": 1,
	"attributes.familyKey": 1,
	"attributes.familySlug": 1,
	"attributes.familyTitle": 1,
	"attributes.fishbowlPartNum": 1,
	"attributes.fishbowlDescription": 1,
};

const FAST_BUILDER_PRODUCT_PROJECTION = {
	_id: 1,
	sku: 1,
	internalPartNumber: 1,
	"fishbowl.partNum": 1,
	"fishbowl.description": 1,
	"inventory.qtyAvailable": 1,
	"inventory.qtyOnHand": 1,
	"inventory.qtyAllocated": 1,
	"inventory.qtyOnOrder": 1,
	"pricing.basePrice": 1,
	"pricing.salePrice": 1,
	"pricing.currency": 1,
	"pricing.priceSource": 1,
	brand: 1,
	vendor: 1,
};

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



function formatMeasurementSystemForBuilder(value = "") {
	const raw = String(value || "").trim();
	if (/^imperial$/i.test(raw)) return "Standard";
	return raw;
}

function formatScrewHeadTypeForBuilder(attrs = {}) {
	const head = String(attrs.headType || attrs.head_type || "").trim();
	const detail = String(attrs.headDetail || attrs.head_detail || "").trim();

	if (!head) return "";

	const headLabel = /head$/i.test(head) ? head : `${head} head`;
	return [toTitle(headLabel), detail ? toTitle(detail) : ""]
		.filter(Boolean)
		.join(" ");
}

function formatScrewThreadForBuilder(attrs = {}, subcategoryId = "") {
	const sub = String(subcategoryId || "").toLowerCase();
	const existing = String(attrs.thread || attrs.threadLabel || "").trim();
	if (existing) return existing;

	if (sub === "machine screws") {
		const threadSeries = String(attrs.threadSeries || attrs.thread_series || "").trim();
		const threadPitch = String(attrs.threadPitch || attrs.thread_pitch || "").trim();

		if (threadSeries && threadPitch) return `${toTitle(threadSeries)} - ${threadPitch}`;
		if (threadPitch) return threadPitch;
		return "";
	}

	if (sub === "sheet metal screws") {
		const threadType = String(attrs.threadType || attrs.thread_type || "").trim();
		return threadType ? toTitle(threadType) : "";
	}

	return "";
}

// Display clean-up for builder filter values. Applied to both the filter options and each
// variant's attributes, so a filter value still matches the products it came from.
//   - a metric thread pitch shows at least one decimal: "1" -> "1.0", "1.00" -> "1.0", "0.50" -> "0.5"
//   - inch thread series read one way: "coarse" / "UNC (Coarse)" -> "(UNC) Coarse", "fine" / "UNF (Fine)" -> "(UNF) Fine";
//     a metric row's bare "coarse" / "fine" reads "Metric Coarse" / "Metric Fine"
//   - metric hex nut classes: "Class 8" -> "Class 8 (for 8.8 bolts)", "Class 10" -> "Class 10 (for 10.9 bolts)"
export function formatMetricPitchForBuilder(value = "") {
	const text = String(value ?? "").trim();
	if (!/^\d+(?:\.\d+)?$/.test(text)) return text;
	const [whole, fraction = ""] = text.split(".");
	const trimmed = fraction.replace(/0+$/, "");
	return `${whole}.${trimmed || "0"}`;
}

export function formatThreadSeriesForBuilder(value = "", metric = false) {
	const text = String(value ?? "").trim();
	const lower = text.toLowerCase();
	if (!text) return text;
	if (metric) {
		if (lower === "coarse") return "Metric Coarse";
		if (lower === "fine") return "Metric Fine";
		return text;
	}
	if (["coarse", "unc", "unc (coarse)", "(unc) coarse"].includes(lower)) return "(UNC) Coarse";
	if (["fine", "unf", "unf (fine)", "(unf) fine"].includes(lower)) return "(UNF) Fine";
	return text;
}

function polishBuilderValues(shaped = {}, attributes = {}) {
	const out = { ...(shaped || {}) };
	const system = String(attributes?.measurementSystem || out.measurementSystem || "").toLowerCase();
	const metric = system === "metric" || /^m\d/i.test(String(attributes?.diameter || ""));
	if (metric && out.threadPitch) out.threadPitch = formatMetricPitchForBuilder(out.threadPitch);
	if (out.threadSeries) out.threadSeries = formatThreadSeriesForBuilder(out.threadSeries, metric);
	// Metric nut classes stay as marked, with the bolt class they pair with.
	const family = String(attributes?.familyType || attributes?.fastenerTypeCanonical || "").toLowerCase();
	const nutClass = String(out.grade || "").match(/^Class (8|10)$/);
	if (family === "hex nut" && nutClass) out.grade = `Class ${nutClass[1]} (for ${nutClass[1] === "8" ? "8.8" : "10.9"} bolts)`;
	return out;
}

function normalizeVariantAttributesForBuilder(attributes = {}, subcategoryId = "") {
	return polishBuilderValues(shapeVariantAttributesForBuilder(attributes, subcategoryId), attributes);
}

function shapeVariantAttributesForBuilder(
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
		const threadPitch = attrs.threadPitch || attrs.thread_pitch || "";

		return {
			measurementSystem: attrs.measurementSystem || "",
			diameter: normalizeNumberedDiameterForBuilder(attrs.diameter || "", threadPitch),
			threadSeries: attrs.threadSeries || attrs.thread_series || "",
			threadPitch,
			length: attrs.length || "",
			drive_type: attrs.drive_type || attrs.driveType || "",
			materialFinish: attrs.materialFinish || "",
			grade: attrs.grade || "",
			headType: attrs.headType || "",
			fastenerType: attrs.fastenerTypeCanonical || attrs.fastenerType || "",
		};
	}

	if (sub === "hex nuts") {
		const threadPitch = attrs.threadPitch || attrs.thread_pitch || "";

		return {
			measurementSystem: formatMeasurementSystemForBuilder(attrs.measurementSystem || ""),
			diameter: normalizeNumberedDiameterForBuilder(attrs.diameter || "", threadPitch),
			threadSeries: attrs.threadSeries || attrs.thread_series || "",
			threadPitch,
			materialFinish: attrs.materialFinish || "",
			grade: attrs.grade || "",
			fastenerType: attrs.fastenerTypeCanonical || attrs.fastenerType || "",
		};
	}

	if (sub === "flange bolts") {
		return {
			measurementSystem: formatMeasurementSystemForBuilder(attrs.measurementSystem || ""),
			diameter: attrs.diameter || "",
			threadSeries: attrs.threadSeries || attrs.thread_series || "",
			threadPitch: attrs.threadPitch || "",
			length: attrs.length || "",
			drive_type: attrs.drive_type || attrs.driveType || "",
			materialFinish: attrs.materialFinish || "",
			grade: attrs.grade || "",
			headStandard: attrs.headStandard && attrs.headStandard !== "standard" ? attrs.headStandard : "",
		};
	}

	if (sub === "hanger bolts") {
		return {
			productType: attrs.productType || attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "hanger bolt",
			measurementSystem: formatMeasurementSystemForBuilder(attrs.measurementSystem || ""),
			diameter: attrs.diameter || "",
			threadSeries: attrs.threadSeries || attrs.thread_series || "",
			threadPitch: attrs.threadPitch || "",
			length: attrs.length || "",
			materialFinish: attrs.materialFinish || "",
			grade: attrs.grade || "",
		};
	}

	if (sub === "hanger bolt drivers") {
		return {
			measurementSystem: formatMeasurementSystemForBuilder(attrs.measurementSystem || ""),
			diameter: attrs.diameter || "",
			threadSeries: attrs.threadSeries || attrs.thread_series || "",
			threadPitch: attrs.threadPitch || "",
			materialFinish: attrs.materialFinish || "",
			grade: attrs.grade || "",
		};
	}

	if (sub === "machine screws" || sub === "sheet metal screws") {
		return {
			measurementSystem: formatMeasurementSystemForBuilder(attrs.measurementSystem || ""),
			headType: formatScrewHeadTypeForBuilder(attrs),
			drive_type: attrs.drive_type || attrs.driveType || "",
			diameter: attrs.diameter || "",
			length: attrs.length || "",
			thread: formatScrewThreadForBuilder(attrs, sub),
			materialFinish: attrs.materialFinish || "",
			grade: attrs.grade || "",
		};
	}

	if (sub === "threaded rod" || sub === "threaded rods") {
		return {
			measurementSystem: formatMeasurementSystemForBuilder(attrs.measurementSystem || ""),
			diameter: attrs.diameter || "",
			threadSeries: attrs.threadSeries || attrs.thread_series || "",
			threadPitch: attrs.threadPitch || "",
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

// A page id such as "bits drivers" or "chemicals paints sealants" must match the stored
// names "bits & drivers" and "chemicals, paints & sealants". Words are matched in order;
// anything between them may be spaces, dashes, commas, "&" or the word "and".
export function catalogNamePattern(normalizedId = "") {
	const words = String(normalizedId)
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((word) => word && word !== "and");
	if (!words.length) return "^$";
	const between = "(?:[\\s,&-]|\\band\\b)+";
	return `^${words.map(escapeRegex).join(between)}$`;
}

function asNumber(value, fallback = 0) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}


function normalizeNumberedDiameterForBuilder(diameter = "", threadPitch = "") {
	const raw = String(diameter || "").replace(/\s+/g, "").trim();
	const pitch = String(threadPitch || "").replace(/\s+/g, "").trim();

	if (!raw) return "";

	// Numbered sizes are filtered as "#10"; the pitch has its own filter.
	const existing = raw.match(/^#?(\d+)\-(\d+(?:\.\d+)?)$/);
	if (existing && NUMBERED_DIAMETER_SIZES.has(existing[1]) && (!pitch || pitch === existing[2])) {
		return `#${existing[1]}`;
	}

	const sizeOnly = raw.match(/^#?(\d+)$/);
	if (!sizeOnly || !NUMBERED_DIAMETER_SIZES.has(sizeOnly[1])) {
		return String(diameter || "").trim();
	}

	return `#${sizeOnly[1]}`;
}

function sortBuilderOptionValues(values = [], key = "") {
	const lower = String(key || "").toLowerCase();

	if (["diameter", "length", "width", "thickness", "threadpitch"].includes(lower)) {
		return [...values].sort((a, b) => {
			const aSort = parseBuilderSizeSort(a, key);
			const bSort = parseBuilderSizeSort(b, key);

			if (aSort && bSort) {
				if (aSort.primary !== bSort.primary) return aSort.primary - bSort.primary;
				if (aSort.secondary !== bSort.secondary) return aSort.secondary - bSort.secondary;
			}

			if (aSort && !bSort) return -1;
			if (!aSort && bSort) return 1;

			return String(a).localeCompare(String(b), undefined, {
				numeric: true,
				sensitivity: "base",
			});
		});
	}

	return [...values].sort((a, b) =>
		String(a).localeCompare(String(b), undefined, {
			numeric: true,
			sensitivity: "base",
		}),
	);
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
			if (typeof value === "object") continue;

			if (!map.has(key)) {
				map.set(key, new Set());
			}

			map.get(key).add(String(value));
		}
	}

	const result = {};
	for (const [key, values] of map.entries()) {
		result[key] = sortBuilderOptionValues(Array.from(values), key);
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
								"threadSeries",
								"threadPitch",
								"length",
								"driveType",
								"drive_type",
								"materialFinish",
								"grade",
								"fastenerTypeCanonical",
							]
						: sub === "hex nuts"
							? [
									"measurementSystem",
									"diameter",
									"threadSeries",
									"threadPitch",
									"materialFinish",
									"grade",
									"fastenerTypeCanonical",
								]
						: sub === "flange bolts"
							? [
									"productType",
									"measurementSystem",
									"diameter",
									"threadSeries",
									"threadPitch",
									"length",
									"drive_type",
									"materialFinish",
									"grade",
									"headStandard",
								]
						: sub === "hanger bolts"
							? [
									"productType",
									"measurementSystem",
									"diameter",
									"threadSeries",
									"threadPitch",
									"length",
									"materialFinish",
									"grade",
								]
						: sub === "hanger bolt drivers"
							? [
									"measurementSystem",
									"diameter",
									"threadSeries",
									"threadPitch",
									"materialFinish",
									"grade",
								]
						: sub === "machine screws" || sub === "sheet metal screws"
							? [
									"measurementSystem",
									"headType",
									"drive_type",
									"diameter",
									"length",
									"thread",
									"materialFinish",
									"grade",
								]
							: sub === "threaded rod" || sub === "threaded rods"
								? [
										"measurementSystem",
										"diameter",
										"threadSeries",
										"threadPitch",
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
								]

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


function isWrongHeadCapScrewForHexBuilder(value = "") {
	const text = normalizeText(value);
	if (!text) return false;

	return (
		/\b(?:BHCS|SHCS|FHCS)\d{5,8}(?:FLH|F|LH|Z)?\b/i.test(value) ||
		/\b(?:SSSB|SSSH|SSSF)\d{5,8}(?:FLH|F|LH)?\b/i.test(value) ||
		/\bMMS[BFH]\d{8}(?:SS|Z)?\b/i.test(value) ||
		text.includes("button head cap screw") ||
		text.includes("button hd cap screw") ||
		text.includes("button head") ||
		text.includes("socket head cap screw") ||
		text.includes("socket hd cap screw") ||
		text.includes("soc hd cap screw") ||
		text.includes("soc. hd cap screw") ||
		text.includes("flat head cap screw") ||
		text.includes("flat hd cap screw")
	);
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

	const driveType = String(attrs.driveType || attrs.drive_type || "").trim();
	const diameter = String(attrs.diameter || "").trim();
	const length = String(attrs.length || "").trim();
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

	if (isWrongHeadCapScrewForHexBuilder(textToInspect)) {
		return false;
	}

	if (fastenerType && fastenerType !== "hex cap screw") {
		return false;
	}

	if (!diameter) return false;
	if (!length) return false;
	if (!threadPitch && !size) return false;

	return true;
}

function isBuilderReadyHexNut(variant) {
	const attrs = variant?.attributes || {};

	const diameter = String(attrs.diameter || "").trim();
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

	if (isLikelyAssemblyText(textToInspect)) return false;
	if (fastenerType && !["hex nut", "heavy hex nut"].includes(fastenerType)) return false;
	if (!diameter) return false;
	if (!threadPitch && !size) return false;

	return true;
}

function getBuilderReadyFilter(categoryId, subcategoryId) {
	const category = normalizeText(categoryId);
	const subcategory = normalizeText(subcategoryId);

	if (category === "bolts" && subcategory === "hex cap screws") {
		return isBuilderReadyHexCapScrew;
	}

	if (category === "nuts" && subcategory === "hex nuts") {
		return isBuilderReadyHexNut;
	}

	return null;
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

	const includePricing = options?.includePricing !== false;
	const pricingSettings = includePricing ? await getPricingSettings() : null;
	const pricingContext = includePricing
		? await getPricingContext(options?.pricingContext || {}, pricingSettings)
		: {
			approvedType: "RETAIL",
			label: "Retail",
			multiplier: 1,
		};

	const categoryPattern = catalogNamePattern(normalizedCategoryId);

	const useFastProjection = shouldUseFastBuilderProjection(
		normalizedCategoryId,
		normalizedSubcategoryId,
	);

	// High-volume builders use normalized lowercase category/subcategory values,
	// so exact equality can use the existing { category, subcategory } index.
	// Other catalog areas keep the legacy tolerant regex behavior.
	const enrichmentFilter = useFastProjection
		? {
				category: {
					$in: [
						normalizedCategoryId,
						toTitle(normalizedCategoryId),
						normalizedCategoryId.toUpperCase(),
					],
				},
				subcategory: {
					$in: [
						normalizedSubcategoryId,
						toTitle(normalizedSubcategoryId),
						normalizedSubcategoryId.toUpperCase(),
					],
				},
			}
		: {
				category: new RegExp(categoryPattern, "i"),
				subcategory: new RegExp(
					catalogNamePattern(normalizedSubcategoryId),
					"i",
				),
			};

	const preview = isDraftPreview();
	// General shaping (builderShaping.js) for every page without a hand-tuned shape. Draft preview only for now:
	// live builder pages without a hand-tuned shape are visible today (buildersEnabled is on), and their
	// output must not change until launch.
	const generalShaping = usesGeneralBuilderShaping(normalizedSubcategoryId, preview);
	const includeUnpublished = options?.includeUnpublished === true;
	const allowedReviewStatuses = Array.isArray(options?.allowedReviewStatuses)
		? options.allowedReviewStatuses.filter(Boolean)
		: null;
	let enrichments;
	let productMap;

	if (preview) {
		// Draft preview: staged values laid over the live ones; a product with a visible draft counts as published.
		let productPublished = { isPublished: true };
		if (allowedReviewStatuses?.length) {
			productPublished = {
				$or: [
					{ isPublished: true },
					{ "review.status": { $in: allowedReviewStatuses } },
				],
			};
		} else if (includeUnpublished) {
			productPublished = {};
		}
		({ enrichments, productMap } = await findPreviewRows({
			ProductEnrichment,
			Product,
			query: enrichmentFilter,
			productCommon: {
				isActive: { $ne: false },
				"fishbowl.active": { $ne: false },
			},
			productPublished,
		}));
	} else {
		let enrichmentQuery = ProductEnrichment.find(enrichmentFilter);
		if (useFastProjection) {
			enrichmentQuery = enrichmentQuery.select(FAST_BUILDER_ENRICHMENT_PROJECTION);
		}

		enrichments = await enrichmentQuery.lean();

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

		const productFilter = {
			_id: { $in: productIds },
			isActive: { $ne: false },
			"fishbowl.active": { $ne: false },
		};

		if (allowedReviewStatuses?.length) {
			productFilter.$or = [
				{ isPublished: true },
				{ "review.status": { $in: allowedReviewStatuses } },
			];
		} else if (!includeUnpublished) {
			productFilter.isPublished = true;
		}

		let productQuery = Product.find(productFilter);
		if (useFastProjection) {
			productQuery = productQuery.select(FAST_BUILDER_PRODUCT_PROJECTION);
		}

		const products = await productQuery.lean();

		productMap = new Map(products.map((p) => [String(p._id), p]));
	}

	if (preview && !enrichments.length) {
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

	// Fishbowl rules mode: the copied rule prices for these products (empty map in markup mode).
	const rulePriceMap = includePricing
		? await loadRulePrices([...productMap.values()], pricingSettings)
		: new Map();

	const builtVariants = enrichments
		.map((enrichment) => {
				const product = productMap.get(String(enrichment.productId));
				if (!product) return null;

				// Pricing settings/context are already resolved once above. Avoid
				// thousands of async helper calls while building a large category.
				const resolvedPricing = resolveBuilderPriceFast(
					product,
					pricingContext,
					includePricing,
					priceGroupInfo(product, enrichment, rulePriceMap.get(productPartNumber(product)) || null),
					pricingSettings?.fixedPriceGroups || [],
					pricingSettings?.priceMode || "markup",
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
					// Downloadable PDFs for the product's detail view (spec sheet, SDS, ...).
					documents: (enrichment.documents || [])
						.filter((doc) => doc && doc.url)
						.map((doc) => ({ type: doc.type || "", title: doc.title || "", url: doc.url })),
					// Specifications with their basis and reference.
					specs: (enrichment.specs || [])
						.filter((spec) => spec && spec.name && spec.value)
						.map((spec) => ({
							group: spec.group || "",
							name: spec.name,
							value: spec.value,
							unit: spec.unit || "",
							basis: spec.basis || "",
							reference: spec.reference || "",
							sourceUrl: spec.sourceUrl || "",
						})),
					image:
						enrichment.images?.find((img) => img.isPrimary)?.url ||
						enrichment.images?.[0]?.url ||
						"",

					attributes: generalShaping
						? polishBuilderValues(
								shapeGeneralBuilderAttributes(enrichment.attributes || {}),
								enrichment.attributes || {},
							)
						: normalizeVariantAttributesForBuilder(
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
					...(preview ? { preview: buildReviewerInfo(product, enrichment) } : {}),
				};
		})
		.filter(Boolean);

	// Tubing, loom, sleeving, chain, wire and cable are sold by the foot (soldByLength.js).
	const soldByLengthPage = isSoldByLengthPage(categoryId, subcategoryId);
	const lengthShaped = soldByLengthPage ? applySoldByLength(builtVariants) : builtVariants;
	const rawVariants = withPageAttributes(categoryId, subcategoryId, lengthShaped);

	const builderReadyFilter =
		options?.applyBuilderReadyFilter === false
			? null
			: getBuilderReadyFilter(
				normalizedCategoryId,
				normalizedSubcategoryId,
			);

	const filteredVariants = builderReadyFilter
		? rawVariants.filter(builderReadyFilter)
		: rawVariants;

	const workingVariants = builderReadyFilter ? filteredVariants : rawVariants;

	const omittedVariantCount = rawVariants.length - workingVariants.length;

	if (generalShaping) unifyChoiceValueCase(workingVariants.map((variant) => variant.attributes || {}));
	const generalChoices = generalShaping
		? planGeneralBuilderChoices(
				workingVariants.map((variant) => variant.attributes || {}),
				getCatalogPageFilters(categoryId, subcategoryId),
			).filter((choice) => !(soldByLengthPage && ["length", "rollLength"].includes(choice.key)))
		: null;
	const generalChoiceKeys = generalChoices ? generalChoices.map((choice) => choice.key) : [];

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
		const dedupedVariants = generalShaping
			? dedupeGeneralVariants(family.rawVariants, generalChoiceKeys, sortVariantsForSelection)
			: dedupeVariants(family.rawVariants);

		return {
			subcategoryId: normalizedSubcategoryId,
			familyKey: family.familyKey,
			familySlug: family.familySlug,
			familyTitle: family.familyTitle,
			familyDescription: family.familyDescription,
			familyAttributeOptions: generalShaping
				? collectGeneralChoiceOptions(dedupedVariants, generalChoices)
				: collectAttributeOptions(
						dedupedVariants,
						normalizedSubcategoryId,
					),
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
		attributes: generalShaping
			? collectGeneralChoiceOptions(flattenedVariants, generalChoices)
			: collectAttributeOptions(
					flattenedVariants,
					normalizedSubcategoryId,
				),
		// General pages only: the choices in buyer order with readable labels; the client shows exactly these.
		...(generalShaping ? { shaping: "general", choices: generalChoices } : {}),
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

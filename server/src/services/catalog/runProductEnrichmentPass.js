import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import createProductEnrichmentFromProduct from "./createProductEnrichmentFromProduct.js";

function normalize(value = "") {
	return String(value || "").trim().toLowerCase();
}

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value = "") {
	return clean(value)
		.toLowerCase()
		.replace(/["']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function uniqueSorted(values = []) {
	return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))].sort(
		(a, b) =>
			String(a).localeCompare(String(b), undefined, {
				numeric: true,
				sensitivity: "base",
			})
	);
}

function addToOptions(options, key, value) {
	if (!value) return;

	if (!options[key]) {
		options[key] = new Set();
	}

	options[key].add(String(value).trim());
}

function canonicalizeFastenerType(value = "", subcategory = "") {
	const v = clean(value).toLowerCase();
	const sub = clean(subcategory).toLowerCase();

	if (
		v === "hex bolt" ||
		v === "hex bolts" ||
		v === "hex head bolt" ||
		v === "hex head bolts" ||
		v === "hex cap screw" ||
		v === "hex cap screws" ||
		sub === "hex cap screws"
	) {
		return "hex cap screw";
	}

	if (v === "carriage bolt" || v === "carriage bolts") {
		return "carriage bolt";
	}

	if (v === "lag bolt" || v === "lag bolts" || v === "lag screw" || v === "lag screws") {
		return "lag screw";
	}

	if (v === "socket head cap screw" || v === "socket cap screw") {
		return "socket head cap screw";
	}

	return clean(value);
}

function toPluralFamilyType(value = "") {
	const v = clean(value);

	if (!v) return "Catalog Family";
	if (v.endsWith("s")) return v;

	if (v === "hex cap screw") return "Hex Cap Screws";
	if (v === "carriage bolt") return "Carriage Bolts";
	if (v === "lag screw") return "Lag Screws";
	if (v === "socket head cap screw") return "Socket Head Cap Screws";

	return `${v}s`;
}

function buildFamilyKey({ attributes = {}, enrichment = null }) {
	const category = normalize(enrichment?.category || attributes.categoryCanonical || "");
	const subcategory = normalize(enrichment?.subcategory || attributes.subcategoryCanonical || "");
	const fastenerType = normalize(
		attributes.fastenerTypeCanonical ||
			canonicalizeFastenerType(attributes.fastenerType, enrichment?.subcategory || "")
	);
	const finish = normalize(attributes.finish);
	const grade = normalize(attributes.grade);
	const material = normalize(attributes.material);
	const measurementSystem = normalize(attributes.measurementSystem);

	return [
		category,
		subcategory,
		fastenerType,
		finish,
		grade,
		material,
		measurementSystem,
	]
		.filter(Boolean)
		.join("|");
}

function buildFamilyTitle({ attributes = {}, enrichment = null }) {
	const canonicalType =
		attributes.fastenerTypeCanonical ||
		canonicalizeFastenerType(attributes.fastenerType, enrichment?.subcategory || "");

	const parts = [
		clean(attributes.finish),
		clean(attributes.grade),
		clean(attributes.material),
		toPluralFamilyType(canonicalType),
	].filter(Boolean);

	return parts.join(" ") || "Catalog Family";
}

function buildFamilySlug({ attributes = {}, enrichment = null }) {
	return slugify(buildFamilyTitle({ attributes, enrichment }));
}

function buildFamilyDescription({
	familyTitle = "",
	category = "",
	subcategory = "",
	count = 0,
}) {
	return `${familyTitle} catalog family in ${category || "Catalog"} under ${
		subcategory || "Products"
	} with ${count} variants`;
}

export default async function runProductEnrichmentPass({
	productIds = [],
	dryRun = false,
} = {}) {
	const results = [];

	let targetProductIds = Array.isArray(productIds) ? productIds.filter(Boolean) : [];

	if (!targetProductIds.length) {
		const products = await Product.find({}, { _id: 1 }).lean();
		targetProductIds = products.map((p) => p._id);
	}

	for (const productId of targetProductIds) {
		try {
			const result = await createProductEnrichmentFromProduct(productId);
			results.push({
				status: "ok",
				productId,
				action: result.action,
			});
		} catch (err) {
			results.push({
				status: "failed",
				productId,
				error: err.message,
			});
		}
	}

	const enrichments = await ProductEnrichment.find({
		productId: { $in: targetProductIds },
	});

	const families = new Map();

	for (const enrichment of enrichments) {
		const attrs = enrichment.attributes || {};

		const familyKey = buildFamilyKey({
			attributes: attrs,
			enrichment,
		});

		if (!familyKey) continue;

		if (!families.has(familyKey)) {
			families.set(familyKey, {
				familyKey,
				familySlug: buildFamilySlug({ attributes: attrs, enrichment }),
				familyTitle: buildFamilyTitle({ attributes: attrs, enrichment }),
				category: enrichment.category || "",
				subcategory: enrichment.subcategory || "",
				products: [],
				options: {},
			});
		}

		const family = families.get(familyKey);

		family.products.push({
			productId: enrichment.productId,
			enrichmentId: enrichment._id,
			sku: attrs.sku || "",
			fishbowlPartNum: attrs.fishbowlPartNum || "",
			title: enrichment.title || "",
		});

		addToOptions(family.options, "size", attrs.size);
		addToOptions(family.options, "diameter", attrs.diameter);
		addToOptions(family.options, "threadPitch", attrs.threadPitch);
		addToOptions(family.options, "length", attrs.length);

		addToOptions(family.options, "measurementSystem", attrs.measurementSystem);
		addToOptions(family.options, "material", attrs.material);
		addToOptions(family.options, "finish", attrs.finish);
		addToOptions(family.options, "grade", attrs.grade);
		addToOptions(
			family.options,
			"fastenerType",
			attrs.fastenerTypeCanonical || attrs.fastenerType
		);
	}

	const finalFamilies = [];

	for (const family of families.values()) {
		const familyAttributeOptions = {};

		for (const [key, set] of Object.entries(family.options)) {
			familyAttributeOptions[key] = uniqueSorted(Array.from(set));
		}

		const finalized = {
			familyKey: family.familyKey,
			familySlug: family.familySlug,
			familyTitle: family.familyTitle,
			familyDescription: buildFamilyDescription({
				familyTitle: family.familyTitle,
				category: family.category,
				subcategory: family.subcategory,
				count: family.products.length,
			}),
			category: family.category,
			subcategory: family.subcategory,
			products: family.products,
			familyAttributeOptions,
			count: family.products.length,
		};

		finalFamilies.push(finalized);
	}

	if (!dryRun) {
		for (const family of finalFamilies) {
			for (const product of family.products) {
				await ProductEnrichment.updateOne(
					{ productId: product.productId },
					{
						$set: {
							"attributes.familyKey": family.familyKey,
							"attributes.familySlug": family.familySlug,
							"attributes.familyTitle": family.familyTitle,
							"attributes.familyAttributeOptions": family.familyAttributeOptions,
						},
					}
				);
			}
		}
	}

	return {
		productCount: targetProductIds.length,
		familyCount: finalFamilies.length,
		families: finalFamilies,
		results,
	};
}
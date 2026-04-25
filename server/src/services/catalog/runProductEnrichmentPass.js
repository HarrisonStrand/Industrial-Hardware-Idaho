// server/src/services/catalog/runProductEnrichmentPass.js
import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import createProductEnrichmentFromProduct from "./createProductEnrichmentFromProduct.js";

function normalize(value = "") {
	return String(value || "")
		.trim()
		.toLowerCase();
}

function clean(value = "") {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim();
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
			}),
	);
}

function addToOptions(options, key, value) {
	if (!value) return;

	if (!options[key]) {
		options[key] = new Set();
	}

	options[key].add(String(value).trim());
}

function buildFamilyKey({ attributes = {}, enrichment = null }) {
	const category = normalize(
		enrichment?.category || attributes.categoryCanonical || "",
	);
	const subcategory = normalize(
		enrichment?.subcategory || attributes.subcategoryCanonical || "",
	);
	const familyType = normalize(
		attributes.familyType ||
			attributes.fastenerTypeCanonical ||
			attributes.fastenerType ||
			"",
	);

	const measurementSystem = normalize(attributes.measurementSystem || "");
	const washerStandard = normalize(attributes.washerStandard || "");
	const washerType = normalize(attributes.washerType || "");
	const diameter = normalize(attributes.diameter || "");
	const width = normalize(attributes.width || "");

	const finish = normalize(attributes.finish || "");
	const grade = normalize(attributes.grade || "");
	const material = normalize(attributes.material || "");
	const vendor = normalize(enrichment?.websiteVendor || "");
	const brand = normalize(enrichment?.websiteBrand || "");

	const parts = [category, subcategory, familyType];

	if (familyType === "flat washer") {
		parts.push(measurementSystem, washerStandard, diameter);
	} else if (familyType === "fender washer") {
		parts.push(measurementSystem, diameter, width);
	} else if (familyType === "lock washer") {
		parts.push(measurementSystem, washerType, diameter);
	} else if (familyType.includes("washer")) {
		parts.push(measurementSystem, diameter);
	} else if (familyType.includes("cotter pin")) {
		parts.push(finish, material, measurementSystem);
	} else if (
		familyType.includes("hex cap screw") ||
		familyType.includes("carriage bolt") ||
		familyType.includes("lag screw") ||
		familyType.includes("socket head cap screw")
	) {
		parts.push(finish, grade, material, measurementSystem);
	} else if (familyType.includes("abrasive")) {
		parts.push(grade, measurementSystem);
	} else if (familyType.includes("auveco")) {
		parts.push(vendor, brand);
	} else {
		parts.push(finish, material, measurementSystem, vendor, brand);
	}

	return parts.filter(Boolean).join("|");
}

function buildFamilyTitle({ attributes = {}, enrichment = null }) {
	const familyType =
		clean(attributes.familyType) ||
		clean(attributes.fastenerTypeCanonical) ||
		clean(attributes.fastenerType) ||
		clean(enrichment?.subcategory) ||
		"Catalog Family";

	const diameter = clean(attributes.diameter || "");
	const width = clean(attributes.width || "");
	const washerStandard = clean(attributes.washerStandard || "");
	const washerType = clean(attributes.washerType || "");

	let parts = [];

	if (familyType === "flat washer") {
		parts = [washerStandard, diameter, familyType].filter(Boolean);
	} else if (familyType === "fender washer") {
		parts = [diameter, width, familyType].filter(Boolean);
	} else if (familyType === "lock washer") {
		parts = [washerType, diameter, familyType].filter(Boolean);
	} else if (familyType.toLowerCase().includes("washer")) {
		parts = [diameter, familyType].filter(Boolean);
	} else {
		parts = [
			clean(attributes.finish),
			clean(attributes.grade),
			clean(attributes.material),
			familyType,
		].filter(Boolean);
	}

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

	let targetProductIds = Array.isArray(productIds)
		? productIds.filter(Boolean)
		: [];

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

		const familyKey =
			clean(attrs.familyKey) ||
			buildFamilyKey({
				attributes: attrs,
				enrichment,
			});

		if (!familyKey) continue;

		if (!families.has(familyKey)) {
			families.set(familyKey, {
				familyKey,
				familySlug:
					clean(attrs.familySlug) ||
					buildFamilySlug({ attributes: attrs, enrichment }),
				familyTitle:
					clean(attrs.familyTitle) ||
					buildFamilyTitle({ attributes: attrs, enrichment }),
				category: enrichment.category || "",
				subcategory: enrichment.subcategory || "",
				familyType:
					attrs.familyType ||
					attrs.fastenerTypeCanonical ||
					attrs.fastenerType ||
					"",
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

		const familyType = String(
			attrs.familyType ||
				attrs.fastenerTypeCanonical ||
				attrs.fastenerType ||
				"",
		).toLowerCase();

		addToOptions(family.options, "measurementSystem", attrs.measurementSystem);
		addToOptions(family.options, "diameter", attrs.diameter);
		addToOptions(family.options, "grade", attrs.grade);

		if (familyType === "flat washer") {
			addToOptions(family.options, "washerStandard", attrs.washerStandard);
			addToOptions(family.options, "materialFinish", attrs.materialFinish);
		} else if (familyType === "fender washer") {
			addToOptions(family.options, "width", attrs.width);
			addToOptions(family.options, "materialFinish", attrs.materialFinish);
		} else if (familyType === "lock washer") {
			addToOptions(family.options, "washerType", attrs.washerType);
			addToOptions(family.options, "materialFinish", attrs.materialFinish);
		} else if (familyType.includes("washer")) {
			addToOptions(family.options, "materialFinish", attrs.materialFinish);
		} else {
			addToOptions(
				family.options,
				"driveType",
				attrs.driveType || attrs.drive_type,
			);
			addToOptions(family.options, "materialFinish", attrs.materialFinish);
			addToOptions(family.options, "size", attrs.size);
			addToOptions(family.options, "threadPitch", attrs.threadPitch);
			addToOptions(
				family.options,
				"threadSeries",
				attrs.threadSeries || attrs.thread_series,
			);
			addToOptions(family.options, "length", attrs.length);
			addToOptions(family.options, "material", attrs.material);
			addToOptions(family.options, "finish", attrs.finish);
			addToOptions(
				family.options,
				"fastenerType",
				attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType,
			);
		}
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
			familyType: family.familyType,
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
							"attributes.familyType": family.familyType,
							"attributes.familyAttributeOptions":
								family.familyAttributeOptions,
						},
					},
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

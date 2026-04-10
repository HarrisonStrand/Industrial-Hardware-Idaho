import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";

function cleanText(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueStrings(values = []) {
	return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))];
}

function slugify(value = "") {
	return cleanText(value)
		.toLowerCase()
		.replace(/["']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function normalizeWebsiteTaxonomy(parsed = {}, product = null) {
	const rawCategory = cleanText(parsed.category || product?.categoryHints?.[0] || "");
	const rawSubcategory = cleanText(parsed.subcategory || product?.categoryHints?.[1] || "");
	const fastenerType = cleanText(parsed.fastenerType || "");

	const categoryKey = rawCategory.toLowerCase();
	const subcategoryKey = rawSubcategory.toLowerCase();
	const fastenerTypeKey = fastenerType.toLowerCase();

	let category = "";
	let subcategory = "";

	if (categoryKey === "fasteners") {
		category = "bolts";
	} else if (categoryKey) {
		category = categoryKey;
	}

	if (
		subcategoryKey === "hex bolts" ||
		subcategoryKey === "hex bolt" ||
		subcategoryKey === "hex head bolts" ||
		subcategoryKey === "hex head bolt" ||
		fastenerTypeKey === "hex bolt" ||
		fastenerTypeKey === "hex head bolt" ||
		fastenerTypeKey === "hex cap screw" ||
		fastenerTypeKey === "hex cap screws"
	) {
		subcategory = "hex cap screws";
	} else if (subcategoryKey) {
		subcategory = subcategoryKey;
	}

	if (!category) {
		if (subcategory.includes("washer")) category = "washers";
		else if (subcategory.includes("nut")) category = "nuts";
		else category = "bolts";
	}

	return { category, subcategory };
}

function canonicalizeFastenerType(value = "", subcategory = "") {
	const v = cleanText(value).toLowerCase();
	const sub = cleanText(subcategory).toLowerCase();

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

	return cleanText(value);
}

function toPluralFamilyType(value = "") {
	const v = cleanText(value);

	if (!v) return "Catalog Family";
	if (v.endsWith("s")) return v;

	if (v === "hex cap screw") return "Hex Cap Screws";
	if (v === "carriage bolt") return "Carriage Bolts";
	if (v === "lag screw") return "Lag Screws";
	if (v === "socket head cap screw") return "Socket Head Cap Screws";

	return `${v}s`;
}

function buildVariantTitle({ product = null, fallbackPartNum = "" }) {
	const fishbowlDescription = cleanText(
		product?.fishbowl?.description ||
			product?.fishbowl?.raw?.original?.description ||
			product?.fishbowl?.raw?.original?.partDescription ||
			product?.fishbowl?.raw?.original?.name ||
			""
	);

	if (fishbowlDescription) return fishbowlDescription;
	if (fallbackPartNum) return fallbackPartNum;
	return "Untitled Product";
}

function buildShortDescription({ title = "", product = null }) {
	const partNum = product?.fishbowl?.partNum || product?.sku || "";
	return cleanText(`${title}${partNum ? ` (${partNum})` : ""}`.trim());
}

function buildDescription({ title = "", parsed = {}, product = null }) {
	const lines = [];

	if (title) {
		lines.push(`${title} is a catalog item imported from Fishbowl and prepared for ecommerce enrichment.`);
	}

	const specBits = [
		parsed.size ? `Size: ${parsed.size}` : "",
		parsed.length ? `Length: ${parsed.length}` : "",
		parsed.material ? `Material: ${parsed.material}` : "",
		parsed.finish ? `Finish: ${parsed.finish}` : "",
		parsed.grade ? `Grade: ${parsed.grade}` : "",
		parsed.fastenerType ? `Type: ${parsed.fastenerType}` : "",
	].filter(Boolean);

	if (specBits.length > 0) {
		lines.push(`Detected specs include ${specBits.join(", ")}.`);
	}

	if (product?.fishbowl?.partNum) {
		lines.push(`Fishbowl part number: ${product.fishbowl.partNum}.`);
	}

	return cleanText(lines.join(" "));
}

function buildBulletPoints(parsed = {}) {
	return [
		parsed.size ? `Size: ${parsed.size}` : "",
		parsed.diameter ? `Diameter: ${parsed.diameter}` : "",
		parsed.threadPitch ? `Thread Pitch: ${parsed.threadPitch}` : "",
		parsed.length ? `Length: ${parsed.length}` : "",
		parsed.material ? `Material: ${parsed.material}` : "",
		parsed.finish ? `Finish: ${parsed.finish}` : "",
		parsed.grade ? `Grade: ${parsed.grade}` : "",
		parsed.fastenerType ? `Type: ${parsed.fastenerType}` : "",
		parsed.measurementSystem ? `Measurement System: ${parsed.measurementSystem}` : "",
	].filter(Boolean);
}

function buildTags({ parsed = {}, product = null, normalizedTaxonomy = {}, canonicalFastenerType = "" }) {
	return uniqueStrings([
		normalizedTaxonomy.category ? slugify(normalizedTaxonomy.category) : "",
		normalizedTaxonomy.subcategory ? slugify(normalizedTaxonomy.subcategory) : "",
		canonicalFastenerType ? slugify(canonicalFastenerType) : "",
		parsed.fastenerType ? slugify(parsed.fastenerType) : "",
		parsed.finish ? slugify(parsed.finish) : "",
		parsed.material ? slugify(parsed.material) : "",
		parsed.grade ? slugify(parsed.grade) : "",
		...(Array.isArray(product?.searchKeywords) ? product.searchKeywords.map(slugify) : []),
	]);
}

function buildFamilyTitle({ parsed = {}, canonicalFastenerType = "" }) {
	const parts = [
		cleanText(parsed.finish),
		cleanText(parsed.grade),
		cleanText(parsed.material),
		toPluralFamilyType(canonicalFastenerType),
	].filter(Boolean);

	return parts.join(" ") || "Catalog Family";
}

function buildAttributes(parsed = {}, product = null, normalizedTaxonomy = {}, canonicalFastenerType = "") {
	return {
		size: parsed.size || "",
		diameter: parsed.diameter || "",
		threadPitch: parsed.threadPitch || "",
		length: parsed.length || "",
		measurementSystem: parsed.measurementSystem || "",
		material: parsed.material || "",
		finish: parsed.finish || "",
		grade: parsed.grade || "",
		fastenerType: parsed.fastenerType || "",
		fastenerTypeCanonical: canonicalFastenerType || "",
		categoryCanonical: normalizedTaxonomy.category || "",
		subcategoryCanonical: normalizedTaxonomy.subcategory || "",
		fishbowlPartNum: product?.fishbowl?.partNum || "",
		fishbowlDescription: cleanText(product?.fishbowl?.description || ""),
		sku: product?.sku || "",
		internalPartNumber: product?.internalPartNumber || "",
	};
}

function buildSeo({ title = "", parsed = {}, product = null, existingSlug = "" }) {
	const slugBase =
		title ||
		product?.fishbowl?.description ||
		product?.fishbowl?.partNum ||
		product?.sku ||
		"product";

	const slug = existingSlug || slugify(slugBase);

	const metaTitle = cleanText(title || product?.fishbowl?.description || product?.sku || "Product");

	const metaDescription = cleanText(
		[
			title || "",
			parsed.finish || "",
			parsed.material || "",
			parsed.fastenerType || "",
		]
			.filter(Boolean)
			.join(" ")
	);

	return {
		slug,
		metaTitle,
		metaDescription: metaDescription || metaTitle,
		keywords: uniqueStrings([
			...(parsed.keywords || []),
			...(Array.isArray(product?.searchKeywords) ? product.searchKeywords : []),
		]),
		canonicalUrl: "",
	};
}

export async function createProductEnrichmentFromProduct(productId) {
	if (!productId) {
		throw new Error("productId is required");
	}

	const product = await Product.findById(productId);

	if (!product) {
		throw new Error("Product not found");
	}

	const existing = await ProductEnrichment.findOne({ productId: product._id });
	const parsed = product?.fishbowl?.raw?.parsedAttributes || {};

	const fallbackPartNum = cleanText(product?.fishbowl?.partNum || product?.sku || "");
	const normalizedTaxonomy = normalizeWebsiteTaxonomy(parsed, product);
	const canonicalFastenerType = canonicalizeFastenerType(
		parsed.fastenerType,
		normalizedTaxonomy.subcategory
	);

	const title = buildVariantTitle({
		product,
		fallbackPartNum,
	});

	const familyTitle = buildFamilyTitle({
		parsed,
		canonicalFastenerType,
	});

	const shortTitle = title;
	const shortDescription = buildShortDescription({
		title,
		product,
	});

	const description = buildDescription({
		title,
		parsed,
		product,
	});

	const bulletPoints = buildBulletPoints(parsed);
	const tags = buildTags({
		parsed,
		product,
		normalizedTaxonomy,
		canonicalFastenerType,
	});
	const attributes = buildAttributes(
		parsed,
		product,
		normalizedTaxonomy,
		canonicalFastenerType
	);
	const seo = buildSeo({
		title,
		parsed,
		product,
		existingSlug: existing?.seo?.slug || "",
	});

	if (!existing) {
		const enrichment = await ProductEnrichment.create({
			productId: product._id,
			title,
			shortTitle,
			description,
			shortDescription,
			bulletPoints,
			websiteBrand: product.brand || "",
			websiteVendor: product.vendor || "",
			category: normalizedTaxonomy.category,
			subcategory: normalizedTaxonomy.subcategory,
			tags,
			attributes: {
				...attributes,
				familyTitleBase: familyTitle,
			},
			images: [],
			seo,
			merchandising: {
				badge: "",
				featured: false,
				sortOrder: 0,
				collectionTags: [],
			},
			contentStatus: "auto-mapped",
			imageStatus: "none",
			overrideFlags: {
				lockTitle: false,
				lockDescription: false,
				lockImages: false,
				lockCategory: false,
			},
			notes: "Auto-generated from Fishbowl product data and parsed attributes.",
		});

		product.enrichmentId = enrichment._id;
		product.hasEnrichment = true;

		if (product.catalogStatus === "draft" || product.catalogStatus === "mapped") {
			product.catalogStatus = "enriched";
		}

		await product.save();

		return {
			action: "created",
			product,
			enrichment,
		};
	}

	const lockTitle = Boolean(existing?.overrideFlags?.lockTitle);
	const lockDescription = Boolean(existing?.overrideFlags?.lockDescription);
	const lockCategory = Boolean(existing?.overrideFlags?.lockCategory);

	if (!lockTitle) {
		existing.title = title;
		existing.shortTitle = shortTitle;
		existing.seo = {
			...(existing.seo?.toObject?.() || existing.seo || {}),
			...seo,
		};
	}

	if (!lockDescription) {
		existing.description = description;
		existing.shortDescription = shortDescription;
		existing.bulletPoints = bulletPoints;
	}

	if (!lockCategory) {
		existing.category = normalizedTaxonomy.category;
		existing.subcategory = normalizedTaxonomy.subcategory;
	}

	existing.websiteBrand = product.brand || existing.websiteBrand || "";
	existing.websiteVendor = product.vendor || existing.websiteVendor || "";
	existing.tags = tags;

	existing.attributes = {
		...(existing.attributes || {}),
		...attributes,
		familyTitleBase: familyTitle,
	};

	existing.contentStatus =
		existing.contentStatus === "approved" ? "approved" : "auto-mapped";

	if (!Array.isArray(existing.images)) {
		existing.images = [];
	}

	product.enrichmentId = existing._id;
	product.hasEnrichment = true;

	if (product.catalogStatus === "draft" || product.catalogStatus === "mapped") {
		product.catalogStatus = "enriched";
	}

	await existing.save();
	await product.save();

	return {
		action: "updated",
		product,
		enrichment: existing,
	};
}

export default createProductEnrichmentFromProduct;
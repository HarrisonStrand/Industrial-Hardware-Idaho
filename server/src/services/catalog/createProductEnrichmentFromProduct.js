// server/src/services/catalog/createProductEnrichmentFromProduct.js
import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import detectProductFamilyFromDescription from "./detectProductFamilyFromDescription.js";

function cleanText(value = "") {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim();
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

async function buildUniqueSlug({
	title = "",
	product = null,
	existingEnrichmentId = null,
}) {
	const baseFromTitle = slugify(title);
	const baseFromPart =
		slugify(product?.fishbowl?.partNum || "") || slugify(product?.sku || "");
	const fallbackBase = baseFromTitle || baseFromPart || "product";

	const candidates = uniqueStrings([
		fallbackBase,
		`${fallbackBase}-${slugify(product?.fishbowl?.partNum || "")}`,
		`${fallbackBase}-${slugify(product?.sku || "")}`,
		slugify(product?.fishbowl?.partNum || ""),
		slugify(product?.sku || ""),
	]).filter(Boolean);

	for (const candidate of candidates) {
		const existing = await ProductEnrichment.findOne({ "seo.slug": candidate })
			.select({ _id: 1, productId: 1 })
			.lean();

		if (!existing) return candidate;
		if (
			existingEnrichmentId &&
			String(existing._id) === String(existingEnrichmentId)
		) {
			return candidate;
		}
	}

	return `${fallbackBase}-${String(product?._id || "").slice(-6)}`;
}

function buildVariantTitle({ product = null, fallbackPartNum = "" }) {
	const fishbowlDescription = cleanText(
		product?.fishbowl?.description ||
			product?.fishbowl?.raw?.original?.description ||
			product?.fishbowl?.raw?.original?.partDescription ||
			product?.fishbowl?.raw?.original?.name ||
			"",
	);

	if (fishbowlDescription) return fishbowlDescription;
	if (fallbackPartNum) return fallbackPartNum;
	return "Untitled Product";
}

function buildShortDescription({ title = "", product = null }) {
	const partNum = product?.fishbowl?.partNum || product?.sku || "";
	return cleanText(`${title}${partNum ? ` (${partNum})` : ""}`.trim());
}

function buildDescription({ title = "", family = {}, product = null }) {
	const lines = [];

	if (title) {
		lines.push(
			`${title} is a catalog item imported from Fishbowl and prepared for ecommerce enrichment.`,
		);
	}

	const specBits = [
		family.washerStandard ? `Standard: ${family.washerStandard}` : "",
		family.size ? `Size: ${family.size}` : "",
		family.diameter ? `Diameter: ${family.diameter}` : "",
		family.insideDiameter ? `Inside Diameter: ${family.insideDiameter}` : "",
		family.outsideDiameter ? `Outside Diameter: ${family.outsideDiameter}` : "",
		family.thickness ? `Thickness: ${family.thickness}` : "",
		family.threadPitch ? `Thread Pitch: ${family.threadPitch}` : "",
		family.length ? `Length: ${family.length}` : "",
		family.material ? `Material: ${family.material}` : "",
		family.finish ? `Finish: ${family.finish}` : "",
		family.grade ? `Grade: ${family.grade}` : "",
		family.familyType ? `Type: ${family.familyType}` : "",
	].filter(Boolean);

	if (specBits.length > 0) {
		lines.push(`Detected specs include ${specBits.join(", ")}.`);
	}

	if (product?.fishbowl?.partNum) {
		lines.push(`Fishbowl part number: ${product.fishbowl.partNum}.`);
	}

	return cleanText(lines.join(" "));
}

function buildBulletPoints(family = {}) {
	return [
		family.washerStandard ? `Standard: ${family.washerStandard}` : "",
		family.size ? `Size: ${family.size}` : "",
		family.diameter ? `Diameter: ${family.diameter}` : "",
		family.insideDiameter ? `Inside Diameter: ${family.insideDiameter}` : "",
		family.outsideDiameter ? `Outside Diameter: ${family.outsideDiameter}` : "",
		family.thickness ? `Thickness: ${family.thickness}` : "",
		family.threadPitch ? `Thread Pitch: ${family.threadPitch}` : "",
		family.length ? `Length: ${family.length}` : "",
		family.material ? `Material: ${family.material}` : "",
		family.finish ? `Finish: ${family.finish}` : "",
		family.grade ? `Grade: ${family.grade}` : "",
		family.familyType ? `Type: ${family.familyType}` : "",
		family.measurementSystem
			? `Measurement System: ${family.measurementSystem}`
			: "",
		family.category ? `Category: ${family.category}` : "",
		family.subcategory ? `Subcategory: ${family.subcategory}` : "",
	].filter(Boolean);
}

function buildTags({ family = {}, product = null }) {
	return uniqueStrings([
		...(family.tags || []),
		family.category ? slugify(family.category) : "",
		family.subcategory ? slugify(family.subcategory) : "",
		family.familyType ? slugify(family.familyType) : "",
		family.washerStandard ? slugify(family.washerStandard) : "",
		family.finish ? slugify(family.finish) : "",
		family.material ? slugify(family.material) : "",
		family.grade ? slugify(family.grade) : "",
		...(Array.isArray(product?.searchKeywords)
			? product.searchKeywords.map(slugify)
			: []),
	]);
}

function buildAttributes({ family = {}, parsed = {}, product = null }) {
	return {
		size: family.size || parsed.size || "",
		diameter: family.diameter || parsed.diameter || "",
		insideDiameter:
			family.insideDiameter || parsed.insideDiameter || parsed.id || "",
		outsideDiameter:
			family.outsideDiameter || parsed.outsideDiameter || parsed.od || "",
		width: family.width || parsed.width || "",
		thickness: family.thickness || parsed.thickness || "",
		washerStandard:
			family.washerStandard ||
			parsed.washerStandard ||
			parsed.standard ||
			parsed.pattern ||
			"",
		washerType:
			family.washerType ||
			parsed.washerType ||
			parsed.type ||
			"",
		threadPitch: family.threadPitch || parsed.threadPitch || "",
		length: family.familyType?.includes("washer")
			? ""
			: family.length || parsed.length || "",
		measurementSystem:
			family.measurementSystem || parsed.measurementSystem || "",
		material: family.material || parsed.material || "",
		finish: family.finish || parsed.finish || "",
		displayMaterial:
			family.displayMaterial || family.material || family.finish || "",
		displayFinish:
			family.displayFinish || family.finish || family.material || "",
		materialFinish:
			family.materialFinish ||
			family.displayMaterial ||
			family.displayFinish ||
			family.material ||
			family.finish ||
			"",
		grade: family.grade || parsed.grade || "",
		fastenerType: family.familyType || parsed.fastenerType || "",
		fastenerTypeCanonical: family.familyType || parsed.fastenerType || "",
		categoryCanonical: family.category || parsed.category || "",
		subcategoryCanonical: family.subcategory || parsed.subcategory || "",
		familyType: family.familyType || "",
		familyKey: family.familyKey || "",
		familySlug: family.familySlug || "",
		familyTitle: family.familyTitle || "",
		fishbowlPartNum: product?.fishbowl?.partNum || "",
		fishbowlDescription: cleanText(product?.fishbowl?.description || ""),
		sku: product?.sku || "",
		internalPartNumber: product?.internalPartNumber || "",
	};
}

function buildSeo({ title = "", product = null, slug = "" }) {
	const metaTitle = cleanText(
		title || product?.fishbowl?.description || product?.sku || "Product",
	);

	return {
		slug,
		metaTitle,
		metaDescription: metaTitle,
		keywords: uniqueStrings(
			Array.isArray(product?.searchKeywords) ? product.searchKeywords : [],
		),
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

	const fallbackPartNum = cleanText(
		product?.fishbowl?.partNum || product?.sku || "",
	);
	const family = detectProductFamilyFromDescription({
		product,
		parsed,
	});

	const title = buildVariantTitle({
		product,
		fallbackPartNum,
	});

	const shortTitle = title;
	const shortDescription = buildShortDescription({
		title,
		product,
	});

	const description = buildDescription({
		title,
		family,
		product,
	});

	const bulletPoints = buildBulletPoints(family);
	const tags = buildTags({
		family,
		product,
	});

	const attributes = buildAttributes({
		family,
		parsed,
		product,
	});

	const uniqueSlug = await buildUniqueSlug({
		title,
		product,
		existingEnrichmentId: existing?._id || null,
	});

	const seo = buildSeo({
		title,
		product,
		slug: existing?.seo?.slug || uniqueSlug,
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
			category: family.category || "uncategorized",
			subcategory: family.subcategory || "needs classification",
			tags,
			attributes: {
				...attributes,
				familyTitleBase: family.familyTitle || "Catalog Family",
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
			quality: {
				builderReady: false,
				renderable: false,
				publishReady: false,
				completenessScore: 0,
				missingRequiredAttributes: [],
				missingRecommendedAttributes: [],
				issues: [],
				suggestedFamilyKey: family.familyKey || "",
				suggestedFamilyConfidence: 0,
				similarFamilies: [],
				lastEvaluatedAt: null,
			},
			overrideFlags: {
				lockTitle: false,
				lockDescription: false,
				lockImages: false,
				lockCategory: false,
			},
			notes:
				"Auto-generated from Fishbowl product data and generalized family detection.",
		});

		product.enrichmentId = enrichment._id;
		product.hasEnrichment = true;

		if (
			product.catalogStatus === "draft" ||
			product.catalogStatus === "mapped"
		) {
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
		existing.category = family.category || "uncategorized";
		existing.subcategory = family.subcategory || "needs classification";
	}

	existing.websiteBrand = product.brand || existing.websiteBrand || "";
	existing.websiteVendor = product.vendor || existing.websiteVendor || "";
	existing.tags = tags;

	existing.attributes = {
		...(existing.attributes || {}),
		...attributes,
		familyTitleBase: family.familyTitle || "Catalog Family",
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

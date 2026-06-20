import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATEGORIES_PATH = path.resolve(__dirname, "../catalog/categories.json");

const PRODUCT_SEARCH_FIELDS = [
	"fishbowl.partNum",
	"sku",
	"internalPartNumber",
	"fishbowl.description",
	"brand",
	"vendor",
];

const ENRICHMENT_SEARCH_FIELDS = [
	"title",
	"shortTitle",
	"description",
	"shortDescription",
	"category",
	"subcategory",
	"tags",
	"seo.slug",
	"seo.metaTitle",
	"seo.metaDescription",
	"seo.keywords",
	"attributes.fishbowlPartNum",
	"attributes.fishbowlDescription",
	"attributes.sku",
	"attributes.internalPartNumber",
	"attributes.familyType",
	"attributes.familyTitle",
	"attributes.fastenerType",
	"attributes.fastenerTypeCanonical",
	"attributes.material",
	"attributes.finish",
	"attributes.displayMaterial",
	"attributes.displayFinish",
	"attributes.materialFinish",
	"attributes.grade",
	"attributes.measurementSystem",
	"attributes.size",
	"attributes.diameter",
	"attributes.length",
	"attributes.width",
	"attributes.thickness",
	"attributes.threadPitch",
	"attributes.threadSeries",
	"attributes.thread_series",
	"attributes.threadCoverage",
	"attributes.driveType",
	"attributes.drive_type",
	"attributes.headType",
	"attributes.washerStandard",
	"attributes.washerType",
];

const ATTRIBUTE_SUMMARY_KEYS = [
	"size",
	"diameter",
	"threadPitch",
	"threadSeries",
	"thread_series",
	"length",
	"width",
	"thickness",
	"materialFinish",
	"material",
	"finish",
	"grade",
	"measurementSystem",
	"washerStandard",
	"washerType",
	"fastenerType",
	"fastenerTypeCanonical",
	"headType",
	"driveType",
	"drive_type",
];

function clean(value = "") {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim();
}

function escapeRegex(value = "") {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value = "") {
	return clean(value)
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function normalizeText(value = "") {
	return clean(value)
		.toLowerCase()
		.replace(/[“”]/g, '"')
		.replace(/[×]/g, "x");
}

function normalizeLoose(value = "") {
	return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function uniqueStrings(values = []) {
	return [...new Set(values.filter(Boolean).map((value) => clean(value)))];
}

function getQueryTerms(query = "") {
	return uniqueStrings(
		normalizeText(query)
			.replace(/[()\[\]{},]/g, " ")
			.split(/\s+/)
			.map((term) => term.trim())
			.filter((term) => term.length >= 2),
	).slice(0, 6);
}

function buildRegexes(query = "") {
	const trimmed = clean(query);
	const terms = getQueryTerms(trimmed);
	return uniqueStrings([trimmed, ...terms])
		.slice(0, 7)
		.map((term) => new RegExp(escapeRegex(term), "i"));
}

function buildOrRegexQuery(fields = [], regexes = []) {
	const clauses = [];
	for (const regex of regexes) {
		for (const field of fields) {
			clauses.push({ [field]: regex });
		}
	}
	return clauses;
}

function loadCategoryData() {
	try {
		return JSON.parse(fs.readFileSync(CATEGORIES_PATH, "utf8"));
	} catch (error) {
		console.error("Failed to load category search data:", error.message);
		return { categories: [] };
	}
}

function scoreTextAgainstQuery(value = "", query = "", terms = []) {
	const text = normalizeText(value);
	const looseText = normalizeLoose(value);
	const normalizedQuery = normalizeText(query);
	const looseQuery = normalizeLoose(query);

	if (!text || !normalizedQuery) return 0;
	if (text === normalizedQuery || looseText === looseQuery) return 100;
	if (text.startsWith(normalizedQuery) || looseText.startsWith(looseQuery)) return 85;
	if (text.includes(normalizedQuery) || looseText.includes(looseQuery)) return 70;

	const matchedTerms = terms.filter((term) => {
		const looseTerm = normalizeLoose(term);
		return text.includes(term) || (looseTerm && looseText.includes(looseTerm));
	});

	if (!matchedTerms.length) return 0;
	return Math.min(60, 20 + matchedTerms.length * 10);
}

function scoreProductResult({ product, enrichment, query, terms }) {
	const attrs = enrichment?.attributes || {};
	const partNumber = product?.fishbowl?.partNum || product?.sku || "";
	const sku = product?.sku || "";
	const internalPartNumber = product?.internalPartNumber || "";
	const fishbowlDescription = product?.fishbowl?.description || "";
	const title = enrichment?.title || enrichment?.shortTitle || "";
	const description = enrichment?.description || enrichment?.shortDescription || "";
	const category = enrichment?.category || "";
	const subcategory = enrichment?.subcategory || "";
	const tags = Array.isArray(enrichment?.tags) ? enrichment.tags.join(" ") : "";
	const keywords = Array.isArray(enrichment?.seo?.keywords)
		? enrichment.seo.keywords.join(" ")
		: "";
	const attributeText = ATTRIBUTE_SUMMARY_KEYS.map((key) => attrs?.[key])
		.filter(Boolean)
		.join(" ");

	const scores = [
		scoreTextAgainstQuery(partNumber, query, terms) + 25,
		scoreTextAgainstQuery(sku, query, terms) + 20,
		scoreTextAgainstQuery(internalPartNumber, query, terms) + 15,
		scoreTextAgainstQuery(title, query, terms) + 5,
		scoreTextAgainstQuery(fishbowlDescription, query, terms),
		scoreTextAgainstQuery(description, query, terms),
		scoreTextAgainstQuery(attributeText, query, terms),
		scoreTextAgainstQuery(`${category} ${subcategory}`, query, terms) - 5,
		scoreTextAgainstQuery(`${tags} ${keywords}`, query, terms) - 5,
	];

	return Math.max(0, ...scores);
}

function getMatchLabel({ product, enrichment, query, terms }) {
	const attrs = enrichment?.attributes || {};
	const checks = [
		{ label: "Part number", value: product?.fishbowl?.partNum || product?.sku || "" },
		{ label: "SKU", value: product?.sku || "" },
		{ label: "Description", value: product?.fishbowl?.description || "" },
		{ label: "Title", value: enrichment?.title || enrichment?.shortTitle || "" },
		{
			label: "Specs",
			value: ATTRIBUTE_SUMMARY_KEYS.map((key) => attrs?.[key]).filter(Boolean).join(" "),
		},
		{ label: "Category", value: `${enrichment?.category || ""} ${enrichment?.subcategory || ""}` },
	];

	for (const check of checks) {
		if (scoreTextAgainstQuery(check.value, query, terms) > 0) return check.label;
	}

	return "Product";
}

function getProductImage(enrichment = {}) {
	return (
		enrichment?.images?.find((image) => image?.isPrimary)?.url ||
		enrichment?.images?.[0]?.url ||
		""
	);
}

function buildAttributeSummary(attributes = {}) {
	const parts = [];
	const sizeBits = [
		attributes.diameter,
		attributes.threadPitch ? `-${attributes.threadPitch}` : "",
		attributes.length ? `x ${attributes.length}` : "",
	]
		.filter(Boolean)
		.join(" ")
		.replace(/\s+-/, "-");

	if (attributes.size) parts.push(attributes.size);
	else if (sizeBits) parts.push(sizeBits);

	if (attributes.grade) parts.push(attributes.grade);
	if (attributes.materialFinish) parts.push(attributes.materialFinish);
	else if (attributes.material || attributes.finish) {
		parts.push([attributes.material, attributes.finish].filter(Boolean).join(" / "));
	}

	return uniqueStrings(parts).slice(0, 4);
}

function buildProductPath(product = {}, enrichment = {}) {
	const categoryId = slugify(enrichment?.category || enrichment?.attributes?.categoryCanonical || "");
	const subcategoryId = slugify(
		enrichment?.subcategory || enrichment?.attributes?.subcategoryCanonical || "",
	);
	const slug = clean(enrichment?.seo?.slug || "");

	if (slug) return `/catalog/product/${slug}`;
	if (categoryId && subcategoryId) return `/products/${categoryId}/${subcategoryId}`;
	return "/products";
}

function mapProductResult({ product, enrichment, query, terms }) {
	const attrs = enrichment?.attributes || {};
	const score = scoreProductResult({ product, enrichment, query, terms });

	return {
		type: "product",
		score,
		productId: String(product?._id || ""),
		enrichmentId: String(enrichment?._id || ""),
		title:
			enrichment?.title ||
			enrichment?.shortTitle ||
			product?.fishbowl?.description ||
			product?.fishbowl?.partNum ||
			product?.sku ||
			"Product",
		partNumber: product?.fishbowl?.partNum || product?.sku || "",
		sku: product?.sku || "",
		description:
			enrichment?.shortDescription ||
			product?.fishbowl?.description ||
			enrichment?.description ||
			"",
		category: enrichment?.category || "",
		subcategory: enrichment?.subcategory || "",
		image: getProductImage(enrichment),
		path: buildProductPath(product, enrichment),
		matchLabel: getMatchLabel({ product, enrichment, query, terms }),
		attributes: buildAttributeSummary(attrs),
		qtyAvailable: Number(product?.inventory?.qtyAvailable || 0),
		isPublished: !!product?.isPublished,
		catalogStatus: product?.catalogStatus || "",
	};
}

function scoreBuilder({ category, subcategory = null, query, terms }) {
	const categoryText = `${category?.name || ""} ${category?.id || ""}`;
	const subcategoryText = subcategory
		? `${subcategory?.name || ""} ${subcategory?.id || ""}`
		: "";

	const categoryScore = scoreTextAgainstQuery(categoryText, query, terms);
	const subcategoryScore = subcategory
		? scoreTextAgainstQuery(subcategoryText, query, terms) + 10
		: 0;

	return Math.max(categoryScore, subcategoryScore);
}

function searchBuilders(query = "", limit = 8) {
	const data = loadCategoryData();
	const terms = getQueryTerms(query);
	const results = [];

	for (const category of data.categories || []) {
		const categoryScore = scoreBuilder({ category, query, terms });
		if (categoryScore > 0) {
			results.push({
				type: "builder",
				resultType: "category",
				score: categoryScore,
				categoryId: category.id || "",
				name: category.name || category.id || "Category",
				label: category.name || category.id || "Category",
				image: category.image || "",
				path: `/products?category=${encodeURIComponent(category.id || "")}`,
				matchLabel: "Category",
			});
		}

		for (const subcategory of category.subcategories || []) {
			const subcategoryScore = scoreBuilder({ category, subcategory, query, terms });
			if (subcategoryScore <= 0) continue;

			results.push({
				type: "builder",
				resultType: "subcategory",
				score: subcategoryScore,
				categoryId: category.id || "",
				subcategoryId: subcategory.id || "",
				name: subcategory.name || subcategory.id || "Builder",
				label: `${category.name || category.id} / ${subcategory.name || subcategory.id}`,
				image: subcategory.image || category.image || "",
				path: `/products/${category.id}/${subcategory.id}`,
				matchLabel: "Builder",
			});
		}
	}

	const deduped = new Map();
	for (const result of results) {
		const key = result.path;
		const existing = deduped.get(key);
		if (!existing || existing.score < result.score) deduped.set(key, result);
	}

	return Array.from(deduped.values())
		.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
		.slice(0, limit);
}

async function searchProducts(query = "", options = {}) {
	const limit = Math.min(50, Math.max(1, Number(options.limit || 8)));
	const candidateLimit = Math.min(500, Math.max(limit * 8, 80));
	const regexes = buildRegexes(query);
	const terms = getQueryTerms(query);

	if (!regexes.length) return [];

	const productQuery = {
		isPublished: true,
		isActive: { $ne: false },
		"fishbowl.active": { $ne: false },
		$or: buildOrRegexQuery(PRODUCT_SEARCH_FIELDS, regexes),
	};

	const enrichmentQuery = {
		$or: buildOrRegexQuery(ENRICHMENT_SEARCH_FIELDS, regexes),
	};

	const [matchingProducts, matchingEnrichments] = await Promise.all([
		Product.find(productQuery)
			.select({
				_id: 1,
				sku: 1,
				internalPartNumber: 1,
				fishbowl: 1,
				inventory: 1,
				isActive: 1,
				isPublished: 1,
				catalogStatus: 1,
			})
			.limit(candidateLimit)
			.lean(),
		ProductEnrichment.find(enrichmentQuery)
			.select({
				_id: 1,
				productId: 1,
				title: 1,
				shortTitle: 1,
				description: 1,
				shortDescription: 1,
				category: 1,
				subcategory: 1,
				tags: 1,
				attributes: 1,
				images: 1,
				seo: 1,
			})
			.limit(candidateLimit)
			.lean(),
	]);

	const productIdSet = new Set([
		...matchingProducts.map((product) => String(product._id)),
		...matchingEnrichments.map((enrichment) => String(enrichment.productId)),
	]);

	if (!productIdSet.size) return [];

	const productIds = Array.from(productIdSet);
	const [products, enrichments] = await Promise.all([
		Product.find({
			_id: { $in: productIds },
			isPublished: true,
			isActive: { $ne: false },
			"fishbowl.active": { $ne: false },
		})
			.select({
				_id: 1,
				sku: 1,
				internalPartNumber: 1,
				fishbowl: 1,
				inventory: 1,
				isActive: 1,
				isPublished: 1,
				catalogStatus: 1,
			})
			.lean(),
		ProductEnrichment.find({ productId: { $in: productIds } })
			.select({
				_id: 1,
				productId: 1,
				title: 1,
				shortTitle: 1,
				description: 1,
				shortDescription: 1,
				category: 1,
				subcategory: 1,
				tags: 1,
				attributes: 1,
				images: 1,
				seo: 1,
			})
			.lean(),
	]);

	const productMap = new Map(products.map((product) => [String(product._id), product]));
	const enrichmentMap = new Map(
		enrichments.map((enrichment) => [String(enrichment.productId), enrichment]),
	);

	return productIds
		.map((productId) => {
			const product = productMap.get(productId);
			const enrichment = enrichmentMap.get(productId);
			if (!product || !enrichment) return null;
			return mapProductResult({ product, enrichment, query, terms });
		})
		.filter((result) => result && result.score > 0)
		.sort(
			(a, b) =>
				b.score - a.score ||
				String(a.partNumber || "").localeCompare(String(b.partNumber || ""), undefined, {
					numeric: true,
					sensitivity: "base",
				}),
		)
		.slice(0, limit);
}

export async function globalSearch(options = {}) {
	const query = clean(options.query || "");
	const productLimit = Math.min(50, Math.max(0, Number(options.productLimit ?? 8)));
	const builderLimit = Math.min(25, Math.max(0, Number(options.builderLimit ?? 6)));

	if (query.length < 2) {
		return {
			query,
			products: [],
			builders: [],
			totals: {
				products: 0,
				builders: 0,
			},
		};
	}

	const [products, builders] = await Promise.all([
		productLimit > 0 ? searchProducts(query, { limit: productLimit }) : [],
		builderLimit > 0 ? searchBuilders(query, builderLimit) : [],
	]);

	return {
		query,
		products,
		builders,
		totals: {
			products: products.length,
			builders: builders.length,
		},
	};
}

export default globalSearch;

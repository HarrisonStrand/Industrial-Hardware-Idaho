import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "./evaluateProductPublishReadiness.js";
import publishProduct from "./publishProduct.js";
import { catalogNamePattern } from "./getCatalogBuilderSubcategory.js";

// Admin bulk publish (site review, 2026-10-13). The admin picks products by a pasted list
// of part numbers, an enrichment batch, or a category page; "Check" reports what
// would happen without saving anything, and "Publish" runs the normal single-product
// publish for each one. Publishing is always the admin's own action.

export const BULK_PUBLISH_LIMIT = 2000;

const PRODUCT_FIELDS = {
	_id: 1,
	sku: 1,
	internalPartNumber: 1,
	isPublished: 1,
	isActive: 1,
	"fishbowl.partNum": 1,
	"fishbowl.active": 1,
	"fishbowl.description": 1,
};

function cleanList(values = []) {
	const list = Array.isArray(values) ? values : String(values || "").split(/\r?\n/);
	return [...new Set(list.map((value) => String(value || "").trim()).filter(Boolean))];
}

function pageId(value = "") {
	return String(value || "").trim().toLowerCase().replace(/-/g, " ");
}

function partNumberOf(product = {}) {
	return product?.fishbowl?.partNum || product?.internalPartNumber || product?.sku || String(product?._id || "");
}

// Turns the admin's choice into products. Returns { products, notFound, source }.
export async function resolveBulkPublishTargets({ partNumbers = [], batchId = "", category = "", subcategory = "" } = {}) {
	const numbers = cleanList(partNumbers);
	// One batch id or several, separated by commas or spaces: "B-001, B-002".
	const batches = [...new Set(String(batchId || "").split(/[\s,]+/).map((id) => id.trim()).filter(Boolean))];
	const cat = pageId(category);
	const sub = pageId(subcategory);

	if (numbers.length) {
		const products = await Product.find(
			{ $or: [{ sku: { $in: numbers } }, { internalPartNumber: { $in: numbers } }, { "fishbowl.partNum": { $in: numbers } }] },
			PRODUCT_FIELDS,
		).lean();
		const seen = new Set();
		for (const product of products) {
			for (const value of [product.sku, product.internalPartNumber, product?.fishbowl?.partNum]) {
				if (value) seen.add(String(value).trim());
			}
		}
		return { products, notFound: numbers.filter((number) => !seen.has(number)), source: "list" };
	}

	let enrichmentFilter = null;
	let source = "";
	if (batches.length) {
		// Only rows that have been promoted to the live fields; a staged draft is not ready to publish.
		enrichmentFilter = { "agentDraft.batchId": { $in: batches }, "agentDraft.status": "promoted" };
		source = "batch";
	} else if (cat && sub) {
		enrichmentFilter = {
			category: new RegExp(catalogNamePattern(cat), "i"),
			subcategory: new RegExp(catalogNamePattern(sub), "i"),
		};
		source = "page";
	} else {
		throw new Error("Give part numbers, a batch id, or a category and subcategory.");
	}

	const enrichments = await ProductEnrichment.find(enrichmentFilter, { productId: 1 }).lean();
	const productIds = enrichments.map((enrichment) => enrichment.productId).filter(Boolean);
	const products = await Product.find({ _id: { $in: productIds } }, PRODUCT_FIELDS).lean();
	return { products, notFound: [], source };
}

function blockedReason(readiness = {}) {
	const errors = (readiness.issues || []).filter((issue) => issue?.severity === "error");
	const messages = (errors.length ? errors : readiness.issues || []).map((issue) => issue?.message || issue?.code).filter(Boolean);
	if (messages.length) return messages.join("; ");
	if ((readiness.missingRequiredAttributes || []).length) {
		return `Missing required attributes: ${readiness.missingRequiredAttributes.join(", ")}`;
	}
	return "Not publish-ready";
}

// dryRun true: report only, nothing is saved. dryRun false: publish every row that passes.
export async function bulkPublishProducts(input = {}, { dryRun = true, actor = null } = {}) {
	const { products, notFound, source } = await resolveBulkPublishTargets(input);

	if (products.length > BULK_PUBLISH_LIMIT) {
		throw new Error(`That selection has ${products.length} products; the limit is ${BULK_PUBLISH_LIMIT} per run.`);
	}

	const rows = notFound.map((partNumber) => ({ partNumber, outcome: "not-found", reason: "No product with this part number" }));

	// The website title of each product, so the list shows what will appear on the site.
	const titles = new Map(
		(await ProductEnrichment.find({ productId: { $in: products.map((product) => product._id) } }, { productId: 1, title: 1 }).lean())
			.map((enrichment) => [String(enrichment.productId), enrichment.title || ""]),
	);

	for (const product of products) {
		const partNumber = partNumberOf(product);
		const productId = String(product._id);
		const described = { description: product?.fishbowl?.description || "", title: titles.get(productId) || "" };

		if (product.isPublished) {
			rows.push({ productId, partNumber, ...described, outcome: "already-published" });
			continue;
		}
		if (product.isActive === false || product?.fishbowl?.active === false) {
			rows.push({ productId, partNumber, ...described, outcome: "inactive", reason: "Product is inactive" });
			continue;
		}

		try {
			if (dryRun) {
				const readiness = await evaluateProductPublishReadiness(product._id, { includeSimilarFamilies: false });
				rows.push(
					readiness.isReady
						? { productId, partNumber, ...described, outcome: "would-publish" }
						: { productId, partNumber, ...described, outcome: "blocked", reason: blockedReason(readiness) },
				);
			} else {
				const result = await publishProduct(product._id, actor);
				rows.push(
					result.action === "published"
						? { productId, partNumber, ...described, outcome: "published" }
						: { productId, partNumber, ...described, outcome: "blocked", reason: result.message || blockedReason(result.readiness) },
				);
			}
		} catch (err) {
			rows.push({ productId, partNumber, ...described, outcome: "failed", reason: err.message || "Failed" });
		}
	}

	const counts = rows.reduce((acc, row) => ({ ...acc, [row.outcome]: (acc[row.outcome] || 0) + 1 }), {});
	return { dryRun, source, total: rows.length, counts, rows };
}

export default bulkPublishProducts;

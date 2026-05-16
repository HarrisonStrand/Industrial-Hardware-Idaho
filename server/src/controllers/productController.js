// server/src/controllers/productController.js
import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";
import publishProduct from "../services/catalog/publishProduct.js";

function safeObject(value) {
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: {};
}

function normalizeQueryValue(value = "") {
	return String(value || "").trim();
}

function escapeRegex(value = "") {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapReviewStatusFromReadiness(readiness = {}, product = {}) {
	if (product?.isPublished) return "published";
	if (product?.review?.status === "approved") return "approved";
	if (readiness?.publishReady) return "ready";
	return "needs-review";
}

async function recomputeAndPersist(productId, userId = null) {
	const readiness = await evaluateProductPublishReadiness(productId);

	const product = await Product.findById(productId);
	const enrichment = await ProductEnrichment.findOne({ productId });

	if (!product || !enrichment) {
		throw new Error("Product or enrichment not found");
	}

	const nextStatus = mapReviewStatusFromReadiness(readiness, product);

	product.review = {
		...(product.review?.toObject?.() || product.review || {}),
		status: nextStatus,
		issues: readiness.issues,
		missingRequiredAttributes: readiness.missingRequiredAttributes,
		missingRecommendedAttributes: readiness.missingRecommendedAttributes,
		renderable: readiness.renderable,
		publishReady: readiness.publishReady,
		qualityScore: readiness.qualityScore,
		suggestedFamilyKey: readiness.suggestedFamilyKey || "",
		reviewedBy: userId || product?.review?.reviewedBy || null,
		reviewedAt: new Date(),
	};

	product.needsReview = nextStatus === "needs-review";
	product.catalogStatus = product.isPublished
		? "published"
		: readiness.publishReady
			? "ready"
			: "enriched";

	enrichment.quality = {
		...(enrichment.quality?.toObject?.() || enrichment.quality || {}),
		builderReady: readiness.builderReady,
		renderable: readiness.renderable,
		publishReady: readiness.publishReady,
		completenessScore: readiness.qualityScore,
		missingRequiredAttributes: readiness.missingRequiredAttributes,
		missingRecommendedAttributes: readiness.missingRecommendedAttributes,
		issues: readiness.issues,
		similarFamilies: readiness.similarFamilyCandidates.map((candidate) => ({
			familyKey: candidate.familyKey || "",
			familyTitle: candidate.familyTitle || "",
			confidence: candidate.confidence || 0,
			reasons:
				candidate.reasons || (candidate.reason ? [candidate.reason] : []),
		})),
		suggestedFamilyKey: readiness.suggestedFamilyKey || "",
		suggestedFamilyConfidence: readiness.suggestedFamilyConfidence || 0,
		lastEvaluatedAt: new Date(),
	};

	await product.save();
	await enrichment.save();

	return {
		product,
		enrichment,
		readiness,
	};
}

async function patchAdminProductById(
	productId,
	productPayload = {},
	enrichmentPayload = {},
	userId = null,
) {
	const product = await Product.findById(productId);
	const enrichment = await ProductEnrichment.findOne({ productId });

	if (!product || !enrichment) {
		throw new Error("Product or enrichment not found");
	}

	const safeProductPayload = safeObject(productPayload);
	const safeEnrichmentPayload = safeObject(enrichmentPayload);

	if (Object.prototype.hasOwnProperty.call(safeProductPayload, "isActive")) {
		product.isActive = Boolean(safeProductPayload.isActive);
	}

	if (safeProductPayload.brand !== undefined) {
		product.brand = String(safeProductPayload.brand || "");
	}

	if (safeProductPayload.vendor !== undefined) {
		product.vendor = String(safeProductPayload.vendor || "");
	}

	if (safeProductPayload.pricing) {
		const pricing = safeObject(safeProductPayload.pricing);
		if (Object.prototype.hasOwnProperty.call(pricing, "basePrice")) {
			product.pricing.basePrice =
				pricing.basePrice === null || pricing.basePrice === ""
					? null
					: Number(pricing.basePrice);
		}
		if (Object.prototype.hasOwnProperty.call(pricing, "salePrice")) {
			product.pricing.salePrice =
				pricing.salePrice === null || pricing.salePrice === ""
					? null
					: Number(pricing.salePrice);
		}
		product.pricing.priceSource = "manual";
	}

	const assignString = (key) => {
		if (Object.prototype.hasOwnProperty.call(safeEnrichmentPayload, key)) {
			enrichment[key] = String(safeEnrichmentPayload[key] || "");
		}
	};

	assignString("title");
	assignString("shortTitle");
	assignString("shortDescription");
	assignString("description");
	assignString("category");
	assignString("subcategory");
	assignString("websiteBrand");
	assignString("websiteVendor");
	assignString("notes");

	if (Array.isArray(safeEnrichmentPayload.tags)) {
		enrichment.tags = safeEnrichmentPayload.tags
			.map((item) => String(item || "").trim())
			.filter(Boolean);
	}

	if (
		safeEnrichmentPayload.attributes &&
		typeof safeEnrichmentPayload.attributes === "object"
	) {
		enrichment.attributes = {
			...(enrichment.attributes || {}),
			...safeObject(safeEnrichmentPayload.attributes),
		};
	}

	if (
		safeEnrichmentPayload.seo &&
		typeof safeEnrichmentPayload.seo === "object"
	) {
		enrichment.seo = {
			...(enrichment.seo?.toObject?.() || enrichment.seo || {}),
			...safeObject(safeEnrichmentPayload.seo),
		};
	}

	if (enrichment.contentStatus !== "approved") {
		enrichment.contentStatus = "ready-review";
	}

	product.needsReview = true;
	product.isCurated = true;

	await product.save();
	await enrichment.save();

	return recomputeAndPersist(productId, userId);
}

async function performBulkAction(
	action,
	productId,
	userId,
	productPayload = {},
	enrichmentPayload = {},
) {
	switch (action) {
		case "patch": {
			const result = await patchAdminProductById(
				productId,
				productPayload,
				enrichmentPayload,
				userId,
			);
			return {
				success: true,
				action,
				productId,
				reviewStatus: result?.product?.review?.status || "needs-review",
			};
		}
		case "approve": {
			const result = await recomputeAndPersist(productId, userId);
			if (!result.readiness.publishReady)
				throw new Error("Product is not ready for approval");
			result.product.review = {
				...(result.product.review?.toObject?.() || result.product.review || {}),
				status: "approved",
				approvedBy: userId || null,
				approvedAt: new Date(),
			};
			result.product.needsReview = false;
			result.product.catalogStatus = "ready";
			if (result.enrichment.contentStatus !== "approved")
				result.enrichment.contentStatus = "approved";
			await result.product.save();
			await result.enrichment.save();
			return { success: true, action, productId };
		}
		case "publish": {
			const result = await publishProduct(productId, userId);
			if (result.action === "blocked")
				throw new Error(result.message || "Publish blocked");
			return { success: true, action, productId };
		}
		case "unpublish": {
			const product = await Product.findById(productId);
			const enrichment = await ProductEnrichment.findOne({ productId });
			if (!product || !enrichment)
				throw new Error("Product or enrichment not found");
			product.isPublished = false;
			product.catalogStatus = "ready";
			product.review = {
				...(product.review?.toObject?.() || product.review || {}),
				status: "approved",
			};
			await product.save();
			await enrichment.save();
			return { success: true, action, productId };
		}
		case "recompute": {
			await recomputeAndPersist(productId, userId);
			return { success: true, action, productId };
		}
		case "delete": {
			const product = await Product.findById(productId);
			if (!product) throw new Error("Not found");
			await ProductEnrichment.deleteOne({ productId: product._id });
			await Product.findByIdAndDelete(product._id);
			return {
				success: true,
				action,
				productId,
				deletedPartNumber: product?.fishbowl?.partNum || product?.sku || "",
			};
		}
		default:
			throw new Error("Unsupported bulk action");
	}
}

function buildStatusProductFilter(status = "") {
	const normalizedStatus = normalizeQueryValue(status) || "needs-review";

	if (normalizedStatus === "published") {
		return { isPublished: true };
	}

	if (normalizedStatus === "needs-review") {
		return {
			isPublished: false,
			$or: [
				{ "review.status": "needs-review" },
				{ "review.status": { $exists: false } },
				{ review: { $exists: false } },
			],
		};
	}

	return {
		isPublished: false,
		"review.status": normalizedStatus,
	};
}

async function buildFilteredAdminRows({
	status = "needs-review",
	search = "",
	category = "",
	subcategory = "",
	familyType = "",
	issueCode = "",
	publishReady = "",
	renderable = "",
	page = 1,
	limit = 25,
}) {
	const safePage = Math.max(1, Number(page) || 1);
	const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
	const skip = (safePage - 1) * safeLimit;

	const productFilter = buildStatusProductFilter(status);

	if (publishReady === "true") {
		productFilter["review.publishReady"] = true;
	} else if (publishReady === "false") {
		productFilter["review.publishReady"] = false;
	}

	if (renderable === "true") {
		productFilter["review.renderable"] = true;
	} else if (renderable === "false") {
		productFilter["review.renderable"] = false;
	}

	if (issueCode) {
		productFilter["review.issues.code"] = normalizeQueryValue(issueCode);
	}

	const enrichmentFilter = {};
	if (category) enrichmentFilter.category = normalizeQueryValue(category);
	if (subcategory)
		enrichmentFilter.subcategory = normalizeQueryValue(subcategory);
	if (familyType)
		enrichmentFilter["attributes.familyType"] = normalizeQueryValue(familyType);

	if (search) {
		const regex = new RegExp(escapeRegex(normalizeQueryValue(search)), "i");
		enrichmentFilter.$or = [
			{ title: regex },
			{ shortTitle: regex },
			{ category: regex },
			{ subcategory: regex },
			{ "attributes.familyType": regex },
			{ "attributes.fishbowlPartNum": regex },
			{ tags: regex },
			{ "seo.slug": regex },
		];
	}

	const enrichmentRows = await ProductEnrichment.find(enrichmentFilter)
		.select({
			_id: 1,
			productId: 1,
			title: 1,
			shortTitle: 1,
			category: 1,
			subcategory: 1,
			attributes: 1,
			seo: 1,
		})
		.lean();

	const filteredProductIds = enrichmentRows.map((row) => row.productId);

	if (!filteredProductIds.length) {
		return {
			items: [],
			totalItems: 0,
			totalPages: 0,
			page: safePage,
			limit: safeLimit,
		};
	}

	productFilter._id = { $in: filteredProductIds };

	const totalItems = await Product.countDocuments(productFilter);

	const products = await Product.find(productFilter)
		.sort({ updatedAt: -1, createdAt: -1 })
		.skip(skip)
		.limit(safeLimit)
		.lean();

	const pageProductIds = products.map((item) => item._id);

	const pageEnrichments = enrichmentRows.filter((row) =>
		pageProductIds.some((id) => String(id) === String(row.productId)),
	);

	const enrichmentMap = new Map(
		pageEnrichments.map((item) => [String(item.productId), item]),
	);

	const items = products.map((product) => {
		const enrichment = enrichmentMap.get(String(product._id));

		return {
			productId: product._id,
			enrichmentId: enrichment?._id || null,
			sku: product?.sku || "",
			partNumber: product?.fishbowl?.partNum || product?.sku || "",
			title:
				enrichment?.title ||
				product?.fishbowl?.description ||
				product?.fishbowl?.partNum ||
				product?.sku ||
				"",
			reviewStatus: product?.review?.status || "needs-review",
			qualityScore: product?.review?.qualityScore || 0,
			renderable: !!product?.review?.renderable,
			publishReady: !!product?.review?.publishReady,
			isPublished: !!product?.isPublished,
			category: enrichment?.category || "",
			subcategory: enrichment?.subcategory || "",
			familyType: enrichment?.attributes?.familyType || "",
			issueCodes: Array.isArray(product?.review?.issues)
				? product.review.issues.map((issue) => issue?.code).filter(Boolean)
				: [],
		};
	});

	return {
		items,
		totalItems,
		totalPages: Math.ceil(totalItems / safeLimit),
		page: safePage,
		limit: safeLimit,
	};
}

export const listProducts = async (req, res) => {
	try {
		const { q } = req.query;

		const filter = {};
		if (q) {
			filter.$or = [
				{ sku: { $regex: q, $options: "i" } },
				{ internalPartNumber: { $regex: q, $options: "i" } },
				{ "fishbowl.partNum": { $regex: q, $options: "i" } },
				{ "fishbowl.description": { $regex: q, $options: "i" } },
			];
		}

		const items = await Product.find(filter).limit(200).sort({ createdAt: -1 });
		res.json(items);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: "Server error" });
	}
};

export const getProduct = async (req, res) => {
	try {
		const p = await Product.findById(req.params.id);
		if (!p) return res.status(404).json({ message: "Not found" });
		res.json(p);
	} catch (e) {
		res.status(500).json({ message: "Server error" });
	}
};

export const createProduct = async (req, res) => {
	try {
		const p = await Product.create(req.body);
		res.status(201).json(p);
	} catch (e) {
		res.status(400).json({ message: "Invalid product data" });
	}
};

export const updateProduct = async (req, res) => {
	try {
		const p = await Product.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
		});
		if (!p) return res.status(404).json({ message: "Not found" });
		res.json(p);
	} catch (e) {
		res.status(400).json({ message: "Invalid product data" });
	}
};

export const deleteProduct = async (req, res) => {
	try {
		const productId = req.params.id;

		const product = await Product.findById(productId);
		if (!product) {
			return res.status(404).json({ message: "Not found" });
		}

		await ProductEnrichment.deleteOne({ productId: product._id });
		await Product.findByIdAndDelete(product._id);

		return res.json({
			ok: true,
			deletedProductId: String(product._id),
			deletedPartNumber: product?.fishbowl?.partNum || product?.sku || "",
		});
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: "Server error" });
	}
};

export const getAdminReviewSummary = async (req, res) => {
	try {
		const summary = {
			totalProducts: await Product.countDocuments({}),
			byStatus: {
				needsReview: await Product.countDocuments({
					isPublished: false,
					$or: [
						{ "review.status": "needs-review" },
						{ "review.status": { $exists: false } },
						{ review: { $exists: false } },
					],
				}),
				ready: await Product.countDocuments({
					isPublished: false,
					"review.status": "ready",
				}),
				approved: await Product.countDocuments({
					isPublished: false,
					"review.status": "approved",
				}),
				published: await Product.countDocuments({
					isPublished: true,
				}),
			},
			categories: [],
			subcategories: [],
			familyTypes: [],
			issueCodes: [],
		};

		const enrichments = await ProductEnrichment.find(
			{},
			{
				category: 1,
				subcategory: 1,
				"attributes.familyType": 1,
			},
		).lean();

		const categoryMap = new Map();
		const subcategoryMap = new Map();
		const familyTypeMap = new Map();

		for (const item of enrichments) {
			const category = normalizeQueryValue(item?.category);
			const subcategory = normalizeQueryValue(item?.subcategory);
			const familyType = normalizeQueryValue(item?.attributes?.familyType);

			if (category)
				categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
			if (subcategory)
				subcategoryMap.set(
					subcategory,
					(subcategoryMap.get(subcategory) || 0) + 1,
				);
			if (familyType)
				familyTypeMap.set(familyType, (familyTypeMap.get(familyType) || 0) + 1);
		}

		const issueRows = await Product.find(
			{ "review.issues.0": { $exists: true } },
			{ "review.issues": 1 },
		).lean();

		const issueCodeMap = new Map();
		for (const row of issueRows) {
			for (const issue of row?.review?.issues || []) {
				const code = normalizeQueryValue(issue?.code);
				if (!code) continue;
				issueCodeMap.set(code, (issueCodeMap.get(code) || 0) + 1);
			}
		}

		summary.categories = Array.from(categoryMap.entries())
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

		summary.subcategories = Array.from(subcategoryMap.entries())
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

		summary.familyTypes = Array.from(familyTypeMap.entries())
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

		summary.issueCodes = Array.from(issueCodeMap.entries())
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

		res.json(summary);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to load admin review summary" });
	}
};

export const listAdminReviewProducts = async (req, res) => {
	try {
		const status = normalizeQueryValue(req.query.status || "needs-review");
		const search = normalizeQueryValue(req.query.search || "");
		const category = normalizeQueryValue(req.query.category || "");
		const subcategory = normalizeQueryValue(req.query.subcategory || "");
		const familyType = normalizeQueryValue(req.query.familyType || "");
		const issueCode = normalizeQueryValue(req.query.issueCode || "");
		const publishReady = normalizeQueryValue(req.query.publishReady || "");
		const renderable = normalizeQueryValue(req.query.renderable || "");
		const page = Math.max(1, Number(req.query.page || 1));
		const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
		const skip = (page - 1) * limit;

		const productMatch = buildStatusProductFilter(status);

		if (publishReady === "true") {
			productMatch["review.publishReady"] = true;
		} else if (publishReady === "false") {
			productMatch["review.publishReady"] = false;
		}

		if (renderable === "true") {
			productMatch["review.renderable"] = true;
		} else if (renderable === "false") {
			productMatch["review.renderable"] = false;
		}

		if (issueCode) {
			productMatch["review.issues.code"] = issueCode;
		}

		const enrichmentMatchExpr = [];
		if (category) {
			enrichmentMatchExpr.push({ $eq: ["$category", category] });
		}
		if (subcategory) {
			enrichmentMatchExpr.push({ $eq: ["$subcategory", subcategory] });
		}
		if (familyType) {
			enrichmentMatchExpr.push({ $eq: ["$attributes.familyType", familyType] });
		}

		if (search) {
			const regex = search;
			enrichmentMatchExpr.push({
				$or: [
					{
						$regexMatch: {
							input: { $ifNull: ["$title", ""] },
							regex,
							options: "i",
						},
					},
					{
						$regexMatch: {
							input: { $ifNull: ["$shortTitle", ""] },
							regex,
							options: "i",
						},
					},
					{
						$regexMatch: {
							input: { $ifNull: ["$category", ""] },
							regex,
							options: "i",
						},
					},
					{
						$regexMatch: {
							input: { $ifNull: ["$subcategory", ""] },
							regex,
							options: "i",
						},
					},
					{
						$regexMatch: {
							input: { $ifNull: ["$attributes.familyType", ""] },
							regex,
							options: "i",
						},
					},
					{
						$regexMatch: {
							input: { $ifNull: ["$attributes.fishbowlPartNum", ""] },
							regex,
							options: "i",
						},
					},
					{
						$regexMatch: {
							input: { $ifNull: ["$seo.slug", ""] },
							regex,
							options: "i",
						},
					},
				],
			});
		}

		const lookupPipeline = [
			{
				$match: {
					$expr: {
						$eq: ["$productId", "$$productId"],
					},
				},
			},
		];

		if (enrichmentMatchExpr.length) {
			lookupPipeline.push({
				$match: {
					$expr: {
						$and: enrichmentMatchExpr,
					},
				},
			});
		}

		const requiresEnrichmentMatch =
			Boolean(category) || Boolean(subcategory) || Boolean(familyType);

		const basePipeline = [
			{ $match: productMatch },
			{
				$lookup: {
					from: "productenrichments",
					let: { productId: "$_id" },
					pipeline: lookupPipeline,
					as: "enrichment",
				},
			},
			{
				$unwind: {
					path: "$enrichment",
					preserveNullAndEmptyArrays: !requiresEnrichmentMatch,
				},
			},
		];

		const countPipeline = [...basePipeline, { $count: "totalItems" }];

		const normalizedSearch = normalizeQueryValue(search);
		const escapedSearch = escapeRegex(normalizedSearch);

		const rowsPipeline = [
			...basePipeline,
			...(normalizedSearch
				? [
						{
							$addFields: {
								_searchRank: {
									$switch: {
										branches: [
											{
												case: {
													$eq: [
														{
															$toLower: { $ifNull: ["$fishbowl.partNum", ""] },
														},
														normalizedSearch.toLowerCase(),
													],
												},
												then: 100,
											},
											{
												case: {
													$eq: [
														{ $toLower: { $ifNull: ["$sku", ""] } },
														normalizedSearch.toLowerCase(),
													],
												},
												then: 95,
											},
											{
												case: {
													$eq: [
														{
															$toLower: {
																$ifNull: ["$internalPartNumber", ""],
															},
														},
														normalizedSearch.toLowerCase(),
													],
												},
												then: 90,
											},
											{
												case: {
													$regexMatch: {
														input: { $ifNull: ["$fishbowl.partNum", ""] },
														regex: `^${escapedSearch}`,
														options: "i",
													},
												},
												then: 80,
											},
											{
												case: {
													$regexMatch: {
														input: { $ifNull: ["$sku", ""] },
														regex: `^${escapedSearch}`,
														options: "i",
													},
												},
												then: 75,
											},
											{
												case: {
													$regexMatch: {
														input: { $ifNull: ["$internalPartNumber", ""] },
														regex: `^${escapedSearch}`,
														options: "i",
													},
												},
												then: 70,
											},
											{
												case: {
													$regexMatch: {
														input: { $ifNull: ["$fishbowl.partNum", ""] },
														regex: escapedSearch,
														options: "i",
													},
												},
												then: 60,
											},
											{
												case: {
													$regexMatch: {
														input: { $ifNull: ["$sku", ""] },
														regex: escapedSearch,
														options: "i",
													},
												},
												then: 55,
											},
											{
												case: {
													$regexMatch: {
														input: { $ifNull: ["$internalPartNumber", ""] },
														regex: escapedSearch,
														options: "i",
													},
												},
												then: 50,
											},
											{
												case: {
													$regexMatch: {
														input: { $ifNull: ["$enrichment.title", ""] },
														regex: escapedSearch,
														options: "i",
													},
												},
												then: 25,
											},
											{
												case: {
													$regexMatch: {
														input: {
															$ifNull: [
																"$enrichment.attributes.fishbowlPartNum",
																"",
															],
														},
														regex: escapedSearch,
														options: "i",
													},
												},
												then: 20,
											},
											{
												case: {
													$regexMatch: {
														input: { $ifNull: ["$enrichment.seo.slug", ""] },
														regex: escapedSearch,
														options: "i",
													},
												},
												then: 10,
											},
										],
										default: 0,
									},
								},
							},
						},
					]
				: [
						{
							$addFields: {
								_searchRank: 0,
							},
						},
					]),
			{ $sort: { _searchRank: -1, updatedAt: -1, createdAt: -1 } },
			{ $skip: skip },
			{ $limit: limit },
			{
				$project: {
					productId: "$_id",
					enrichmentId: "$enrichment._id",
					sku: { $ifNull: ["$sku", ""] },
					partNumber: {
						$ifNull: ["$fishbowl.partNum", { $ifNull: ["$sku", ""] }],
					},
					title: {
						$ifNull: [
							"$enrichment.title",
							{
								$ifNull: [
									"$fishbowl.description",
									{
										$ifNull: [
											"$fishbowl.partNum",
											{ $ifNull: ["$sku", "Untitled Product"] },
										],
									},
								],
							},
						],
					},
					reviewStatus: { $ifNull: ["$review.status", "needs-review"] },
					qualityScore: { $ifNull: ["$review.qualityScore", 0] },
					renderable: { $ifNull: ["$review.renderable", false] },
					publishReady: { $ifNull: ["$review.publishReady", false] },
					isPublished: { $ifNull: ["$isPublished", false] },
					category: { $ifNull: ["$enrichment.category", ""] },
					subcategory: { $ifNull: ["$enrichment.subcategory", ""] },
					familyType: { $ifNull: ["$enrichment.attributes.familyType", ""] },
					issueCodes: {
						$map: {
							input: { $ifNull: ["$review.issues", []] },
							as: "issue",
							in: "$$issue.code",
						},
					},
				},
			},
		];

		const [countResult, items] = await Promise.all([
			Product.aggregate(countPipeline),
			Product.aggregate(rowsPipeline),
		]);

		const totalItems = Number(countResult?.[0]?.totalItems || 0);

		res.json({
			items,
			totalItems,
			totalPages: Math.ceil(totalItems / limit),
			page,
			limit,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to load admin review products" });
	}
};

export const getAdminProductDetail = async (req, res) => {
	try {
		const productId = req.params.id;

		const product = await Product.findById(productId).lean();
		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}

		const enrichment = await ProductEnrichment.findOne({ productId }).lean();
		const readiness = await evaluateProductPublishReadiness(productId);

		return res.json({
			product,
			enrichment,
			readiness,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to load product detail" });
	}
};

export const patchAdminProduct = async (req, res) => {
	try {
		const productId = req.params.id;
		const productPayload = safeObject(req.body?.product);
		const enrichmentPayload = safeObject(req.body?.enrichment);
		const result = await patchAdminProductById(
			productId,
			productPayload,
			enrichmentPayload,
			req.user?.id || null,
		);

		return res.json({
			success: true,
			product: result.product,
			enrichment: result.enrichment,
			readiness: result.readiness,
		});
	} catch (err) {
		console.error(err);
		res
			.status(400)
			.json({ message: err.message || "Failed to update product" });
	}
};

export const approveAdminProduct = async (req, res) => {
	try {
		const productId = req.params.id;
		const result = await recomputeAndPersist(productId, req.user?.id || null);

		if (!result.readiness.publishReady) {
			return res.status(400).json({
				message: "Product is not ready for approval",
				readiness: result.readiness,
			});
		}

		result.product.review = {
			...(result.product.review?.toObject?.() || result.product.review || {}),
			status: "approved",
			approvedBy: req.user?.id || null,
			approvedAt: new Date(),
		};
		result.product.needsReview = false;
		result.product.catalogStatus = "ready";

		if (result.enrichment.contentStatus !== "approved") {
			result.enrichment.contentStatus = "approved";
		}

		await result.product.save();
		await result.enrichment.save();

		return res.json({
			success: true,
			product: result.product,
			enrichment: result.enrichment,
			readiness: result.readiness,
		});
	} catch (err) {
		console.error(err);
		res
			.status(400)
			.json({ message: err.message || "Failed to approve product" });
	}
};

export const publishAdminProduct = async (req, res) => {
	try {
		const productId = req.params.id;
		const result = await publishProduct(productId, req.user?.id || null);

		if (result.action === "blocked") {
			return res.status(400).json(result);
		}

		return res.json(result);
	} catch (err) {
		console.error(err);
		res
			.status(400)
			.json({ message: err.message || "Failed to publish product" });
	}
};

export const unpublishAdminProduct = async (req, res) => {
	try {
		const productId = req.params.id;

		const product = await Product.findById(productId);
		const enrichment = await ProductEnrichment.findOne({ productId });

		if (!product || !enrichment) {
			return res
				.status(404)
				.json({ message: "Product or enrichment not found" });
		}

		product.isPublished = false;
		product.catalogStatus = "ready";
		product.review = {
			...(product.review?.toObject?.() || product.review || {}),
			status: "approved",
		};

		await product.save();
		await enrichment.save();

		const readiness = await evaluateProductPublishReadiness(productId);

		return res.json({
			success: true,
			product,
			enrichment,
			readiness,
		});
	} catch (err) {
		console.error(err);
		res
			.status(400)
			.json({ message: err.message || "Failed to unpublish product" });
	}
};

export const recomputeAdminProduct = async (req, res) => {
	try {
		const productId = req.params.id;
		const result = await recomputeAndPersist(productId, req.user?.id || null);

		return res.json({
			success: true,
			product: result.product,
			enrichment: result.enrichment,
			readiness: result.readiness,
		});
	} catch (err) {
		console.error(err);
		res.status(400).json({
			message: err.message || "Failed to recompute product readiness",
		});
	}
};

export const bulkAdminProducts = async (req, res) => {
	try {
		const action = normalizeQueryValue(req.body?.action || "");
		const productIds = Array.isArray(req.body?.productIds)
			? [
					...new Set(
						req.body.productIds
							.map((id) => String(id || "").trim())
							.filter(Boolean),
					),
				]
			: [];
		const productPayload = safeObject(req.body?.product);
		const enrichmentPayload = safeObject(req.body?.enrichment);

		if (!action) {
			return res.status(400).json({ message: "Bulk action is required" });
		}
		if (!productIds.length) {
			return res
				.status(400)
				.json({ message: "At least one product must be selected" });
		}

		const results = [];
		for (const productId of productIds) {
			try {
				const result = await performBulkAction(
					action,
					productId,
					req.user?.id || null,
					productPayload,
					enrichmentPayload,
				);
				results.push({ productId, status: "ok", ...result });
			} catch (err) {
				results.push({
					productId,
					status: "failed",
					message: err.message || `Failed to ${action} product`,
				});
			}
		}

		const summary = {
			action,
			total: results.length,
			ok: results.filter((r) => r.status === "ok").length,
			failed: results.filter((r) => r.status === "failed").length,
		};

		return res.json({ success: true, summary, results });
	} catch (err) {
		console.error(err);
		res
			.status(400)
			.json({ message: err.message || "Failed to perform bulk action" });
	}
};

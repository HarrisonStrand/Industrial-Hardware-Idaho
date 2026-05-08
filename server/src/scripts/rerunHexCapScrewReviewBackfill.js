import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";

function asObject(value) {
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: {};
}

function mapReviewStatusFromReadiness(readiness = {}, product = {}) {
	if (product?.isPublished) return "published";
	if (product?.review?.status === "approved") return "approved";
	if (readiness?.publishReady) return "ready";
	return "needs-review";
}

function buildHexCapCandidateQuery() {
	return {
		$and: [
			{
				$or: [
					{ "fishbowl.partNum": /^MMCS/i },
					{
						"fishbowl.partNum":
							/^(?:SS|HH|SB|AN|AL|BR)?CS\d[CF]\d{2,3}\d{4}(?:P|T|TAP)?$/i,
					},
					{
						"fishbowl.description":
							/\bhex cap screw\b|\bhex head bolt\b|\bhex bolt\b|\btap bolt\b|\bc\/s\b/i,
					},
					{ sku: /^MMCS/i },
					{
						sku: /^(?:SS|HH|SB|AN|AL|BR)?CS\d[CF]\d{2,3}\d{4}(?:P|T|TAP)?$/i,
					},
					{
						"fishbowl.description":
							/\bhex cap screw\b|\bhex head bolt\b|\bhex bolt\b|\bheavy hex bolt\b|\bstructural bolt\b|\ba307\b|\ba325\b|\btap bolt\b|\bc\/s\b/i,
					},
				],
			},
			{
				$nor: [
					{
						"fishbowl.description":
							/assembly| assy|locknut assy| w\/ | with locknut/i,
					},
					{ "fishbowl.partNum": /^CHCS/i },
					{ sku: /^CHCS/i },
					{
						"fishbowl.description": /socket head cap screw|soc\.?hd\.?c\/s/i,
					},
					{ "fishbowl.description": /spacer assortment/i },
					{ "fishbowl.description": /auveco/i },
					{ sku: /auveco/i },
					{ "fishbowl.partNum": /auveco/i },
					{ "fishbowl.description": /specialty hardware/i },
					{ "fishbowl.description": /countersink|combo drill/i },
					{ sku: /^CS\d+\s*T/i },
					{ "fishbowl.partNum": /^CS\d+\s*T/i },
					{ "fishbowl.partNum": /^BA/i },
					{ "fishbowl.partNum": /^(91251A694|91280A964|91465A212|93395A316|940396)$/i },
					{ sku: /^(91251A694|91280A964|91465A212|93395A316|940396)$/i },
					{ "fishbowl.partNum": /^(Anixter Bolt Assembly|IVVC BOLT ASSY)$/i },
					{ sku: /^(Anixter Bolt Assembly|IVVC BOLT ASSY)$/i },
					{ "fishbowl.partNum": /^SSCSFT/i },
					{ sku: /^SSCSFT/i },
					{ "fishbowl.partNum": /^SSCS\d{3,4}\d{4}C(?:\s*TAP)?$/i },
					{ sku: /^SSCS\d{3,4}\d{4}C(?:\s*TAP)?$/i },

					{ sku: /^BA/i },
					{ "fishbowl.partNum": /^SSCSFT/i },
					{ sku: /^SSCSFT/i },
					{
						"fishbowl.description":
							/\bassy\b|\bassembly\b|\bkit\b|\bassortment\b/i,
					},
					{ "fishbowl.description": /\bauto assortment\b/i },
					{ "fishbowl.partNum": /^BA/i },
					{ "fishbowl.partNum": /^(91251A694|91280A964|91465A212|93395A316|940396)$/i },
					{ sku: /^(91251A694|91280A964|91465A212|93395A316|940396)$/i },
					{ "fishbowl.partNum": /^(Anixter Bolt Assembly|IVVC BOLT ASSY)$/i },
					{ sku: /^(Anixter Bolt Assembly|IVVC BOLT ASSY)$/i },
					{ "fishbowl.partNum": /^SSCSFT/i },
					{ sku: /^SSCSFT/i },
					{ "fishbowl.partNum": /^SSCS\d{3,4}\d{4}C(?:\s*TAP)?$/i },
					{ sku: /^SSCS\d{3,4}\d{4}C(?:\s*TAP)?$/i },

					{ sku: /^BA/i },
					{ "fishbowl.partNum": /^SSCSFT/i },
					{ sku: /^SSCSFT/i },
					{
						"fishbowl.description":
							/\bassy\b|\bassembly\b|\bkit\b|\bassortment\b|\bauto assortment\b/i,
					},
					{ "fishbowl.description": /countersink|combo drill/i },
					{ "fishbowl.description": /socket head cap screw|soc\.?hd\.?c\/s/i },
				],
			},
		],
	};
}

async function recomputeAndPersist(productId) {
	const product = await Product.findById(productId);
	const enrichment = await ProductEnrichment.findOne({ productId });

	if (!product || !enrichment) {
		return { status: "skipped", productId };
	}

	const readiness = await evaluateProductPublishReadiness(productId, {
		includeSimilarFamilies: false,
	});

	const nextStatus = mapReviewStatusFromReadiness(readiness, product);

	product.review = {
		...asObject(product.review?.toObject?.() || product.review),
		status: nextStatus,
		issues: readiness.issues || [],
		missingRequiredAttributes: readiness.missingRequiredAttributes || [],
		missingRecommendedAttributes: readiness.missingRecommendedAttributes || [],
		renderable: !!readiness.renderable,
		publishReady: !!readiness.publishReady,
		qualityScore: Number(readiness.qualityScore || 0),
		suggestedFamilyKey: readiness.suggestedFamilyKey || "",
		reviewedAt: new Date(),
	};

	product.needsReview = nextStatus === "needs-review";
	product.catalogStatus = product.isPublished
		? "published"
		: readiness.publishReady
			? "ready"
			: "enriched";

	enrichment.quality = {
		...asObject(enrichment.quality?.toObject?.() || enrichment.quality),
		builderReady: !!readiness.builderReady,
		renderable: !!readiness.renderable,
		publishReady: !!readiness.publishReady,
		completenessScore: Number(readiness.qualityScore || 0),
		missingRequiredAttributes: readiness.missingRequiredAttributes || [],
		missingRecommendedAttributes: readiness.missingRecommendedAttributes || [],
		issues: readiness.issues || [],
		similarFamilies: [],
		suggestedFamilyKey: readiness.suggestedFamilyKey || "",
		suggestedFamilyConfidence: Number(readiness.suggestedFamilyConfidence || 0),
		lastEvaluatedAt: new Date(),
	};

	await product.save();
	await enrichment.save();

	return {
		status: "ok",
		reviewStatus: nextStatus,
	};
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const products = await Product.find(buildHexCapCandidateQuery(), {
		_id: 1,
	}).lean();

	const productIds = [...new Set(products.map((item) => String(item._id)))];
	console.log(`Found ${productIds.length} candidate hex-cap-screw products`);

	const summary = {
		total: productIds.length,
		ok: 0,
		failed: 0,
		ready: 0,
		needsReview: 0,
		approved: 0,
		published: 0,
		skipped: 0,
	};

	let processed = 0;

	for (const productId of productIds) {
		try {
			const result = await recomputeAndPersist(productId);

			processed += 1;
			if (processed % 100 === 0) {
				console.log(`Processed ${processed}/${productIds.length}`);
			}

			if (result.status === "ok") {
				summary.ok += 1;
				if (result.reviewStatus === "ready") summary.ready += 1;
				else if (result.reviewStatus === "needs-review")
					summary.needsReview += 1;
				else if (result.reviewStatus === "approved") summary.approved += 1;
				else if (result.reviewStatus === "published") summary.published += 1;
			} else {
				summary.skipped += 1;
			}
		} catch (err) {
			processed += 1;
			summary.failed += 1;
			console.error(`FAIL | ${productId}`, err.message);
		}
	}

	console.log("===== HEX CAP SCREW REVIEW SUMMARY =====");
	console.log(summary);

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Hex cap screw review rerun failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});

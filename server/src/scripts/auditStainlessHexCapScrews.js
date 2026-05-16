import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function stainlessHexCandidateMatch() {
	const stainlessMetricDescription = /(?:^|\s)(?:s\/s|ss)\s*$/i;

	return {
		$and: [
			{
				$or: [
					{ "fishbowl.partNum": /^SSCS/i },
					{ sku: /^SSCS/i },
					{ internalPartNumber: /^SSCS/i },
					{ "fishbowl.description": /(?:^|[^A-Z0-9])SSCS[A-Z0-9-]*/i },
					{
						$and: [
							{ "fishbowl.partNum": /^MMCS/i },
							{ "fishbowl.description": stainlessMetricDescription },
						],
					},
					{
						$and: [
							{ sku: /^MMCS/i },
							{ "fishbowl.description": stainlessMetricDescription },
						],
					},
					{
						"fishbowl.description": /\b(?:hex cap screw|hex head bolt|hex bolt|c\/s)\b.*(?:s\/s|ss)\s*$/i,
					},
				],
			},
			{
				$nor: [
					{ "fishbowl.description": /\bassy\b|assembly|kit|assortment|auto assortment|locknut assy| w\/ | with locknut/i },
					{ "fishbowl.partNum": /^CHCS/i },
					{ sku: /^CHCS/i },
					{ "fishbowl.description": /socket head cap screw|socket cap screw|soc\.?\s*hd|button head|button hd|flat head|flat hd|flange bolt|flange screw/i },
					{ "fishbowl.description": /auveco|spacer assortment|specialty hardware|countersink|combo drill/i },
					{ "fishbowl.partNum": /^BA/i },
					{ sku: /^BA/i },
				],
			},
		],
	};
}

function increment(map, key) {
	map.set(key, (map.get(key) || 0) + 1);
}

function sortedCounts(map) {
	return Array.from(map.entries())
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function hasLooseStainlessThreadSuffix(product = {}) {
	const text = [
		product?.fishbowl?.partNum,
		product?.sku,
		product?.internalPartNumber,
		product?.fishbowl?.description,
	].filter(Boolean).join(" ").toUpperCase();
	return /(?:^|[^A-Z0-9])SSCS\d{2,3}\d{4}[CF](?:[^A-Z0-9]|$)/i.test(text);
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const products = await Product.find(stainlessHexCandidateMatch(), {
		_id: 1,
		sku: 1,
		internalPartNumber: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
		"review.status": 1,
		"review.publishReady": 1,
		"review.renderable": 1,
		isPublished: 1,
		catalogStatus: 1,
	}).lean();

	const productIds = products.map((item) => item._id);
	const enrichments = await ProductEnrichment.find({ productId: { $in: productIds } }, {
		productId: 1,
		title: 1,
		category: 1,
		subcategory: 1,
		attributes: 1,
		quality: 1,
	}).lean();

	const enrichmentMap = new Map(enrichments.map((item) => [String(item.productId), item]));

	const totals = {
		candidateProducts: products.length,
		withEnrichment: 0,
		missingEnrichment: 0,
		publishReady: 0,
		needsReview: 0,
		approved: 0,
		published: 0,
		wrongCategory: 0,
		wrongSubcategory: 0,
		wrongFamily: 0,
		missingDiameter: 0,
		missingLength: 0,
		missingThreadPitch: 0,
		missingMaterialFinish: 0,
		notStainlessAfterEnrichment: 0,
		badStainlessMaterialFinish: 0,
		invalidStainlessGrade: 0,
		looseThreadSuffixCandidates: 0,
		looseThreadSuffixMissingSeriesOrPitch: 0,
	};

	const counts = {
		reviewStatus: new Map(),
		measurementSystem: new Map(),
		diameter: new Map(),
		threadPitch: new Map(),
		threadSeries: new Map(),
		material: new Map(),
		finish: new Map(),
		grade: new Map(),
		materialFinish: new Map(),
	};

	const samples = {
		missingEnrichment: [],
		notStainlessAfterEnrichment: [],
		badStainlessMaterialFinish: [],
		invalidStainlessGrade: [],
		looseThreadSuffixMissingSeriesOrPitch: [],
		missingThreadPitch: [],
		missingLength: [],
		wrongFamily: [],
	};

	for (const product of products) {
		const enrichment = enrichmentMap.get(String(product._id));
		const attrs = enrichment?.attributes || {};
		const partNumber = product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "";
		const sample = {
			id: String(product._id),
			partNumber,
			description: product?.fishbowl?.description || "",
			title: enrichment?.title || "",
			category: enrichment?.category || "",
			subcategory: enrichment?.subcategory || "",
			familyType: attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "",
			measurementSystem: attrs.measurementSystem || "",
			diameter: attrs.diameter || "",
			threadPitch: attrs.threadPitch || "",
			threadSeries: attrs.threadSeries || attrs.thread_series || "",
			length: attrs.length || "",
			material: attrs.material || "",
			finish: attrs.finish || "",
			grade: attrs.grade || "",
			materialFinish: attrs.materialFinish || "",
			reviewStatus: product?.review?.status || "needs-review",
			publishReady: !!product?.review?.publishReady,
		};

		increment(counts.reviewStatus, sample.reviewStatus);
		if (sample.reviewStatus === "needs-review") totals.needsReview += 1;
		if (sample.reviewStatus === "approved") totals.approved += 1;
		if (sample.reviewStatus === "published" || product?.isPublished) totals.published += 1;
		if (product?.review?.publishReady) totals.publishReady += 1;

		if (!enrichment) {
			totals.missingEnrichment += 1;
			if (samples.missingEnrichment.length < 20) samples.missingEnrichment.push(sample);
			continue;
		}

		totals.withEnrichment += 1;
		increment(counts.measurementSystem, sample.measurementSystem || "(blank)");
		increment(counts.diameter, sample.diameter || "(blank)");
		increment(counts.threadPitch, sample.threadPitch || "(blank)");
		increment(counts.threadSeries, sample.threadSeries || "(blank)");
		increment(counts.material, sample.material || "(blank)");
		increment(counts.finish, sample.finish || "(blank)");
		increment(counts.grade, sample.grade || "(blank)");
		increment(counts.materialFinish, sample.materialFinish || "(blank)");

		if (normalize(sample.category) !== "bolts") totals.wrongCategory += 1;
		if (normalize(sample.subcategory) !== "hex cap screws") totals.wrongSubcategory += 1;
		if (normalize(sample.familyType) !== "hex cap screw") {
			totals.wrongFamily += 1;
			if (samples.wrongFamily.length < 20) samples.wrongFamily.push(sample);
		}
		if (!sample.diameter) totals.missingDiameter += 1;
		if (!sample.length) {
			totals.missingLength += 1;
			if (samples.missingLength.length < 20) samples.missingLength.push(sample);
		}
		if (!sample.threadPitch) {
			totals.missingThreadPitch += 1;
			if (samples.missingThreadPitch.length < 20) samples.missingThreadPitch.push(sample);
		}

		if (hasLooseStainlessThreadSuffix(product)) {
			totals.looseThreadSuffixCandidates += 1;
			if (!sample.threadPitch || !sample.threadSeries) {
				totals.looseThreadSuffixMissingSeriesOrPitch += 1;
				if (samples.looseThreadSuffixMissingSeriesOrPitch.length < 20) {
					samples.looseThreadSuffixMissingSeriesOrPitch.push(sample);
				}
			}
		}

		if (!sample.materialFinish) totals.missingMaterialFinish += 1;
		if (normalize(sample.material) !== "stainless steel") {
			totals.notStainlessAfterEnrichment += 1;
			if (samples.notStainlessAfterEnrichment.length < 20) samples.notStainlessAfterEnrichment.push(sample);
		}

		if (normalize(sample.material) === "stainless steel" && normalize(sample.materialFinish) !== "stainless steel") {
			totals.badStainlessMaterialFinish += 1;
			if (samples.badStainlessMaterialFinish.length < 20) samples.badStainlessMaterialFinish.push(sample);
		}

		if (normalize(sample.material) === "stainless steel" && !["304", "316"].includes(clean(sample.grade))) {
			totals.invalidStainlessGrade += 1;
			if (samples.invalidStainlessGrade.length < 20) samples.invalidStainlessGrade.push(sample);
		}
	}

	console.log("===== STAINLESS HEX CAP SCREW AUDIT =====");
	console.log(JSON.stringify({
		totals,
		counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, sortedCounts(value).slice(0, 50)])),
		samples,
	}, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Stainless hex cap screw audit failed:", err);
	try { await mongoose.disconnect(); } catch {}
	process.exit(1);
});

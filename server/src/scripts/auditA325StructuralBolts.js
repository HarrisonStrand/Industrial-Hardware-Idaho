import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import {
	A325_SEARCH_REGEX,
	clean,
	decodeA325Product,
	hasCorrectA325Attributes,
	normalize,
} from "./a325StructuralBoltUtils.js";

function increment(map, key, amount = 1) {
	map.set(key, (map.get(key) || 0) + amount);
}

function toSortedCountArray(map) {
	return Array.from(map.entries())
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function pushSample(samples, key, sample, max = 25) {
	if (!samples[key]) samples[key] = [];
	if (samples[key].length < max) samples[key].push(sample);
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const products = await Product.find(
		{
			$or: [
				{ "fishbowl.partNum": A325_SEARCH_REGEX },
				{ sku: A325_SEARCH_REGEX },
				{ internalPartNumber: A325_SEARCH_REGEX },
				{ "fishbowl.description": A325_SEARCH_REGEX },
			],
		},
		{
			_id: 1,
			sku: 1,
			internalPartNumber: 1,
			"fishbowl.partNum": 1,
			"fishbowl.description": 1,
			"review.status": 1,
			"review.publishReady": 1,
			"review.renderable": 1,
			"review.qualityScore": 1,
			isPublished: 1,
			catalogStatus: 1,
		},
	).lean();

	const enrichments = await ProductEnrichment.find(
		{ productId: { $in: products.map((p) => p._id) } },
		{
			productId: 1,
			title: 1,
			category: 1,
			subcategory: 1,
			attributes: 1,
			quality: 1,
		},
	).lean();

	const enrichmentMap = new Map(enrichments.map((item) => [String(item.productId), item]));

	const totals = {
		candidateProducts: products.length,
		decoded: 0,
		unrecognized: 0,
		withEnrichment: 0,
		missingEnrichment: 0,
		wrongAttributes: 0,
		wrongCategory: 0,
		wrongSubcategory: 0,
		wrongFamilyType: 0,
		wrongGrade: 0,
		wrongMaterial: 0,
		wrongFinish: 0,
		wrongMaterialFinish: 0,
		wrongOrigin: 0,
		missingDiameter: 0,
		missingLength: 0,
		missingThreadPitch: 0,
		missingThreadSeries: 0,
		missingLengthLeadingZero: 0,
		ready: 0,
		needsReview: 0,
		approved: 0,
		published: 0,
	};

	const counts = {
		reviewStatus: new Map(),
		category: new Map(),
		subcategory: new Map(),
		familyType: new Map(),
		grade: new Map(),
		material: new Map(),
		finish: new Map(),
		materialFinish: new Map(),
		origin: new Map(),
		diameter: new Map(),
		length: new Map(),
		threadPitch: new Map(),
		threadSeries: new Map(),
	};

	const samples = {};

	for (const product of products) {
		const partNumber = product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "";
		const description = product?.fishbowl?.description || "";
		const decoded = decodeA325Product(product);
		const enrichment = enrichmentMap.get(String(product._id));
		const attrs = enrichment?.attributes || {};
		const reviewStatus = product?.review?.status || "needs-review";

		increment(counts.reviewStatus, reviewStatus || "(blank)");
		if (reviewStatus === "ready") totals.ready += 1;
		if (reviewStatus === "needs-review") totals.needsReview += 1;
		if (reviewStatus === "approved") totals.approved += 1;
		if (reviewStatus === "published" || product?.isPublished) totals.published += 1;

		const sample = {
			id: String(product._id),
			partNumber,
			sku: product?.sku || "",
			description,
			title: enrichment?.title || "",
			category: enrichment?.category || "",
			subcategory: enrichment?.subcategory || "",
			familyType: attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "",
			diameter: attrs.diameter || "",
			threadPitch: attrs.threadPitch || "",
			threadSeries: attrs.threadSeries || attrs.thread_series || "",
			length: attrs.length || "",
			grade: attrs.grade || "",
			material: attrs.material || "",
			finish: attrs.finish || "",
			materialFinish: attrs.materialFinish || "",
			origin: attrs.origin || attrs.domestic || "",
			reviewStatus,
			publishReady: !!product?.review?.publishReady,
			decoded,
		};

		if (!decoded) {
			totals.unrecognized += 1;
			pushSample(samples, "unrecognized", sample);
			continue;
		}

		totals.decoded += 1;
		if (decoded.wasMissingLengthLeadingZero) {
			totals.missingLengthLeadingZero += 1;
			pushSample(samples, "missingLengthLeadingZero", sample);
		}

		if (!enrichment) {
			totals.missingEnrichment += 1;
			pushSample(samples, "missingEnrichment", sample);
			continue;
		}

		totals.withEnrichment += 1;

		increment(counts.category, enrichment.category || "(blank)");
		increment(counts.subcategory, enrichment.subcategory || "(blank)");
		increment(counts.familyType, sample.familyType || "(blank)");
		increment(counts.grade, sample.grade || "(blank)");
		increment(counts.material, sample.material || "(blank)");
		increment(counts.finish, sample.finish || "(blank)");
		increment(counts.materialFinish, sample.materialFinish || "(blank)");
		increment(counts.origin, sample.origin || "(blank)");
		increment(counts.diameter, sample.diameter || "(blank)");
		increment(counts.length, sample.length || "(blank)");
		increment(counts.threadPitch, sample.threadPitch || "(blank)");
		increment(counts.threadSeries, sample.threadSeries || "(blank)");

		if (normalize(enrichment.category) !== "bolts") {
			totals.wrongCategory += 1;
			pushSample(samples, "wrongCategory", sample);
		}
		if (normalize(enrichment.subcategory) !== "hex cap screws") {
			totals.wrongSubcategory += 1;
			pushSample(samples, "wrongSubcategory", sample);
		}
		if (normalize(sample.familyType) !== "structural bolt") {
			totals.wrongFamilyType += 1;
			pushSample(samples, "wrongFamilyType", sample);
		}
		if (clean(sample.grade) !== "A325") {
			totals.wrongGrade += 1;
			pushSample(samples, "wrongGrade", sample);
		}
		if (normalize(sample.material) !== "steel") {
			totals.wrongMaterial += 1;
			pushSample(samples, "wrongMaterial", sample);
		}
		if (normalize(sample.finish) !== normalize(decoded.finish)) {
			totals.wrongFinish += 1;
			pushSample(samples, "wrongFinish", sample);
		}
		if (normalize(sample.materialFinish) !== normalize(decoded.materialFinish)) {
			totals.wrongMaterialFinish += 1;
			pushSample(samples, "wrongMaterialFinish", sample);
		}
		if (normalize(sample.origin) !== normalize(decoded.origin)) {
			totals.wrongOrigin += 1;
			pushSample(samples, "wrongOrigin", sample);
		}
		if (!clean(sample.diameter)) totals.missingDiameter += 1;
		if (!clean(sample.length)) totals.missingLength += 1;
		if (!clean(sample.threadPitch)) totals.missingThreadPitch += 1;
		if (!clean(sample.threadSeries)) totals.missingThreadSeries += 1;

		if (!hasCorrectA325Attributes(enrichment, decoded)) {
			totals.wrongAttributes += 1;
			pushSample(samples, "wrongAttributes", sample);
		}
	}

	const sortedCounts = Object.fromEntries(
		Object.entries(counts).map(([key, value]) => [key, toSortedCountArray(value)]),
	);

	console.log("===== A325 STRUCTURAL BOLT AUDIT =====");
	console.log(JSON.stringify({ totals, counts: sortedCounts, samples }, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ A325 audit failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});

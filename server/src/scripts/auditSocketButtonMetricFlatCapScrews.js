import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import {
	clean,
	decodeCapScrewHeadFamilyFromProduct,
	diffDecodedAgainstEnrichment,
} from "./capScrewHeadFamilyUtils.js";

function buildCandidateQuery() {
	const partPattern = /\b(?:BHCS|SHCS)\d{6,8}(?:FLH|F|LH)?\b|\b(?:SSSB|SSSH)\d{6,8}(?:FLH|F|LH)?\b|\bMMS[BFH]\d{8}(?:SS)?\b/i;
	return {
		$or: [
			{ "fishbowl.partNum": partPattern },
			{ sku: partPattern },
			{ internalPartNumber: partPattern },
			{ "fishbowl.description": partPattern },
		],
	};
}

function increment(map, key, amount = 1) {
	map.set(key, (map.get(key) || 0) + amount);
}

function toSortedCountArray(map) {
	return Array.from(map.entries())
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function pushSample(samples, key, value, max = 20) {
	if (!samples[key]) samples[key] = [];
	if (samples[key].length < max) samples[key].push(value);
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log("🔎 Auditing button head, socket head, and metric flat head cap screws");

	const products = await Product.find(buildCandidateQuery(), {
		_id: 1,
		sku: 1,
		internalPartNumber: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
		"review.status": 1,
		"review.publishReady": 1,
		isPublished: 1,
		catalogStatus: 1,
	}).lean();

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
		missingEnrichment: 0,
		wrongAttributes: 0,
		currentlyHexCapScrews: 0,
		unrecognizedPattern: 0,
		partNumberAnomalies: 0,
		published: 0,
		publishReady: 0,
	};

	const counts = {
		subcategory: new Map(),
		familyType: new Map(),
		measurementSystem: new Map(),
		materialFinish: new Map(),
		finish: new Map(),
		threadSeries: new Map(),
		headProfile: new Map(),
		reviewStatus: new Map(),
	};
	const samples = {};

	for (const product of products) {
		const enrichment = enrichmentMap.get(String(product._id));
		const decoded = decodeCapScrewHeadFamilyFromProduct(product, enrichment);
		const partNumber = product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "";
		const description = product?.fishbowl?.description || "";

		const sampleBase = {
			id: String(product._id),
			partNumber,
			sku: product?.sku || "",
			description,
			currentCategory: enrichment?.category || "",
			currentSubcategory: enrichment?.subcategory || "",
			currentFamilyType: enrichment?.attributes?.familyType || "",
			currentMaterialFinish: enrichment?.attributes?.materialFinish || "",
			currentDiameter: enrichment?.attributes?.diameter || "",
			currentLength: enrichment?.attributes?.length || "",
			currentThreadPitch: enrichment?.attributes?.threadPitch || "",
			currentThreadSeries: enrichment?.attributes?.threadSeries || enrichment?.attributes?.thread_series || "",
			reviewStatus: product?.review?.status || "needs-review",
		};

		if (product?.isPublished) totals.published += 1;
		if (product?.review?.publishReady) totals.publishReady += 1;
		increment(counts.reviewStatus, product?.review?.status || "needs-review");

		if (!decoded) {
			totals.unrecognizedPattern += 1;
			pushSample(samples, "unrecognizedPattern", sampleBase);
			continue;
		}

		totals.decoded += 1;
		increment(counts.subcategory, decoded.subcategory || "(blank)");
		increment(counts.familyType, decoded.familyType || "(blank)");
		increment(counts.measurementSystem, decoded.measurementSystem || "(blank)");
		increment(counts.materialFinish, decoded.materialFinish || "(blank)");
		increment(counts.finish, decoded.finish || "(blank)");
		increment(counts.threadSeries, decoded.threadSeries || "(blank)");
		increment(counts.headProfile, decoded.headProfile || "(blank)");

		if (decoded.partNumberAnomaly) {
			totals.partNumberAnomalies += 1;
			pushSample(samples, "partNumberAnomalies", {
				...sampleBase,
				anomaly: decoded.partNumberAnomaly,
				expectedLength: decoded.length,
				expectedDiameter: decoded.diameter,
			});
		}

		if (!enrichment) {
			totals.missingEnrichment += 1;
			pushSample(samples, "missingEnrichment", { ...sampleBase, expected: decoded });
			continue;
		}

		if (clean(enrichment.subcategory).toLowerCase() === "hex cap screws") {
			totals.currentlyHexCapScrews += 1;
			pushSample(samples, "currentlyHexCapScrews", { ...sampleBase, expectedSubcategory: decoded.subcategory });
		}

		const mismatches = diffDecodedAgainstEnrichment(decoded, enrichment);
		if (mismatches.length) {
			totals.wrongAttributes += 1;
			pushSample(samples, "wrongAttributes", {
				...sampleBase,
				expected: {
					subcategory: decoded.subcategory,
					familyType: decoded.familyType,
					diameter: decoded.diameter,
					length: decoded.length,
					threadPitch: decoded.threadPitch,
					threadSeries: decoded.threadSeries,
					materialFinish: decoded.materialFinish,
					headProfile: decoded.headProfile,
				},
				mismatches,
			});
		}
	}

	console.log("===== CAP SCREW HEAD FAMILY AUDIT =====");
	console.log(JSON.stringify({
		totals,
		counts: Object.fromEntries(Object.entries(counts).map(([key, map]) => [key, toSortedCountArray(map)])),
		samples,
	}, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Cap screw audit failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});

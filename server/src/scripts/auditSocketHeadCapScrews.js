import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import {
	clean,
	decodeCapScrewHeadFamilyFromProduct,
	diffDecodedAgainstEnrichment,
} from "./capScrewHeadFamilyUtils.js";

const SOCKET_PART_PATTERN = /\bSHCS\d{5,8}(?:FLH|F|LH|Z)?\b|\bSSSH\d{5,8}(?:FLH|F|LH)?\b|\bMMSH\d{8}(?:SS|Z)?\b/i;
const SOCKET_TEXT_PATTERN = /\bsocket\s+head\s+cap\s+screw\b|\bsoc\.?\s*hd\.?\s*c\/?s\b|\bshcs\b/i;

function buildCandidateQuery() {
	return {
		$or: [
			{ "fishbowl.partNum": SOCKET_PART_PATTERN },
			{ sku: SOCKET_PART_PATTERN },
			{ internalPartNumber: SOCKET_PART_PATTERN },
			{ "fishbowl.description": SOCKET_PART_PATTERN },
			{ "fishbowl.description": SOCKET_TEXT_PATTERN },
		],
	};
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function increment(map, key, amount = 1) {
	map.set(key || "(blank)", (map.get(key || "(blank)") || 0) + amount);
}

function toSortedCountArray(map) {
	return Array.from(map.entries())
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function pushSample(samples, key, value, max = 25) {
	if (!samples[key]) samples[key] = [];
	if (samples[key].length < max) samples[key].push(value);
}

function getPartNumber(product = {}) {
	return product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "";
}

function isSteelBlackOxide(decoded = {}, enrichment = null) {
	const attrs = enrichment?.attributes || {};
	const materialFinish = normalize(decoded?.materialFinish || attrs.materialFinish || "");
	return materialFinish === "steel / black oxide";
}

function isFineCandidate(decoded = {}) {
	return normalize(decoded?.threadSeries || "") === "fine";
}

function currentSocketSubcategory(enrichment = null) {
	return normalize(enrichment?.subcategory || enrichment?.attributes?.subcategoryCanonical || "") === "socket head cap screws";
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log("🔎 Auditing socket head cap screws, including black oxide and fine-thread candidates");

	const products = await Product.find(buildCandidateQuery(), {
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
		isActive: 1,
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
		decodedSocketHeads: 0,
		unrecognized: 0,
		missingEnrichment: 0,
		currentlySocketHeadSubcategory: 0,
		currentlyHexCapScrews: 0,
		wrongAttributes: 0,
		steelBlackOxideDecoded: 0,
		steelBlackOxideReady: 0,
		steelBlackOxideNeedsReview: 0,
		steelBlackOxidePublished: 0,
		fineThreadDecoded: 0,
		fineThreadCurrentlyMissingOrWrong: 0,
		steelSocketMissingGrade8: 0,
	};

	const counts = {
		reviewStatus: new Map(),
		catalogStatus: new Map(),
		currentSubcategory: new Map(),
		currentFamilyType: new Map(),
		currentMaterialFinish: new Map(),
		currentThreadSeries: new Map(),
		expectedMaterialFinish: new Map(),
		expectedThreadSeries: new Map(),
		measurementSystem: new Map(),
	};

	const samples = {};

	for (const product of products) {
		const enrichment = enrichmentMap.get(String(product._id));
		const decoded = decodeCapScrewHeadFamilyFromProduct(product, enrichment);
		const attrs = enrichment?.attributes || {};
		const partNumber = getPartNumber(product);
		const sampleBase = {
			id: String(product._id),
			partNumber,
			sku: product?.sku || "",
			description: product?.fishbowl?.description || "",
			title: enrichment?.title || "",
			currentSubcategory: enrichment?.subcategory || "",
			currentFamilyType: attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "",
			currentMaterialFinish: attrs.materialFinish || "",
			currentDiameter: attrs.diameter || "",
			currentLength: attrs.length || "",
			currentThreadPitch: attrs.threadPitch || "",
			currentThreadSeries: attrs.threadSeries || attrs.thread_series || "",
			currentGrade: attrs.grade || "",
			reviewStatus: product?.review?.status || "needs-review",
			publishReady: !!product?.review?.publishReady,
			isPublished: !!product?.isPublished,
		};

		increment(counts.reviewStatus, sampleBase.reviewStatus);
		increment(counts.catalogStatus, product?.catalogStatus || "");
		increment(counts.currentSubcategory, sampleBase.currentSubcategory || "(missing enrichment)");
		increment(counts.currentFamilyType, sampleBase.currentFamilyType || "(blank)");
		increment(counts.currentMaterialFinish, sampleBase.currentMaterialFinish || "(blank)");
		increment(counts.currentThreadSeries, sampleBase.currentThreadSeries || "(blank)");

		if (!decoded || normalize(decoded.familyType) !== "socket head cap screw") {
			totals.unrecognized += 1;
			pushSample(samples, "unrecognized", sampleBase);
			continue;
		}

		totals.decodedSocketHeads += 1;
		increment(counts.expectedMaterialFinish, decoded.materialFinish || "(blank)");
		increment(counts.expectedThreadSeries, decoded.threadSeries || "(blank)");
		increment(counts.measurementSystem, decoded.measurementSystem || "(blank)");

		if (!enrichment) {
			totals.missingEnrichment += 1;
			pushSample(samples, "missingEnrichment", { ...sampleBase, expected: decoded });
			continue;
		}

		if (currentSocketSubcategory(enrichment)) totals.currentlySocketHeadSubcategory += 1;
		if (normalize(enrichment.subcategory) === "hex cap screws") {
			totals.currentlyHexCapScrews += 1;
			pushSample(samples, "currentlyHexCapScrews", { ...sampleBase, expectedSubcategory: decoded.subcategory });
		}

		if (isSteelBlackOxide(decoded, enrichment)) {
			totals.steelBlackOxideDecoded += 1;
			if (product?.isPublished) totals.steelBlackOxidePublished += 1;
			if (product?.review?.status === "ready" && product?.review?.publishReady) {
				totals.steelBlackOxideReady += 1;
			} else {
				totals.steelBlackOxideNeedsReview += 1;
				pushSample(samples, "steelBlackOxideNotReady", {
					...sampleBase,
					expected: {
						subcategory: decoded.subcategory,
						diameter: decoded.diameter,
						threadPitch: decoded.threadPitch,
						threadSeries: decoded.threadSeries,
						length: decoded.length,
						materialFinish: decoded.materialFinish,
					},
				});
			}
		}

		if (normalize(decoded.material) === "steel" && normalize(decoded.grade) === "grade 8" && normalize(attrs.grade || "") !== "grade 8") {
			totals.steelSocketMissingGrade8 += 1;
			pushSample(samples, "steelSocketMissingGrade8", {
				...sampleBase,
				expectedGrade: decoded.grade,
			});
		}

		if (isFineCandidate(decoded)) {
			totals.fineThreadDecoded += 1;
			if (normalize(attrs.threadSeries || attrs.thread_series || "") !== "fine") {
				totals.fineThreadCurrentlyMissingOrWrong += 1;
				pushSample(samples, "fineThreadMissingOrWrong", {
					...sampleBase,
					expectedThreadPitch: decoded.threadPitch,
					expectedThreadSeries: decoded.threadSeries,
				});
			}
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
					grade: decoded.grade,
				},
				mismatches,
			});
		}
	}

	console.log("===== SOCKET HEAD CAP SCREW AUDIT =====");
	console.log(JSON.stringify({
		totals,
		counts: Object.fromEntries(Object.entries(counts).map(([key, map]) => [key, toSortedCountArray(map)])),
		samples,
	}, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Socket head cap screw audit failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});

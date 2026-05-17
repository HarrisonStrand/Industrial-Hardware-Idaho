import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function asObject(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const COARSE_BY_DIAMETER = {
	"#0": "80",
	"#1": "64",
	"#2": "56",
	"#3": "48",
	"#4": "40",
	"#5": "40",
	"#6": "32",
	"#8": "32",
	"#10": "24",
	"#12": "24",
};

const FINE_BY_DIAMETER = {
	"#1": "72",
	"#2": "64",
	"#3": "56",
	"#4": "48",
	"#5": "44",
	"#6": "40",
	"#8": "36",
	"#10": "32",
	"#12": "28",
};

const NUMBERED_DIAMETERS = new Set([
	"0",
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"8",
	"10",
	"12",
]);

function normalizeNumberedDiameter(value = "") {
	const raw = clean(value).replace(/\s+/g, "");
	if (!raw) return "";

	const simple = raw.match(/^#?(\d+)$/);
	if (simple?.[1] && NUMBERED_DIAMETERS.has(simple[1])) {
		return `#${simple[1]}`;
	}

	const combined = raw.match(/^#?(\d+)-(\d+(?:\.\d+)?)$/);
	if (combined?.[1] && NUMBERED_DIAMETERS.has(combined[1])) {
		return `#${combined[1]}`;
	}

	return "";
}

function extractPitchFromCombined(value = "") {
	const raw = clean(value).replace(/\s+/g, "");
	const combined = raw.match(/^#?\d+-(\d+(?:\.\d+)?)$/);
	return combined?.[1] || "";
}

function inferSeries(diameter = "", threadPitch = "") {
	const dia = normalizeNumberedDiameter(diameter);
	const pitch = clean(threadPitch) || extractPitchFromCombined(diameter);

	if (!dia || !pitch) return "";
	if (COARSE_BY_DIAMETER[dia] === pitch) return "coarse";
	if (FINE_BY_DIAMETER[dia] === pitch) return "fine";
	return "";
}

function mapReviewStatusFromReadiness(readiness = {}, product = {}) {
	if (product?.isPublished) return "published";
	if (product?.review?.status === "approved") return "approved";
	if (readiness?.publishReady) return "ready";
	return "needs-review";
}

function isTargetHexHead(enrichment = {}) {
	const category = normalize(enrichment?.category || "");
	const subcategory = normalize(enrichment?.subcategory || "");
	const familyType = normalize(
		enrichment?.attributes?.familyType ||
			enrichment?.attributes?.fastenerTypeCanonical ||
			enrichment?.attributes?.fastenerType ||
			"",
	);

	return (
		category === "bolts" &&
		subcategory === "hex cap screws" &&
		(
			familyType === "hex cap screw" ||
			familyType === "heavy hex bolt" ||
			familyType === "structural bolt"
		)
	);
}

async function recomputeAndPersist(productId) {
	const product = await Product.findById(productId);
	const enrichment = await ProductEnrichment.findOne({ productId });
	if (!product || !enrichment) return null;

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
	return nextStatus;
}

async function main() {
	const dryRun = process.argv.includes("--dry-run");

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log(dryRun ? "DRY RUN: no changes will be saved" : "LIVE RUN: changes will be saved");

	const enrichments = await ProductEnrichment.find({
		category: /^bolts$/i,
		subcategory: /^hex cap screws$/i,
	}).lean();

	const summary = {
		scanned: enrichments.length,
		targetHexHeads: 0,
		eligibleNumberedThreads: 0,
		alreadyHadSeries: 0,
		updated: 0,
		missingPitch: 0,
		unknownSeries: 0,
		recomputed: 0,
	};

	const samples = {
		updated: [],
		unknownSeries: [],
		missingPitch: [],
	};

	for (const enrichment of enrichments) {
		if (!isTargetHexHead(enrichment)) continue;
		summary.targetHexHeads += 1;

		const attrs = { ...(enrichment.attributes || {}) };
		const measurementSystem = normalize(attrs.measurementSystem || "");
		if (measurementSystem === "metric") continue;

		const diameter = clean(attrs.diameter || attrs.size || "");
		let threadPitch = clean(attrs.threadPitch || "");
		const existingSeries = clean(attrs.threadSeries || attrs.thread_series || "");
		const detectedDiameter = normalizeNumberedDiameter(diameter);
		const pitchFromCombined = extractPitchFromCombined(diameter || attrs.size || "");

		if (!threadPitch && pitchFromCombined) {
			threadPitch = pitchFromCombined;
		}

		if (!detectedDiameter) continue;
		summary.eligibleNumberedThreads += 1;

		const partNumber = clean(attrs.fishbowlPartNum || attrs.sku || "");
		const sample = {
			productId: String(enrichment.productId),
			partNumber,
			title: enrichment.title || "",
			diameter,
			threadPitch,
			existingSeries,
		};

		if (!threadPitch) {
			summary.missingPitch += 1;
			if (samples.missingPitch.length < 20) samples.missingPitch.push(sample);
			continue;
		}

		const nextSeries = inferSeries(diameter, threadPitch);
		if (!nextSeries) {
			summary.unknownSeries += 1;
			if (samples.unknownSeries.length < 20) samples.unknownSeries.push(sample);
			continue;
		}

		if (existingSeries === nextSeries) {
			summary.alreadyHadSeries += 1;
			continue;
		}

		summary.updated += 1;
		if (samples.updated.length < 30) {
			samples.updated.push({ ...sample, nextSeries });
		}

		if (!dryRun) {
			await ProductEnrichment.updateOne(
				{ _id: enrichment._id },
				{
					$set: {
						"attributes.threadPitch": threadPitch,
						"attributes.threadSeries": nextSeries,
						"attributes.thread_series": nextSeries,
					},
				},
			);

			await recomputeAndPersist(enrichment.productId);
			summary.recomputed += 1;
		}
	}

	console.log("===== NUMBERED IMPERIAL THREAD SERIES SUMMARY =====");
	console.log(JSON.stringify(summary, null, 2));
	console.log("===== SAMPLES =====");
	console.log(JSON.stringify(samples, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Numbered imperial thread-series backfill failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});

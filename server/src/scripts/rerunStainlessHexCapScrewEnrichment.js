import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import createProductEnrichmentFromProduct from "../services/catalog/createProductEnrichmentFromProduct.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";

function asObject(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}


function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function fractionFromSixteenthsCode(code = "") {
	const raw = String(code || "").trim();
	const digits = raw.replace(/\D/g, "");
	if (!digits) return "";

	if (/^\d{4}$/.test(digits)) {
		const whole = Number(digits.slice(0, 2));
		const sixteenths = Number(digits.slice(2, 4));
		if (!Number.isFinite(whole) || !Number.isFinite(sixteenths)) return "";
		if (sixteenths === 0) return String(whole);
		const gcd = (a, b) => (b ? gcd(b, a % b) : a);
		const divisor = gcd(sixteenths, 16);
		const num = sixteenths / divisor;
		const den = 16 / divisor;
		return whole > 0 ? `${whole} ${num}/${den}` : `${num}/${den}`;
	}

	const wholeSixteenths = Number(digits);
	if (!Number.isFinite(wholeSixteenths) || wholeSixteenths <= 0) return "";
	const whole = Math.floor(wholeSixteenths / 16);
	const remainder = wholeSixteenths % 16;
	if (remainder === 0) return String(whole);
	const gcd = (a, b) => (b ? gcd(b, a % b) : a);
	const divisor = gcd(remainder, 16);
	const num = remainder / divisor;
	const den = 16 / divisor;
	return whole > 0 ? `${whole} ${num}/${den}` : `${num}/${den}`;
}

function imperialDiameterFromCode(code = "") {
	const normalized = String(code || "").trim().toUpperCase();
	const map = {
		"010": "#10",
		"011": "#10",
		"04": "1/4",
		"05": "5/16",
		"06": "3/8",
		"07": "7/16",
		"08": "1/2",
		"09": "9/16",
		"10": "5/8",
		"12": "3/4",
		"14": "7/8",
		"16": "1",
		"18": "1-1/8",
		"20": "1-1/4",
		"22": "1-3/8",
		"24": "1-1/2",
		"26": "2",
		"040": "1/4",
		"050": "5/16",
		"060": "3/8",
		"070": "7/16",
		"080": "1/2",
		"090": "9/16",
		"100": "5/8",
		"120": "3/4",
		"140": "7/8",
		"160": "1",
		"180": "1-1/8",
		"200": "1-1/4",
		"220": "1-3/8",
		"240": "1-1/2",
		"260": "2",
	};
	return map[normalized] || "";
}

function inferImperialThreadPitchBySeries(diameter = "", series = "") {
	const dia = clean(diameter);
	const normalizedSeries = String(series || "").trim().toUpperCase();
	const coarseMap = {
		"#10": "24",
		"1/4": "20",
		"5/16": "18",
		"3/8": "16",
		"7/16": "14",
		"1/2": "13",
		"9/16": "12",
		"5/8": "11",
		"3/4": "10",
		"7/8": "9",
		"1": "8",
		"1-1/8": "7",
		"1-1/4": "7",
		"1-3/8": "6",
		"1-1/2": "6",
		"2": "4.5",
	};
	const fineMap = {
		"#10": "32",
		"1/4": "28",
		"5/16": "24",
		"3/8": "24",
		"7/16": "20",
		"1/2": "20",
		"9/16": "18",
		"5/8": "18",
		"3/4": "16",
		"7/8": "14",
		"1": "12",
		"1-1/8": "8",
		"1-1/4": "8",
		"1-3/8": "8",
		"1-1/2": "8",
		"2": "6",
	};
	return normalizedSeries === "F" ? fineMap[dia] || "" : coarseMap[dia] || "";
}

function decodeLooseStainlessHexThreadFromText(product = {}) {
	const text = [
		product?.fishbowl?.partNum,
		product?.sku,
		product?.internalPartNumber,
		product?.fishbowl?.description,
	].filter(Boolean).join(" ").toUpperCase();

	const match = text.match(/(?:^|[^A-Z0-9])SSCS(\d{2,3})(\d{4})([CF])(?:[^A-Z0-9]|$)/i);
	if (!match) return null;

	const [, diaCode = "", lenCode = "", seriesCode = ""] = match;
	const diameter = imperialDiameterFromCode(diaCode);
	const threadSeries = seriesCode.toUpperCase() === "F" ? "fine" : "coarse";
	const threadPitch = inferImperialThreadPitchBySeries(diameter, seriesCode);

	return {
		measurementSystem: "imperial",
		diameter,
		length: fractionFromSixteenthsCode(lenCode),
		threadSeries,
		threadPitch,
	};
}

function hasImperialStainlessHexSignal(product = {}) {
	const text = [
		product?.fishbowl?.partNum,
		product?.sku,
		product?.internalPartNumber,
		product?.fishbowl?.description,
	].filter(Boolean).join(" ");

	return /(?:^|[^A-Z0-9])SSCS[A-Z0-9-]*/i.test(text);
}

function hasMetricStainlessHexSignal(product = {}) {
	const partText = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "").toUpperCase();
	const description = clean(product?.fishbowl?.description || "");
	return partText.startsWith("MMCS") && /(?:^|\s)(?:s\/s|ss)\s*$/i.test(description);
}

function detectStainlessGrade(product = {}) {
	const text = [
		product?.fishbowl?.description,
		product?.fishbowl?.partNum,
		product?.sku,
		product?.internalPartNumber,
	].filter(Boolean).join(" ");

	if (/\b316\s*(?:s\/?s|ss|stainless)?\b/i.test(text)) return "316";
	if (/\ba4[-\s]?70\b/i.test(text)) return "316";
	if (/\b304\s*(?:s\/?s|ss|stainless)?\b/i.test(text)) return "304";
	if (/\ba2[-\s]?70\b/i.test(text)) return "304";
	return "304";
}

async function forceStainlessHexAttributes(productId) {
	const product = await Product.findById(productId);
	const enrichment = await ProductEnrichment.findOne({ productId });

	if (!product || !enrichment) {
		return { forced: false, reason: "missing product or enrichment" };
	}

	const isStainlessHex = hasImperialStainlessHexSignal(product) || hasMetricStainlessHexSignal(product);
	if (!isStainlessHex) return { forced: false, reason: "not stainless hex signal" };

	const attrs = { ...(enrichment.attributes?.toObject?.() || enrichment.attributes || {}) };
	const looseThread = decodeLooseStainlessHexThreadFromText(product);

	if (looseThread) {
		attrs.measurementSystem = looseThread.measurementSystem || attrs.measurementSystem || "imperial";
		if (looseThread.diameter) attrs.diameter = looseThread.diameter;
		if (looseThread.length) attrs.length = looseThread.length;
		if (looseThread.threadPitch) attrs.threadPitch = looseThread.threadPitch;
		if (looseThread.threadSeries) {
			attrs.threadSeries = looseThread.threadSeries;
			attrs.thread_series = looseThread.threadSeries;
		}
	}

	attrs.material = "stainless steel";
	attrs.finish = "";
	attrs.displayMaterial = "stainless steel";
	attrs.displayFinish = "";
	attrs.materialFinish = "stainless steel";
	attrs.grade = detectStainlessGrade(product);
	attrs.categoryCanonical = "bolts";
	attrs.subcategoryCanonical = "hex cap screws";
	attrs.familyType = "hex cap screw";
	attrs.fastenerType = "hex cap screw";
	attrs.fastenerTypeCanonical = "hex cap screw";
	attrs.headType = attrs.headType || "hex";
	attrs.driveType = attrs.driveType || attrs.drive_type || "hex";
	attrs.drive_type = attrs.drive_type || attrs.driveType || "hex";

	enrichment.category = "bolts";
	enrichment.subcategory = "hex cap screws";
	enrichment.attributes = attrs;
	enrichment.markModified("attributes");

	await enrichment.save();

	return {
		forced: true,
		material: attrs.material,
		finish: attrs.finish,
		grade: attrs.grade,
		materialFinish: attrs.materialFinish,
	};
}

function buildStainlessHexCandidateQuery() {
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

function mapReviewStatusFromReadiness(readiness = {}, product = {}) {
	if (product?.isPublished) return "published";
	if (product?.review?.status === "approved") return "approved";
	if (readiness?.publishReady) return "ready";
	return "needs-review";
}

async function recomputeAndPersist(productId) {
	const product = await Product.findById(productId);
	const enrichment = await ProductEnrichment.findOne({ productId });

	if (!product || !enrichment) {
		return { status: "skipped", productId, reason: "missing product or enrichment" };
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
		publishReady: !!readiness.publishReady,
		qualityScore: Number(readiness.qualityScore || 0),
	};
}

async function main() {
	const dryRun = process.argv.includes("--dry-run");

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const products = await Product.find(buildStainlessHexCandidateQuery(), {
		_id: 1,
		sku: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
	}).lean();

	const productIds = [...new Set(products.map((item) => String(item._id)))];
	console.log(`Found ${productIds.length} stainless hex cap screw candidates`);

	console.log("Sample candidates:");
	console.log(JSON.stringify(products.slice(0, 20).map((item) => ({
		id: String(item._id),
		partNumber: item?.fishbowl?.partNum || item?.sku || "",
		description: item?.fishbowl?.description || "",
	})), null, 2));

	if (dryRun) {
		await mongoose.disconnect();
		console.log("✅ Dry run only. No products were changed.");
		return;
	}

	const summary = {
		total: productIds.length,
		enriched: 0,
		recomputed: 0,
		ready: 0,
		needsReview: 0,
		approved: 0,
		published: 0,
		failed: 0,
		forcedAttributeUpdates: 0,
		failures: [],
	};

	let processed = 0;
	for (const productId of productIds) {
		try {
			await createProductEnrichmentFromProduct(productId);
			summary.enriched += 1;

			const forced = await forceStainlessHexAttributes(productId);
			if (forced.forced) {
				summary.forcedAttributeUpdates += 1;
			}

			const result = await recomputeAndPersist(productId);
			summary.recomputed += 1;

			if (result.reviewStatus === "ready") summary.ready += 1;
			if (result.reviewStatus === "needs-review") summary.needsReview += 1;
			if (result.reviewStatus === "approved") summary.approved += 1;
			if (result.reviewStatus === "published") summary.published += 1;
		} catch (err) {
			summary.failed += 1;
			if (summary.failures.length < 20) {
				summary.failures.push({ productId, error: err.message });
			}
		}

		processed += 1;
		if (processed % 100 === 0) {
			console.log(`Processed ${processed}/${productIds.length}`);
		}
	}

	console.log("===== STAINLESS HEX CAP SCREW ENRICHMENT SUMMARY =====");
	console.log(JSON.stringify(summary, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Stainless hex cap screw enrichment failed:", err);
	try { await mongoose.disconnect(); } catch {}
	process.exit(1);
});

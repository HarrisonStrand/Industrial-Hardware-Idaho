import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";

const dryRun = process.argv.includes("--dry-run");

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}


const VALID_IMAGE_STATUSES = new Set(["none", "matched", "partial", "needs-cleanup", "approved"]);
const VALID_IMAGE_SOURCES = new Set(["vendor", "manual", "generated", "website", "unknown"]);

function sanitizeImageEnums(enrichment) {
	if (!enrichment) return;

	const currentImageStatus = clean(enrichment.imageStatus || "");
	if (!VALID_IMAGE_STATUSES.has(currentImageStatus)) {
		enrichment.imageStatus = Array.isArray(enrichment.images) && enrichment.images.length > 0 ? "matched" : "none";
	}

	if (Array.isArray(enrichment.images)) {
		for (const image of enrichment.images) {
			const source = clean(image?.source || "");
			if (!VALID_IMAGE_SOURCES.has(source)) {
				image.source = source === "family-manifest" ? "generated" : "unknown";
			}
		}
		enrichment.markModified("images");
	}
}

function asObject(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function fractionFromSixteenthsCode(code = "") {
	const digits = String(code || "").replace(/\D/g, "");
	if (!/^\d{4}$/.test(digits)) return "";
	const whole = Number(digits.slice(0, 2));
	const sixteenths = Number(digits.slice(2, 4));
	if (!Number.isFinite(whole) || !Number.isFinite(sixteenths)) return "";
	if (sixteenths === 0) return String(whole);
	const gcd = (a, b) => (b ? gcd(b, a % b) : a);
	const divisor = gcd(sixteenths, 16);
	const num = sixteenths / divisor;
	const den = 16 / divisor;
	return whole > 0 ? `${whole}-${num}/${den}` : `${num}/${den}`;
}

function imperialDiameterFromCode(code = "") {
	const map = {
		"010": "#10", "011": "#10",
		"04": "1/4", "05": "5/16", "06": "3/8", "07": "7/16", "08": "1/2", "09": "9/16", "10": "5/8", "12": "3/4", "14": "7/8", "16": "1", "18": "1-1/8", "20": "1-1/4", "22": "1-3/8", "24": "1-1/2", "26": "2",
		"040": "1/4", "050": "5/16", "060": "3/8", "070": "7/16", "080": "1/2", "090": "9/16", "100": "5/8", "120": "3/4", "140": "7/8", "160": "1", "180": "1-1/8", "200": "1-1/4", "220": "1-3/8", "240": "1-1/2", "260": "2",
	};
	return map[String(code || "").trim().toUpperCase()] || "";
}

const COARSE_PITCH = {
	"#10": "24", "1/4": "20", "5/16": "18", "3/8": "16", "7/16": "14", "1/2": "13", "9/16": "12", "5/8": "11", "3/4": "10", "7/8": "9", "1": "8", "1-1/8": "7", "1-1/4": "7", "1-3/8": "6", "1-1/2": "6", "2": "4.5",
};

const CSA_DIAMETER_CODES = [
	"010", "011", "040", "050", "060", "070", "080", "090", "100", "120", "140", "160", "180", "200", "220", "240", "260",
	"04", "05", "06", "07", "08", "09", "10", "12", "14", "16", "18", "20", "22", "24", "26",
];

const CSA_SUFFIX_PATTERN = "PLAIN|PL|GALVANIZED|GALV|HDG|ZINC|ZN|P|G";
const CSA_SEARCH_REGEX = new RegExp(
	`(?:^|[^A-Z0-9])CSA[0-9]{5,7}(?:\\s*[-_/]?\\s*(?:${CSA_SUFFIX_PATTERN}))?(?=[^A-Z0-9]|$)`,
	"i",
);
const CSA_DECODE_REGEX = new RegExp(
	`(?:^|[^A-Z0-9])CSA([0-9]{5,7})(?:\\s*[-_/]?\\s*(${CSA_SUFFIX_PATTERN}))?(?=[^A-Z0-9]|$)`,
	"i",
);

function normalizeCsaSuffix(value = "") {
	const suffix = clean(value).toUpperCase();
	if (["P", "PL", "PLAIN"].includes(suffix)) return "P";
	if (["G", "GALV", "GALVANIZED", "HDG"].includes(suffix)) return "G";
	if (["Z", "ZN", "ZINC"].includes(suffix)) return "Z";
	return "";
}

function finishFromCsaSuffix(value = "") {
	const normalized = normalizeCsaSuffix(value);
	if (normalized === "P") return "plain";
	if (normalized === "G") return "galvanized";
	return "zinc";
}

function decodeCsaA307(value = "") {
	const raw = String(value || "").trim().toUpperCase();
	const match = raw.match(CSA_DECODE_REGEX);
	if (!match) return null;
	const digits = match[1] || "";
	const suffix = normalizeCsaSuffix(match[2] || "");
	const candidates = [];
	for (const diaCode of CSA_DIAMETER_CODES) {
		if (!digits.startsWith(diaCode)) continue;
		const rawLenCode = digits.slice(diaCode.length);
		if (![3, 4].includes(rawLenCode.length)) continue;
		const diameter = imperialDiameterFromCode(diaCode);
		if (!diameter) continue;
		const lenCode = rawLenCode.length === 3 ? `0${rawLenCode}` : rawLenCode;
		const length = fractionFromSixteenthsCode(lenCode);
		if (!length) continue;
		candidates.push({ diaCode, rawLenCode, lenCode, diameter, length, wasMissingLengthLeadingZero: rawLenCode.length === 3 });
	}
	if (!candidates.length) return null;
	const best = candidates.sort((a, b) => {
		if (a.rawLenCode.length !== b.rawLenCode.length) return b.rawLenCode.length - a.rawLenCode.length;
		return b.diaCode.length - a.diaCode.length;
	})[0];
	const finish = finishFromCsaSuffix(suffix);
	return {
		familyType: "hex cap screw",
		measurementSystem: "imperial",
		diameter: best.diameter,
		length: best.length,
		threadPitch: COARSE_PITCH[best.diameter] || "",
		threadSeries: COARSE_PITCH[best.diameter] ? "coarse" : "",
		threadCoverage: "partial",
		grade: "A307",
		material: "steel",
		finish,
		displayMaterial: "steel",
		displayFinish: finish,
		materialFinish: finish ? `steel / ${finish}` : "steel",
		wasMissingLengthLeadingZero: best.wasMissingLengthLeadingZero,
		rawCsaDigits: digits,
		diaCode: best.diaCode,
		lenCode: best.lenCode,
		suffix,
	};
}

function decodeProduct(product = {}) {
	return decodeCsaA307([
		product?.fishbowl?.partNum || "",
		product?.sku || "",
		product?.internalPartNumber || "",
		product?.fishbowl?.description || "",
	].filter(Boolean).join(" "));
}

function mapReviewStatusFromReadiness(readiness = {}, product = {}) {
	if (product?.isPublished) return "published";
	if (product?.review?.status === "approved") return "approved";
	if (readiness?.publishReady) return "ready";
	return "needs-review";
}

function titleCase(value = "") {
	return clean(value).replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTitle(decoded = {}, partNumber = "") {
	const finishLabel = decoded.finish === "zinc" ? "Zinc" : titleCase(decoded.finish || "");
	return clean(`A307 Hex Cap Screw - ${decoded.diameter}-${decoded.threadPitch} x ${decoded.length}${finishLabel ? ` - ${finishLabel}` : ""}${partNumber ? ` (${partNumber})` : ""}`);
}

async function recomputeAndPersist(product, enrichment) {
	const readiness = await evaluateProductPublishReadiness(product._id, { includeSimilarFamilies: false });
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
	product.catalogStatus = product.isPublished ? "published" : readiness.publishReady ? "ready" : "enriched";

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

	sanitizeImageEnums(enrichment);
	await product.save();
	await enrichment.save();
	return nextStatus;
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log(dryRun ? "🔎 Dry run only; no changes will be saved" : "✍️ Applying A307 CSA hex cap screw backfill");

	const products = await Product.find({
		$or: [
			{ "fishbowl.partNum": CSA_SEARCH_REGEX },
			{ sku: CSA_SEARCH_REGEX },
			{ internalPartNumber: CSA_SEARCH_REGEX },
			{ "fishbowl.description": CSA_SEARCH_REGEX },
		],
	}).lean(false);

	const summary = { matched: products.length, decoded: 0, skippedMissingEnrichment: 0, skippedUnrecognized: 0, updated: 0, dryRun, missingLengthLeadingZero: 0, recomputedReady: 0, recomputedNeedsReview: 0 };
	const samples = [];

	for (const product of products) {
		const decoded = decodeProduct(product);
		const partNumber = product?.fishbowl?.partNum || product?.sku || "";
		if (!decoded) {
			summary.skippedUnrecognized += 1;
			continue;
		}
		summary.decoded += 1;
		if (decoded.wasMissingLengthLeadingZero) summary.missingLengthLeadingZero += 1;

		const enrichment = await ProductEnrichment.findOne({ productId: product._id });
		if (!enrichment) {
			summary.skippedMissingEnrichment += 1;
			continue;
		}

		const attrs = { ...(enrichment.attributes?.toObject?.() || enrichment.attributes || {}) };
		const nextAttrs = {
			...attrs,
			categoryCanonical: "bolts",
			subcategoryCanonical: "hex cap screws",
			familyType: "hex cap screw",
			fastenerType: "hex cap screw",
			fastenerTypeCanonical: "hex cap screw",
			headType: "hex",
			driveType: "hex",
			drive_type: "hex",
			measurementSystem: "imperial",
			diameter: decoded.diameter,
			length: decoded.length,
			threadPitch: decoded.threadPitch,
			threadSeries: decoded.threadSeries,
			thread_series: decoded.threadSeries,
			threadCoverage: decoded.threadCoverage,
			thread_coverage: decoded.threadCoverage,
			material: decoded.material,
			finish: decoded.finish,
			displayMaterial: decoded.displayMaterial,
			displayFinish: decoded.displayFinish,
			materialFinish: decoded.materialFinish,
			grade: decoded.grade,
			fishbowlPartNum: product?.fishbowl?.partNum || "",
			fishbowlDescription: clean(product?.fishbowl?.description || ""),
			sku: product?.sku || "",
			internalPartNumber: product?.internalPartNumber || "",
			a307CsaAudit: {
				rawCsaDigits: decoded.rawCsaDigits,
				diaCode: decoded.diaCode,
				lenCode: decoded.lenCode,
				suffix: decoded.suffix,
				wasMissingLengthLeadingZero: !!decoded.wasMissingLengthLeadingZero,
				lastBackfilledAt: new Date(),
			},
		};

		const nextTitle = buildTitle(decoded, partNumber);
		if (samples.length < 20) {
			samples.push({ partNumber, description: product?.fishbowl?.description || "", decoded, previous: { title: enrichment.title, attributes: attrs }, next: { title: nextTitle, attributes: nextAttrs } });
		}

		if (!dryRun) {
			enrichment.category = "bolts";
			enrichment.subcategory = "hex cap screws";
			enrichment.title = nextTitle;
			enrichment.shortTitle = nextTitle;
			enrichment.shortDescription = clean(`${nextTitle}${partNumber ? ` (${partNumber})` : ""}`);
			enrichment.attributes = nextAttrs;
			enrichment.markModified("attributes");
			sanitizeImageEnums(enrichment);
			await enrichment.save();

			const status = await recomputeAndPersist(product, enrichment);
			if (status === "ready") summary.recomputedReady += 1;
			if (status === "needs-review") summary.recomputedNeedsReview += 1;
		}

		summary.updated += 1;
	}

	console.log("===== A307 CSA HEX CAP SCREW BACKFILL SUMMARY =====");
	console.log(JSON.stringify({ summary, samples }, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ A307 backfill failed:", err);
	try { await mongoose.disconnect(); } catch {}
	process.exit(1);
});

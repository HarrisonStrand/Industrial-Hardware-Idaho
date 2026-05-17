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

function fractionFromSixteenthsCode(code = "") {
	const digits = String(code || "").replace(/\D/g, "");
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
		return whole > 0 ? `${whole}-${num}/${den}` : `${num}/${den}`;
	}

	return "";
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

	const finish = finishFromCsaSuffix(suffix);
	if (!candidates.length) {
		return { matched: true, unrecognizedCsaFormat: true, rawCsaDigits: digits, suffix, finish };
	}

	const best = candidates.sort((a, b) => {
		if (a.rawLenCode.length !== b.rawLenCode.length) return b.rawLenCode.length - a.rawLenCode.length;
		return b.diaCode.length - a.diaCode.length;
	})[0];

	return {
		matched: true,
		measurementSystem: "imperial",
		diameter: best.diameter,
		length: best.length,
		threadPitch: COARSE_PITCH[best.diameter] || "",
		threadSeries: COARSE_PITCH[best.diameter] ? "coarse" : "",
		grade: "A307",
		material: "steel",
		finish,
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

function same(a = "", b = "") {
	return normalize(a) === normalize(b);
}

function pushSample(samples, key, sample, max = 20) {
	if (!samples[key]) samples[key] = [];
	if (samples[key].length < max) samples[key].push(sample);
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const products = await Product.find({
		$or: [
			{ "fishbowl.partNum": CSA_SEARCH_REGEX },
			{ sku: CSA_SEARCH_REGEX },
			{ internalPartNumber: CSA_SEARCH_REGEX },
			{ "fishbowl.description": CSA_SEARCH_REGEX },
		],
	}, {
		_id: 1,
		sku: 1,
		internalPartNumber: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
		"review.status": 1,
		"review.publishReady": 1,
		isPublished: 1,
	}).lean();

	const enrichments = await ProductEnrichment.find({ productId: { $in: products.map((p) => p._id) } }, {
		productId: 1,
		title: 1,
		category: 1,
		subcategory: 1,
		attributes: 1,
	}).lean();
	const enrichmentMap = new Map(enrichments.map((e) => [String(e.productId), e]));

	const totals = {
		candidateProducts: products.length,
		decoded: 0,
		unrecognizedCsaFormat: 0,
		missingLengthLeadingZero: 0,
		missingEnrichment: 0,
		wrongAttributes: 0,
		publishReady: 0,
		published: 0,
	};
	const samples = {};

	for (const product of products) {
		const decoded = decodeProduct(product);
		const enrichment = enrichmentMap.get(String(product._id));
		const attrs = enrichment?.attributes || {};
		const sample = {
			id: String(product._id),
			partNumber: product?.fishbowl?.partNum || "",
			sku: product?.sku || "",
			description: product?.fishbowl?.description || "",
			title: enrichment?.title || "",
			current: {
				category: enrichment?.category || "",
				subcategory: enrichment?.subcategory || "",
				familyType: attrs.familyType || "",
				diameter: attrs.diameter || "",
				length: attrs.length || "",
				threadPitch: attrs.threadPitch || "",
				threadSeries: attrs.threadSeries || attrs.thread_series || "",
				grade: attrs.grade || "",
				material: attrs.material || "",
				finish: attrs.finish || "",
				materialFinish: attrs.materialFinish || "",
			},
			decoded,
			reviewStatus: product?.review?.status || "needs-review",
			publishReady: !!product?.review?.publishReady,
		};

		if (!decoded || decoded.unrecognizedCsaFormat) {
			totals.unrecognizedCsaFormat += 1;
			pushSample(samples, "unrecognizedCsaFormat", sample);
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
		if (product?.review?.publishReady) totals.publishReady += 1;
		if (product?.isPublished) totals.published += 1;

		const bad =
			!same(enrichment.category, "bolts") ||
			!same(enrichment.subcategory, "hex cap screws") ||
			!same(attrs.familyType, "hex cap screw") ||
			!same(attrs.grade, "A307") ||
			!same(attrs.material, "steel") ||
			!same(attrs.finish, decoded.finish) ||
			!same(attrs.materialFinish, decoded.materialFinish) ||
			!same(attrs.diameter, decoded.diameter) ||
			!same(attrs.length, decoded.length) ||
			!same(attrs.threadPitch, decoded.threadPitch) ||
			!same(attrs.threadSeries || attrs.thread_series, decoded.threadSeries);

		if (bad) {
			totals.wrongAttributes += 1;
			pushSample(samples, "wrongAttributes", sample);
		}
	}

	console.log("===== A307 CSA HEX CAP SCREW AUDIT =====");
	console.log(JSON.stringify({ totals, samples }, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ A307 audit failed:", err);
	try { await mongoose.disconnect(); } catch {}
	process.exit(1);
});

import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import detectProductFamilyFromDescription from "../services/catalog/detectProductFamilyFromDescription.js";

const HEX_NUT_PART_PATTERN = /^\s*(?:HN[258][CF]\d{2,3}(?:P|PL)?|SSHN\d{3}(?:[CF])?|MMHN\d{5}(?:SS|P)?|HHN\d{3}(?:[CF])?)\s*$/i;

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function argValue(name, fallback = "") {
	const prefix = `--${name}=`;
	const found = process.argv.find((arg) => arg.startsWith(prefix));
	return found ? found.slice(prefix.length).trim() : fallback;
}

function increment(map, key) {
	const safeKey = clean(key) || "(blank)";
	map.set(safeKey, (map.get(safeKey) || 0) + 1);
}

function toCountArray(map) {
	return Array.from(map.entries())
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function buildHexNutCandidateQuery() {
	return {
		$and: [
			{
				$or: [
					{ "fishbowl.partNum": HEX_NUT_PART_PATTERN },
					{ sku: HEX_NUT_PART_PATTERN },
					{ internalPartNumber: HEX_NUT_PART_PATTERN },
					{ "fishbowl.description": /\b(?:finished?\s+)?hex\s+nut(s)?\b/i },
					{ "fishbowl.description": /\bheavy\s+hex\s+nut(s)?\b/i },
					{ "fishbowl.description": /\bnut\b.*\bhex\b/i },
					{ "fishbowl.raw.parsedAttributes.fastenerType": /hex nut/i },
				],
			},
			{
				$nor: [
					{ "fishbowl.description": /locknut assy|assembly|assy|kit|assortment/i },
					{ "fishbowl.description": /lock\s*nut|locknut|nylock|nylon insert/i },
					{ "fishbowl.description": /coupling nut|wing nut|acorn nut|cap nut/i },
					{ "fishbowl.description": /flange nut|castle nut|square nut|tee nut|t-nut|weld nut|rivet nut|push nut/i },
				],
			},
		],
	};
}

function summarizeDetection(product = {}, detected = {}, enrichment = null) {
	return {
		id: String(product._id),
		partNumber: clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || ""),
		description: clean(product?.fishbowl?.description || ""),
		existingCategory: enrichment?.category || "",
		existingSubcategory: enrichment?.subcategory || "",
		detected: {
			category: detected.category || "",
			subcategory: detected.subcategory || "",
			familyType: detected.familyType || "",
			diameter: detected.diameter || "",
			threadPitch: detected.threadPitch || "",
			threadSeries: detected.threadSeries || detected.thread_series || "",
			measurementSystem: detected.measurementSystem || "",
			materialFinish: detected.materialFinish || "",
			grade: detected.grade || "",
			familyKey: detected.familyKey || "",
		},
	};
}

async function main() {
	console.time("hexNutAudit");

	const limit = Math.max(0, Number(argValue("limit", "0")) || 0);

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	let query = Product.find(buildHexNutCandidateQuery(), {
		_id: 1,
		sku: 1,
		internalPartNumber: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
		"fishbowl.raw.parsedAttributes": 1,
		isPublished: 1,
		catalogStatus: 1,
	});

	query = query.sort({ "fishbowl.partNum": 1, sku: 1 });
	if (limit) query = query.limit(limit);

	const products = await query.lean();
	const productIds = products.map((item) => item._id);

	const enrichments = await ProductEnrichment.find(
		{ productId: { $in: productIds } },
		{ productId: 1, title: 1, category: 1, subcategory: 1, attributes: 1, quality: 1 },
	).lean();

	const enrichmentMap = new Map(enrichments.map((item) => [String(item.productId), item]));

	const counts = {
		category: new Map(),
		subcategory: new Map(),
		familyType: new Map(),
		materialFinish: new Map(),
		grade: new Map(),
		threadSeries: new Map(),
		threadPitch: new Map(),
		measurementSystem: new Map(),
	};

	const totals = {
		candidateProducts: products.length,
		existingEnrichment: 0,
		detectedHexNuts: 0,
		published: 0,
		missingDiameter: 0,
		missingThreadPitch: 0,
		missingMaterialFinish: 0,
		missingGrade: 0,
		wrongCategoryOrSubcategory: 0,
	};

	const samples = {
		detected: [],
		missing: [],
		wrongCategoryOrSubcategory: [],
	};

	for (const product of products) {
		const parsed = product?.fishbowl?.raw?.parsedAttributes || {};
		const detected = detectProductFamilyFromDescription({ product, parsed });
		const enrichment = enrichmentMap.get(String(product._id));

		if (enrichment) totals.existingEnrichment += 1;
		if (product?.isPublished) totals.published += 1;

		const isHexNut = normalize(detected.category) === "nuts" && normalize(detected.subcategory) === "hex nuts";
		if (isHexNut) totals.detectedHexNuts += 1;
		else totals.wrongCategoryOrSubcategory += 1;

		if (!clean(detected.diameter)) totals.missingDiameter += 1;
		if (!clean(detected.threadPitch)) totals.missingThreadPitch += 1;
		if (!clean(detected.materialFinish)) totals.missingMaterialFinish += 1;
		if (!clean(detected.grade)) totals.missingGrade += 1;

		increment(counts.category, detected.category);
		increment(counts.subcategory, detected.subcategory);
		increment(counts.familyType, detected.familyType);
		increment(counts.materialFinish, detected.materialFinish);
		increment(counts.grade, detected.grade);
		increment(counts.threadSeries, detected.threadSeries || detected.thread_series);
		increment(counts.threadPitch, detected.threadPitch);
		increment(counts.measurementSystem, detected.measurementSystem);

		const summary = summarizeDetection(product, detected, enrichment);
		if (samples.detected.length < 30) samples.detected.push(summary);
		if (
			(!clean(detected.diameter) || !clean(detected.threadPitch) || !clean(detected.materialFinish) || !clean(detected.grade)) &&
			samples.missing.length < 30
		) {
			samples.missing.push(summary);
		}
		if (!isHexNut && samples.wrongCategoryOrSubcategory.length < 30) {
			samples.wrongCategoryOrSubcategory.push(summary);
		}
	}

	console.log("===== HEX NUT AUDIT SUMMARY =====");
	console.log(JSON.stringify(totals, null, 2));

	console.log("===== DETECTED COUNTS =====");
	console.log(
		JSON.stringify(
			{
				category: toCountArray(counts.category),
				subcategory: toCountArray(counts.subcategory),
				familyType: toCountArray(counts.familyType),
				materialFinish: toCountArray(counts.materialFinish),
				grade: toCountArray(counts.grade),
				threadSeries: toCountArray(counts.threadSeries),
				threadPitch: toCountArray(counts.threadPitch).slice(0, 50),
				measurementSystem: toCountArray(counts.measurementSystem),
			},
			null,
			2,
		),
	);

	console.log("===== SAMPLES =====");
	console.log(JSON.stringify(samples, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
	console.timeEnd("hexNutAudit");
}

main().catch(async (err) => {
	console.error("❌ Hex nut audit failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});

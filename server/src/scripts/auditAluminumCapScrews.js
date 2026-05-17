import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

function clean(value = "") {
	return String(value || "")
		.replace(/[“”]/g, '"')
		.replace(/[’]/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function increment(map, key) {
	map.set(key, (map.get(key) || 0) + 1);
}

function toSortedCountArray(map) {
	return Array.from(map.entries())
		.map(([value, count]) => ({ value, count }))
		.sort(
			(a, b) =>
				b.count - a.count || String(a.value).localeCompare(String(b.value)),
		);
}

function pushSample(map, key, sample, max = 25) {
	if (!map.has(key)) map.set(key, []);
	const bucket = map.get(key);
	if (bucket.length < max) bucket.push(sample);
}

function buildAluminumCandidateQuery() {
	return {
		$and: [
			{
				$or: [
					{ "fishbowl.partNum": /^ALU/i },
					{ sku: /^ALU/i },
					{ internalPartNumber: /^ALU/i },
					{ "fishbowl.description": /\bALU[A-Z0-9-]*/i },
					{ "fishbowl.description": /\baluminum\b|\balum\b/i },
				],
			},
			{
				$nor: [
					{ "fishbowl.description": /\bassy\b|assembly|assortment|kit/i },
					{ "fishbowl.description": /auveco|specialty hardware/i },
				],
			},
		],
	};
}

function isLikelyCapScrewOrBolt(text = "") {
	const value = normalize(text);
	return (
		value.includes("cap screw") ||
		value.includes("c/s") ||
		value.includes("hex bolt") ||
		value.includes("hex head bolt") ||
		value.includes("button head") ||
		value.includes("socket head") ||
		value.includes("flat head") ||
		value.includes("bolt")
	);
}

function normalizeFractionToken(value = "") {
	let text = clean(value)
		.replace(/"/g, "")
		.replace(/\s*in(?:ch|ches)?\b/gi, "")
		.replace(/\s+/g, " ")
		.trim();

	// Keep mixed fractions display-safe and consistent for the builder/title.
	// Example: 2-3/4 and 2 3/4 should both save as 2-3/4.
	if (/^\d+\s+\d+\/\d+$/.test(text)) {
		text = text.replace(/\s+/, "-");
	}

	return text;
}

const NUMBERED_COARSE = {
	"0": "80",
	"1": "64",
	"2": "56",
	"3": "48",
	"4": "40",
	"5": "40",
	"6": "32",
	"8": "32",
	"10": "24",
	"12": "24",
};

const NUMBERED_FINE = {
	"0": "80",
	"1": "72",
	"2": "64",
	"3": "56",
	"4": "48",
	"5": "44",
	"6": "40",
	"8": "36",
	"10": "32",
	"12": "28",
};

const FRACTIONAL_COARSE = {
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
	"1 1/8": "7",
	"1-1/4": "7",
	"1 1/4": "7",
	"1-3/8": "6",
	"1 3/8": "6",
	"1-1/2": "6",
	"1 1/2": "6",
	"2": "4.5",
};

const FRACTIONAL_FINE = {
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
	"1 1/8": "8",
	"1-1/4": "8",
	"1 1/4": "8",
	"1-3/8": "8",
	"1 3/8": "8",
	"1-1/2": "8",
	"1 1/2": "8",
	"2": "6",
};

function normalizeDiameterBase(value = "") {
	let text = normalizeFractionToken(value);
	if (/^#?\d+$/.test(text)) return text.replace(/^#/, "");
	return text.replace(/\s+/g, "-");
}

function inferThreadSeries(diameter = "", threadPitch = "") {
	const dia = normalizeDiameterBase(diameter);
	const pitch = clean(threadPitch);
	if (!dia || !pitch) return "";

	if (NUMBERED_COARSE[dia] === pitch) return "coarse";
	if (NUMBERED_FINE[dia] === pitch) return "fine";
	if (FRACTIONAL_COARSE[dia] === pitch) return "coarse";
	if (FRACTIONAL_FINE[dia] === pitch) return "fine";

	return "";
}

function normalizeNumberedSize(diameter = "", threadPitch = "") {
	const dia = normalizeDiameterBase(diameter);
	const pitch = clean(threadPitch);
	if (!/^\d+$/.test(dia) || !pitch) return "";
	return `${dia}-${pitch}`;
}

function parseImperialFractionalDiameterLength(raw = "") {
	const text = clean(raw);
	const matches = [];
	const pattern = /(^|[^A-Z0-9#])((?:\d+-\d+\/\d+|\d+\s+\d+\/\d+|\d+\/\d+|\d+))\s*[x×]\s*((?:\d+-\d+\/\d+|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))(?:\s*"|\s*in\b)?/gi;

	let match;
	while ((match = pattern.exec(text))) {
		const diameter = normalizeDiameterBase(match[2]);
		const length = normalizeFractionToken(match[3]);
		if (!diameter || !length) continue;

		// Only accept known fractional bolt diameters here. This prevents the
		// length token in strings like 1/2X2-3/4 from being re-read as a
		// bogus 2-13 diameter/thread combination.
		if (!FRACTIONAL_COARSE[diameter] && !FRACTIONAL_FINE[diameter]) continue;

		matches.push({ diameter, length, index: match.index });
	}

	if (!matches.length) return null;
	matches.sort((a, b) => a.index - b.index);
	const selected = matches[0];
	const wantsFine = /\b(fine|unf|sae fine)\b/i.test(text);
	const threadPitch = wantsFine
		? FRACTIONAL_FINE[selected.diameter] || FRACTIONAL_COARSE[selected.diameter] || ""
		: FRACTIONAL_COARSE[selected.diameter] || "";

	return {
		measurementSystem: "imperial",
		diameter: selected.diameter,
		threadPitch,
		threadSeries: inferThreadSeries(selected.diameter, threadPitch),
		length: selected.length,
	};
}

function parseDescriptionAttributes(text = "") {
	const raw = clean(text);
	const normalizedText = normalize(raw);

	let familyType = "";
	let subcategory = "";
	let headType = "";
	let driveType = "";

	if (normalizedText.includes("button head")) {
		familyType = "button head cap screw";
		subcategory = "button head cap screws";
		headType = "button";
		driveType = "hex socket";
	} else if (normalizedText.includes("socket head") || normalizedText.includes("soc hd")) {
		familyType = "socket head cap screw";
		subcategory = "socket head cap screws";
		headType = normalizedText.includes("low head") ? "low socket" : "socket";
		driveType = "hex socket";
	} else if (normalizedText.includes("flat head")) {
		familyType = "flat head cap screw";
		subcategory = "flat head cap screws";
		headType = "flat";
		driveType = "hex socket";
	} else if (
		normalizedText.includes("hex") ||
		normalizedText.includes("c/s") ||
		normalizedText.includes("bolt")
	) {
		familyType = "hex cap screw";
		subcategory = "hex cap screws";
		headType = "hex";
		driveType = "hex";
	}

	function finishParsed(parsed = {}) {
		return {
			measurementSystem: parsed.measurementSystem || "",
			diameter: parsed.diameter || "",
			threadPitch: parsed.threadPitch || "",
			threadSeries: parsed.threadSeries || "",
			length: parsed.length || "",
			familyType,
			subcategory,
			headType,
			driveType,
		};
	}

	const metricPatterns = [
		/\b(M\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?\s*mm?)\b/i,
		/\b(M\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?\s*mm?)\s*[-–]\s*(\d+(?:\.\d+)?)\b/i,
	];

	for (const pattern of metricPatterns) {
		const match = raw.match(pattern);
		if (match) {
			const diameter = clean(match[1]).toUpperCase();
			const second = clean(match[2]);
			const third = clean(match[3]);
			const secondIsLength = /mm/i.test(second) || Number(second) > 10;
			const length = secondIsLength ? second : third;
			const threadPitch = secondIsLength ? third : second;
			return finishParsed({
				measurementSystem: "metric",
				diameter,
				threadPitch: clean(threadPitch).replace(/mm$/i, ""),
				threadSeries: "",
				length: /mm/i.test(length) ? clean(length).toLowerCase() : `${clean(length)}mm`,
			});
		}
	}

	const numberedPatterns = [
		/\b#?(\d+)\s*[-–]\s*(\d+(?:\.\d+)?)\s*[x×]\s*([0-9]+(?:[-\s][0-9]+\/[0-9]+|\/[0-9]+)?(?:\.\d+)?)(?:\s*"|\s*in\b)?/i,
	];

	for (const pattern of numberedPatterns) {
		const match = raw.match(pattern);
		if (match) {
			const [, dia = "", pitch = "", len = ""] = match;
			const diameter = normalizeNumberedSize(dia, pitch);
			const threadSeries = inferThreadSeries(dia, pitch);
			return finishParsed({
				measurementSystem: "imperial",
				diameter,
				threadPitch: clean(pitch),
				threadSeries,
				length: normalizeFractionToken(len),
			});
		}
	}

	// Aluminum Fishbowl descriptions often look like: ALU C/S USS 1/2X2-3/4.
	// Parse this as a diameter/length pair first, then infer the thread pitch
	// from the diameter. Do not let the length token become a bogus thread size.
	const fractionalPair = parseImperialFractionalDiameterLength(raw);
	if (fractionalPair) {
		return finishParsed(fractionalPair);
	}

	const fractionalWithPitchPatterns = [
		/\b(\d+(?:[-\s]\d+\/\d+|\/\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*[x×]\s*([0-9]+(?:[-\s][0-9]+\/[0-9]+|\/[0-9]+)?(?:\.\d+)?)(?:\s*"|\s*in\b)?/i,
	];

	for (const pattern of fractionalWithPitchPatterns) {
		const match = raw.match(pattern);
		if (match) {
			const diameterRaw = match[1];
			const threadPitch = clean(match[2]);
			const lengthRaw = match[3];
			const diameter = normalizeDiameterBase(diameterRaw);
			const threadSeries = inferThreadSeries(diameter, threadPitch);
			return finishParsed({
				measurementSystem: "imperial",
				diameter,
				threadPitch,
				threadSeries,
				length: normalizeFractionToken(lengthRaw),
			});
		}
	}

	return finishParsed();
}

function buildSample(product = {}, enrichment = null, parsed = {}) {
	const attrs = enrichment?.attributes || {};
	return {
		id: String(product._id),
		partNumber: product?.fishbowl?.partNum || product?.sku || "",
		sku: product?.sku || "",
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
		materialFinish: attrs.materialFinish || "",
		parsed,
		reviewStatus: product?.review?.status || "needs-review",
		publishReady: !!product?.review?.publishReady,
	};
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log("🔍 Auditing aluminum cap screw / bolt candidates");

	const products = await Product.find(buildAluminumCandidateQuery(), {
		_id: 1,
		sku: 1,
		internalPartNumber: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
		"review.status": 1,
		"review.publishReady": 1,
	}).lean();

	const enrichments = await ProductEnrichment.find(
		{ productId: { $in: products.map((item) => item._id) } },
		{
			productId: 1,
			title: 1,
			category: 1,
			subcategory: 1,
			attributes: 1,
		},
	).lean();

	const enrichmentMap = new Map(
		enrichments.map((item) => [String(item.productId), item]),
	);

	const totals = {
		candidateProducts: products.length,
		capScrewOrBoltCandidates: 0,
		missingEnrichment: 0,
		wrongMaterial: 0,
		wrongFinish: 0,
		wrongMaterialFinish: 0,
		descriptionSaysZincButAluPart: 0,
		numberedSizeHasHash: 0,
		numberedSizeNeedsNormalize: 0,
		missingDiameter: 0,
		missingThreadPitch: 0,
		missingThreadSeries: 0,
		missingLength: 0,
		unparsedDescription: 0,
		badFamilyTitleBase: 0,
	};

	const counts = {
		subcategory: new Map(),
		familyType: new Map(),
		material: new Map(),
		finish: new Map(),
		materialFinish: new Map(),
		measurementSystem: new Map(),
		diameter: new Map(),
		threadPitch: new Map(),
		threadSeries: new Map(),
	};

	const samples = {
		missingEnrichment: new Map(),
		wrongMaterial: new Map(),
		wrongFinish: new Map(),
		wrongMaterialFinish: new Map(),
		descriptionSaysZincButAluPart: new Map(),
		numberedSizeHasHash: new Map(),
		numberedSizeNeedsNormalize: new Map(),
		missingThreadSeries: new Map(),
		unparsedDescription: new Map(),
		badFamilyTitleBase: new Map(),
	};

	for (const product of products) {
		const enrichment = enrichmentMap.get(String(product._id));
		const sourceText = [
			product?.fishbowl?.description || "",
			product?.fishbowl?.partNum || "",
			product?.sku || "",
			enrichment?.title || "",
		]
			.filter(Boolean)
			.join(" ");

		if (!isLikelyCapScrewOrBolt(sourceText)) continue;
		totals.capScrewOrBoltCandidates += 1;

		const descriptionParsed = parseDescriptionAttributes(product?.fishbowl?.description || "");
		const parsed = descriptionParsed.diameter || descriptionParsed.length
			? descriptionParsed
			: parseDescriptionAttributes(sourceText);
		const sample = buildSample(product, enrichment, parsed);

		if (!enrichment) {
			totals.missingEnrichment += 1;
			pushSample(samples.missingEnrichment, "missingEnrichment", sample);
			continue;
		}

		const attrs = enrichment.attributes || {};
		const material = clean(attrs.material || "").toLowerCase();
		const finish = clean(attrs.finish || "").toLowerCase();
		const materialFinish = clean(attrs.materialFinish || "").toLowerCase();
		const diameter = clean(attrs.diameter || "");
		const threadPitch = clean(attrs.threadPitch || "");
		const threadSeries = clean(attrs.threadSeries || attrs.thread_series || "");
		const length = clean(attrs.length || "");

		increment(counts.subcategory, enrichment.subcategory || "(blank)");
		increment(
			counts.familyType,
			attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "(blank)",
		);
		increment(counts.material, material || "(blank)");
		increment(counts.finish, finish || "(blank)");
		increment(counts.materialFinish, materialFinish || "(blank)");
		increment(counts.measurementSystem, attrs.measurementSystem || "(blank)");
		increment(counts.diameter, diameter || "(blank)");
		increment(counts.threadPitch, threadPitch || "(blank)");
		increment(counts.threadSeries, threadSeries || "(blank)");

		if (material !== "aluminum") {
			totals.wrongMaterial += 1;
			pushSample(samples.wrongMaterial, "wrongMaterial", sample);
		}

		if (finish) {
			totals.wrongFinish += 1;
			pushSample(samples.wrongFinish, "wrongFinish", sample);
		}

		if (materialFinish !== "aluminum") {
			totals.wrongMaterialFinish += 1;
			pushSample(samples.wrongMaterialFinish, "wrongMaterialFinish", sample);
		}

		
		const familyTitleBase = clean(attrs.familyTitleBase || attrs.familyTitle || "").toLowerCase();
		if (familyTitleBase && !familyTitleBase.includes("aluminum")) {
			totals.badFamilyTitleBase += 1;
			pushSample(samples.badFamilyTitleBase, "badFamilyTitleBase", {
				...sample,
				familyTitleBase: attrs.familyTitleBase || "",
				familyTitle: attrs.familyTitle || "",
			});
		}

		if (/\bzinc\b/i.test(product?.fishbowl?.description || "")) {
			totals.descriptionSaysZincButAluPart += 1;
			pushSample(
				samples.descriptionSaysZincButAluPart,
				"descriptionSaysZincButAluPart",
				sample,
			);
		}

		if (/^#\d+/.test(diameter)) {
			totals.numberedSizeHasHash += 1;
			pushSample(samples.numberedSizeHasHash, "numberedSizeHasHash", sample);
		}

		if (/^#?\d+$/.test(diameter) && threadPitch) {
			totals.numberedSizeNeedsNormalize += 1;
			pushSample(
				samples.numberedSizeNeedsNormalize,
				"numberedSizeNeedsNormalize",
				sample,
			);
		}

		if (!diameter) totals.missingDiameter += 1;
		if (!threadPitch && parsed.measurementSystem === "imperial") totals.missingThreadPitch += 1;
		if (parsed.measurementSystem === "imperial" && !threadSeries) {
			totals.missingThreadSeries += 1;
			pushSample(samples.missingThreadSeries, "missingThreadSeries", sample);
		}
		if (!length) totals.missingLength += 1;

		if (!parsed.diameter || !parsed.length) {
			totals.unparsedDescription += 1;
			pushSample(samples.unparsedDescription, "unparsedDescription", sample);
		}
	}

	const output = {
		totals,
		counts: Object.fromEntries(
			Object.entries(counts).map(([key, map]) => [key, toSortedCountArray(map)]),
		),
		samples: Object.fromEntries(
			Object.entries(samples).map(([groupKey, map]) => [
				groupKey,
				Object.fromEntries(map.entries()),
			]),
		),
	};

	console.log(JSON.stringify(output, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Aluminum audit failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});

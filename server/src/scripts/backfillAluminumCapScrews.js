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

function slugify(value = "") {
	return clean(value)
		.toLowerCase()
		.replace(/["']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function toDisplayCase(value = "") {
	return clean(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildSpecString(attrs = {}) {
	const diameter = clean(attrs.diameter || "");
	const pitch = clean(attrs.threadPitch || "");
	const length = clean(attrs.length || "");
	if (!diameter || !length) return "";
	if (attrs.measurementSystem === "metric" && pitch) return `${diameter}-${pitch} x ${length}`;
	if (pitch && !/^\d+-\d/.test(diameter)) return `${diameter}-${pitch} x ${length}`;
	return `${diameter} x ${length}`;
}

function buildTitle(attrs = {}, product = {}) {
	const familyType = clean(attrs.familyType || attrs.fastenerTypeCanonical || "Cap Screw");
	const spec = buildSpecString(attrs);
	const title = clean(`Aluminum ${toDisplayCase(familyType)}${spec ? ` - ${spec}` : ""}`);
	return title || clean(product?.fishbowl?.description || product?.sku || "Aluminum Bolt");
}

function familyTitleFor(attrs = {}) {
	const familyType = clean(attrs.familyType || attrs.fastenerTypeCanonical || "cap screw");
	return clean(`Aluminum ${toDisplayCase(familyType)}`);
}

function familySlugFor(attrs = {}) {
	return slugify(familyTitleFor(attrs));
}

function familyKeyFor(attrs = {}) {
	return [
		"bolts",
		attrs.subcategoryCanonical || "",
		attrs.familyType || attrs.fastenerTypeCanonical || "",
		"aluminum",
		attrs.measurementSystem || "",
	]
		.map(normalize)
		.filter(Boolean)
		.join("|");
}

function normalizeExistingNumbered(attrs = {}) {
	const next = { ...attrs };
	const diameter = clean(next.diameter || "");
	const pitch = clean(next.threadPitch || "");

	if (/^#?\d+$/.test(diameter) && pitch) {
		next.diameter = `${diameter.replace(/^#/, "")}-${pitch}`;
	}

	if (/^#\d+-\d+/.test(diameter)) {
		next.diameter = diameter.replace(/^#/, "");
	}

	if (!clean(next.threadSeries || next.thread_series || "")) {
		const inferred = inferThreadSeries(next.diameter || diameter, pitch);
		if (inferred) {
			next.threadSeries = inferred;
			next.thread_series = inferred;
		}
	}

	return next;
}

function buildAttributeUpdates({ product = {}, enrichment = {}, parsed = {} }) {
	const current = enrichment?.attributes || {};
	let attrs = normalizeExistingNumbered(current);

	const sourceText = [
		product?.fishbowl?.description || "",
		product?.fishbowl?.partNum || "",
		product?.sku || "",
		enrichment?.title || "",
	]
		.filter(Boolean)
		.join(" ");

	const descriptionParsed = parseDescriptionAttributes(product?.fishbowl?.description || "");
	// Prefer the raw Fishbowl description over existing title/source text.
	// Existing bad titles like "2-13 x 2-3/4" can otherwise re-pollute
	// the parse and strip the leading "1/" from "1/2".
	const parsedData = descriptionParsed.diameter || descriptionParsed.length
		? descriptionParsed
		: parsed?.diameter || parsed?.length
			? parsed
			: parseDescriptionAttributes(sourceText);

	const familyType =
		parsedData.familyType ||
		attrs.familyType ||
		attrs.fastenerTypeCanonical ||
		attrs.fastenerType ||
		"hex cap screw";
	const subcategory =
		parsedData.subcategory || attrs.subcategoryCanonical || enrichment.subcategory || "hex cap screws";

	attrs = {
		...attrs,
		categoryCanonical: "bolts",
		subcategoryCanonical: subcategory,
		familyType,
		fastenerType: familyType,
		fastenerTypeCanonical: familyType,
		material: "aluminum",
		finish: "",
		displayMaterial: "aluminum",
		displayFinish: "aluminum",
		materialFinish: "aluminum",
		grade: "",
		fishbowlPartNum: product?.fishbowl?.partNum || attrs.fishbowlPartNum || "",
		fishbowlDescription: clean(product?.fishbowl?.description || attrs.fishbowlDescription || ""),
		sku: product?.sku || attrs.sku || "",
		internalPartNumber: product?.internalPartNumber || attrs.internalPartNumber || "",
	};

	if (parsedData.measurementSystem) attrs.measurementSystem = parsedData.measurementSystem;
	if (parsedData.diameter) attrs.diameter = parsedData.diameter;
	if (parsedData.threadPitch) attrs.threadPitch = parsedData.threadPitch;
	if (parsedData.threadSeries) {
		attrs.threadSeries = parsedData.threadSeries;
		attrs.thread_series = parsedData.threadSeries;
	}
	if (parsedData.length) attrs.length = parsedData.length;
	if (parsedData.headType) attrs.headType = parsedData.headType;
	if (parsedData.driveType) {
		attrs.driveType = parsedData.driveType;
		attrs.drive_type = parsedData.driveType;
	}

	attrs = normalizeExistingNumbered(attrs);

	attrs.familyTitle = familyTitleFor(attrs);
	attrs.familyTitleBase = familyTitleFor(attrs);
	attrs.familySlug = familySlugFor(attrs);
	attrs.familyKey = familyKeyFor(attrs);

	const title = buildTitle(attrs, product);
	const shortDescription = clean(`${title}${product?.fishbowl?.partNum ? ` (${product.fishbowl.partNum})` : ""}`);

	return {
		category: "bolts",
		subcategory,
		attributes: attrs,
		title,
		shortTitle: title,
		shortDescription,
		description: clean(
			`${title} is an aluminum catalog item prepared for ecommerce publishing. Detected specs include Diameter: ${attrs.diameter || ""}, Thread Pitch: ${attrs.threadPitch || ""}, Length: ${attrs.length || ""}, Material: aluminum.`
		),
		bulletPoints: [
			attrs.diameter ? `Diameter: ${attrs.diameter}` : "",
			attrs.threadPitch ? `Thread Pitch: ${attrs.threadPitch}` : "",
			attrs.threadSeries ? `Thread Series: ${attrs.threadSeries}` : "",
			attrs.length ? `Length: ${attrs.length}` : "",
			"Material: aluminum",
			attrs.measurementSystem ? `Measurement System: ${attrs.measurementSystem}` : "",
		].filter(Boolean),
	};
}

function diffFields(before = {}, after = {}) {
	const keys = [
		"categoryCanonical",
		"subcategoryCanonical",
		"familyType",
		"fastenerTypeCanonical",
		"familyTitle",
		"familyTitleBase",
		"familyKey",
		"measurementSystem",
		"diameter",
		"threadPitch",
		"threadSeries",
		"length",
		"material",
		"finish",
		"materialFinish",
		"grade",
		"headType",
		"driveType",
		"drive_type",
	];
	const changes = {};
	for (const key of keys) {
		if (String(before?.[key] || "") !== String(after?.[key] || "")) {
			changes[key] = { before: before?.[key] || "", after: after?.[key] || "" };
		}
	}
	return changes;
}

async function main() {
	const dryRun = process.argv.includes("--dry-run");
	const showSamples = process.argv.includes("--samples");

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log(`${dryRun ? "🔎 Dry run" : "✍️ Applying"} aluminum cap screw / bolt backfill`);

	const products = await Product.find(buildAluminumCandidateQuery(), {
		_id: 1,
		sku: 1,
		internalPartNumber: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
	}).lean();

	const enrichments = await ProductEnrichment.find({
		productId: { $in: products.map((item) => item._id) },
	}).lean();
	const enrichmentMap = new Map(enrichments.map((item) => [String(item.productId), item]));

	const summary = {
		candidateProducts: products.length,
		capScrewOrBoltCandidates: 0,
		missingEnrichment: 0,
		updated: 0,
		unchanged: 0,
		unparsedDescription: 0,
	};
	const samples = [];

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
		summary.capScrewOrBoltCandidates += 1;

		if (!enrichment) {
			summary.missingEnrichment += 1;
			continue;
		}

		const parsedFromDescription = parseDescriptionAttributes(product?.fishbowl?.description || "");
		const parsed = parsedFromDescription.diameter || parsedFromDescription.length
			? parsedFromDescription
			: parseDescriptionAttributes(sourceText);
		if (!parsed.diameter || !parsed.length) summary.unparsedDescription += 1;

		const updates = buildAttributeUpdates({ product, enrichment, parsed });
		const changes = diffFields(enrichment.attributes || {}, updates.attributes || {});
		const hasChanges =
			Object.keys(changes).length > 0 ||
			String(enrichment.category || "") !== updates.category ||
			String(enrichment.subcategory || "") !== updates.subcategory ||
			String(enrichment.title || "") !== updates.title;

		if (!hasChanges) {
			summary.unchanged += 1;
			continue;
		}

		if (showSamples && samples.length < 30) {
			samples.push({
				productId: String(product._id),
				partNumber: product?.fishbowl?.partNum || product?.sku || "",
				description: product?.fishbowl?.description || "",
				category: { before: enrichment.category || "", after: updates.category },
				subcategory: { before: enrichment.subcategory || "", after: updates.subcategory },
				title: { before: enrichment.title || "", after: updates.title },
				changes,
			});
		}

		if (!dryRun) {
			await ProductEnrichment.updateOne(
				{ _id: enrichment._id },
				{
					$set: {
						category: updates.category,
						subcategory: updates.subcategory,
						title: updates.title,
						shortTitle: updates.shortTitle,
						shortDescription: updates.shortDescription,
						description: updates.description,
						bulletPoints: updates.bulletPoints,
						attributes: updates.attributes,
						websiteBrand: "",
						websiteVendor: "",
						updatedAt: new Date(),
					},
				},
			);

			await Product.updateOne(
				{ _id: product._id },
				{
					$set: {
						brand: "",
						vendor: "",
					},
					$addToSet: {
						categoryHints: { $each: ["bolts", updates.subcategory, "aluminum"] },
						searchKeywords: { $each: ["aluminum", updates.subcategory, updates.attributes.familyType].filter(Boolean) },
					},
				},
			);
		}

		summary.updated += 1;
	}

	console.log("===== ALUMINUM CAP SCREW BACKFILL SUMMARY =====");
	console.log(JSON.stringify({ summary, samples }, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Aluminum backfill failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});

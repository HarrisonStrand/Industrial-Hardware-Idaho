import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

const GRADE_8_HEX_IMAGE = "/images/products/bolts/hex-head-bolt-yellow-zinc-grade-8.png";
const GRADE_5_HEX_IMAGE = "/images/products/bolts/hex-head-bolt-zinc.png";
const BUTTON_HEAD_IMAGE = "/images/products/bolts/buttonhead-black-oxide.png";
const SOCKET_HEAD_IMAGE = "/images/products/bolts/sockethead-stainless.png";
const FLAT_HEAD_IMAGE = "/images/products/bolts/flathead-stainless.png";

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function hasFlag(name) {
	return process.argv.includes(`--${name}`);
}

function getArg(name, fallback = "") {
	const prefix = `--${name}=`;
	const found = process.argv.find((arg) => arg.startsWith(prefix));
	return found ? found.slice(prefix.length) : fallback;
}

function getPartNumber(product = null, enrichment = null) {
	return clean(
		enrichment?.attributes?.fishbowlPartNum ||
			product?.fishbowl?.partNum ||
			product?.sku ||
			product?.internalPartNumber ||
			"",
	);
}

function sourceText(product = null, enrichment = null) {
	return [
		getPartNumber(product, enrichment),
		product?.sku || "",
		product?.internalPartNumber || "",
		product?.fishbowl?.description || "",
		enrichment?.title || "",
		enrichment?.description || "",
		enrichment?.attributes?.fishbowlDescription || "",
	]
		.filter(Boolean)
		.join(" ");
}

function gcd(a, b) {
	return b ? gcd(b, a % b) : a;
}

function mixedFractionFromSixteenths(totalSixteenths = 0) {
	const whole = Math.floor(totalSixteenths / 16);
	const remainder = totalSixteenths % 16;
	if (!remainder) return String(whole);
	const divisor = gcd(remainder, 16);
	const num = remainder / divisor;
	const den = 16 / divisor;
	return whole > 0 ? `${whole}-${num}/${den}` : `${num}/${den}`;
}

function lengthFromFourDigitCode(code = "") {
	const digits = String(code || "").replace(/\D/g, "");
	if (!digits) return "";
	const padded = digits.length === 3 ? `0${digits}` : digits;
	if (!/^\d{4}$/.test(padded)) return "";
	const whole = Number(padded.slice(0, 2));
	const sixteenths = Number(padded.slice(2, 4));
	if (!Number.isFinite(whole) || !Number.isFinite(sixteenths)) return "";
	return mixedFractionFromSixteenths(whole * 16 + sixteenths);
}

function ensurePrimaryImage(enrichment, imageUrl) {
	if (!imageUrl) return false;
	const current = Array.isArray(enrichment.images) ? enrichment.images : [];
	const currentPrimary = current.find((image) => image?.isPrimary)?.url || current[0]?.url || "";
	if (currentPrimary === imageUrl && current.length === 1 && current[0]?.isPrimary) {
		return false;
	}

	enrichment.images = [
		{
			url: imageUrl,
			alt: `${enrichment.title || enrichment.shortTitle || "Product"} product image`,
			sortOrder: 0,
			source: "generated",
			isPrimary: true,
			needsReview: false,
		},
	];
	enrichment.imageStatus = "matched";
	return true;
}

function setAttr(attrs, key, value) {
	if (attrs[key] === value) return false;
	attrs[key] = value;
	return true;
}

function toDisplayCase(value = "") {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildHexTitle(attrs = {}) {
	const grade = clean(attrs.grade || "");
	const diameter = clean(attrs.diameter || "");
	const threadPitch = clean(attrs.threadPitch || attrs.thread_pitch || "");
	const length = clean(attrs.length || "");
	const material = clean(attrs.displayMaterial || attrs.material || "");
	const finish = clean(attrs.displayFinish || attrs.finish || "");
	const materialFinish = clean(attrs.materialFinish || "");

	const spec = [diameter, threadPitch].filter(Boolean).join("-");
	const size = spec && length ? `${spec} x ${length}` : spec || length;

	let finishLabel = "";
	if (material.toLowerCase() === "stainless steel") {
		finishLabel = toDisplayCase(grade || material);
	} else if (material && finish) {
		finishLabel = `${toDisplayCase(material)} ${toDisplayCase(finish)}`;
	} else if (materialFinish) {
		finishLabel = toDisplayCase(materialFinish.replace(/\s*\/\s*/g, " "));
	} else {
		finishLabel = toDisplayCase(finish || material);
	}

	return clean([
		grade ? toDisplayCase(grade) : "",
		"Hex Cap Screw",
		size ? `- ${size}` : "",
		finishLabel ? `- ${finishLabel}` : "",
	].filter(Boolean).join(" "));
}

function updateTitleFromAttrs(enrichment, attrs = {}) {
	if (enrichment?.overrideFlags?.lockTitle) return false;
	const title = buildHexTitle(attrs);
	if (!title) return false;

	let changed = false;
	if (enrichment.title !== title) {
		enrichment.title = title;
		changed = true;
	}
	if (enrichment.shortTitle !== title) {
		enrichment.shortTitle = title;
		changed = true;
	}

	const seo = enrichment.seo?.toObject?.() || enrichment.seo || {};
	if (seo.metaTitle !== title) {
		enrichment.seo = { ...seo, metaTitle: title };
		changed = true;
	}

	return changed;
}

function parseCs26HexPartNumber(partNumber = "") {
	const raw = clean(partNumber).toUpperCase();
	const match = raw.match(/^(?:([A-Z]{2}))?CS([58])([CF])(\d{6,7})(P|T|TAP)?$/i);
	if (!match) return null;

	const [, prefix = "", gradeDigit = "", seriesCode = "", numericCode = "", suffix = ""] = match;
	let diaCode = "";
	let lenCode = "";

	if (numericCode.length === 6 && numericCode.startsWith("26")) {
		diaCode = "26";
		lenCode = numericCode.slice(2);
	} else if (numericCode.length === 7 && numericCode.startsWith("260")) {
		diaCode = "260";
		lenCode = numericCode.slice(3);
	} else {
		return null;
	}

	return { prefix, gradeDigit, seriesCode, diaCode, lenCode, suffix };
}

function applyStandardBoltAttrs(attrs, patch = {}) {
	let changed = false;
	for (const [key, value] of Object.entries(patch)) {
		changed = setAttr(attrs, key, value) || changed;
	}
	return changed;
}

function targetHeadFamily(product, enrichment) {
	const text = sourceText(product, enrichment);
	const part = getPartNumber(product, enrichment).toUpperCase();
	const normalized = normalize(text);

	if (/^(?:BHCS|SSSB)\d/i.test(part) || /^MMSB\d/i.test(part) || normalized.includes("button head")) {
		return {
			familyType: "button head cap screw",
			subcategory: "button head cap screws",
			headType: "button",
			driveType: "hex socket",
			image: BUTTON_HEAD_IMAGE,
		};
	}

	if (/^(?:SHCS|SSSH)\d/i.test(part) || /^MMSH\d/i.test(part) || normalized.includes("socket head") || normalized.includes("soc hd") || normalized.includes("soc. hd")) {
		return {
			familyType: "socket head cap screw",
			subcategory: "socket head cap screws",
			headType: "socket",
			driveType: "hex socket",
			image: SOCKET_HEAD_IMAGE,
		};
	}

	if (/^(?:FHCS|SSSF)\d/i.test(part) || /^MMSF\d/i.test(part) || normalized.includes("flat head cap screw")) {
		return {
			familyType: "flat head cap screw",
			subcategory: "flat head cap screws",
			headType: "flat",
			driveType: "hex socket",
			image: FLAT_HEAD_IMAGE,
		};
	}

	return null;
}

function correctMisfiledHeadFamily(product, enrichment) {
	const attrs = { ...(enrichment.attributes || {}) };
	const target = targetHeadFamily(product, enrichment);
	if (!target) return null;

	const before = {
		subcategory: enrichment.subcategory || "",
		familyType: attrs.familyType || attrs.fastenerType || "",
		headType: attrs.headType || "",
	};

	let changed = false;
	if (enrichment.category !== "bolts") {
		enrichment.category = "bolts";
		changed = true;
	}
	if (enrichment.subcategory !== target.subcategory) {
		enrichment.subcategory = target.subcategory;
		changed = true;
	}

	changed = applyStandardBoltAttrs(attrs, {
		categoryCanonical: "bolts",
		subcategoryCanonical: target.subcategory,
		familyType: target.familyType,
		fastenerType: target.familyType,
		fastenerTypeCanonical: target.familyType,
		headType: target.headType,
		driveType: target.driveType,
		drive_type: target.driveType,
	}) || changed;

	changed = ensurePrimaryImage(enrichment, target.image) || changed;
	enrichment.attributes = attrs;

	return changed
		? {
			type: "moved-head-family",
			before,
			after: {
				subcategory: target.subcategory,
				familyType: target.familyType,
				headType: target.headType,
			},
		}
		: null;
}

function correctCs260HexCap(product, enrichment) {
	const part = getPartNumber(product, enrichment).toUpperCase();
	const parsed = parseCs26HexPartNumber(part);
	if (!parsed) return null;

	const { gradeDigit = "", seriesCode = "", lenCode = "", suffix = "" } = parsed;
	const grade = gradeDigit === "8" ? "grade 8" : "grade 5";
	const threadSeries = seriesCode.toUpperCase() === "F" ? "fine" : "coarse";
	const threadPitch = threadSeries === "fine" ? "12" : "5";
	const length = lengthFromFourDigitCode(lenCode);
	const finish = gradeDigit === "8" ? "yellow zinc" : suffix === "P" ? "plain" : "zinc";
	const threadCoverage = /^(T|TAP)$/i.test(suffix) ? "full" : "partial";
	const attrs = { ...(enrichment.attributes || {}) };
	const before = {
		title: enrichment.title || "",
		diameter: attrs.diameter || "",
		threadPitch: attrs.threadPitch || "",
		length: attrs.length || "",
		grade: attrs.grade || "",
		image: enrichment.images?.find((image) => image?.isPrimary)?.url || enrichment.images?.[0]?.url || "",
	};

	let changed = false;
	if (enrichment.category !== "bolts") {
		enrichment.category = "bolts";
		changed = true;
	}
	if (enrichment.subcategory !== "hex cap screws") {
		enrichment.subcategory = "hex cap screws";
		changed = true;
	}

	changed = applyStandardBoltAttrs(attrs, {
		measurementSystem: "imperial",
		diameter: "1-3/4",
		length,
		threadPitch,
		threadSeries,
		thread_series: threadSeries,
		threadCoverage,
		thread_coverage: threadCoverage,
		material: "steel",
		finish,
		displayMaterial: "steel",
		displayFinish: finish,
		materialFinish: `steel / ${finish}`,
		grade,
		fastenerType: "hex cap screw",
		fastenerTypeCanonical: "hex cap screw",
		familyType: "hex cap screw",
		headType: "hex",
		driveType: "hex",
		drive_type: "hex",
		categoryCanonical: "bolts",
		subcategoryCanonical: "hex cap screws",
		fishbowlPartNum: getPartNumber(product, enrichment),
	}) || changed;

	if (gradeDigit === "8") {
		changed = ensurePrimaryImage(enrichment, GRADE_8_HEX_IMAGE) || changed;
	} else if (gradeDigit === "5") {
		changed = ensurePrimaryImage(enrichment, GRADE_5_HEX_IMAGE) || changed;
	}

	enrichment.attributes = attrs;
	changed = updateTitleFromAttrs(enrichment, attrs) || changed;

	return changed
		? {
			type: "fixed-cs26-diameter",
			before,
			after: {
				title: enrichment.title || "",
				diameter: attrs.diameter,
				threadPitch: attrs.threadPitch,
				length: attrs.length,
				grade: attrs.grade,
				finish: attrs.finish,
			},
		}
		: null;
}

function correctSpecificBronzeHexCap(product, enrichment) {
	const part = getPartNumber(product, enrichment).toUpperCase();
	if (part !== "SBRZCS050108C") return null;

	const attrs = { ...(enrichment.attributes || {}) };
	const before = {
		subcategory: enrichment.subcategory || "",
		measurementSystem: attrs.measurementSystem || "",
		diameter: attrs.diameter || "",
		length: attrs.length || "",
		materialFinish: attrs.materialFinish || "",
	};

	let changed = false;
	if (enrichment.category !== "bolts") {
		enrichment.category = "bolts";
		changed = true;
	}
	if (enrichment.subcategory !== "hex cap screws") {
		enrichment.subcategory = "hex cap screws";
		changed = true;
	}

	changed = applyStandardBoltAttrs(attrs, {
		measurementSystem: "imperial",
		diameter: "5/16",
		length: "1-1/2",
		threadPitch: "18",
		threadSeries: "coarse",
		thread_series: "coarse",
		threadCoverage: "partial",
		thread_coverage: "partial",
		material: "silicon bronze",
		finish: "",
		displayMaterial: "silicon bronze",
		displayFinish: "silicon bronze",
		materialFinish: "silicon bronze",
		grade: "",
		fastenerType: "hex cap screw",
		fastenerTypeCanonical: "hex cap screw",
		familyType: "hex cap screw",
		headType: "hex",
		driveType: "hex",
		drive_type: "hex",
		categoryCanonical: "bolts",
		subcategoryCanonical: "hex cap screws",
		fishbowlPartNum: getPartNumber(product, enrichment),
	}) || changed;

	enrichment.attributes = attrs;
	return changed
		? {
			type: "fixed-silicon-bronze-hex-cap",
			before,
			after: {
				measurementSystem: attrs.measurementSystem,
				diameter: attrs.diameter,
				threadPitch: attrs.threadPitch,
				length: attrs.length,
				materialFinish: attrs.materialFinish,
			},
		}
		: null;
}

function correctSpecificTapBolt(product, enrichment) {
	const part = getPartNumber(product, enrichment).toUpperCase();
	if (part !== "CS060408T") return null;

	const attrs = { ...(enrichment.attributes || {}) };
	const before = {
		subcategory: enrichment.subcategory || "",
		diameter: attrs.diameter || "",
		length: attrs.length || "",
		threadCoverage: attrs.threadCoverage || attrs.thread_coverage || "",
	};

	let changed = false;
	if (enrichment.category !== "bolts") {
		enrichment.category = "bolts";
		changed = true;
	}
	if (enrichment.subcategory !== "hex cap screws") {
		enrichment.subcategory = "hex cap screws";
		changed = true;
	}

	changed = applyStandardBoltAttrs(attrs, {
		measurementSystem: "imperial",
		diameter: "3/8",
		length: "4-1/2",
		threadPitch: "16",
		threadSeries: "coarse",
		thread_series: "coarse",
		threadCoverage: "full",
		thread_coverage: "full",
		material: "steel",
		finish: "zinc",
		displayMaterial: "steel",
		displayFinish: "zinc",
		materialFinish: "steel / zinc",
		grade: "grade 2",
		fastenerType: "hex cap screw",
		fastenerTypeCanonical: "hex cap screw",
		familyType: "hex cap screw",
		headType: "hex",
		driveType: "hex",
		drive_type: "hex",
		categoryCanonical: "bolts",
		subcategoryCanonical: "hex cap screws",
		fishbowlPartNum: getPartNumber(product, enrichment),
	}) || changed;

	changed = ensurePrimaryImage(enrichment, GRADE_5_HEX_IMAGE) || changed;
	enrichment.attributes = attrs;

	return changed
		? {
			type: "fixed-cs060408t-tap-bolt",
			before,
			after: {
				diameter: attrs.diameter,
				threadPitch: attrs.threadPitch,
				length: attrs.length,
				threadCoverage: attrs.threadCoverage,
			},
		}
		: null;
}

function productPartValues(product = null, enrichment = null) {
	return [
		enrichment?.attributes?.fishbowlPartNum,
		product?.fishbowl?.partNum,
		product?.sku,
		product?.internalPartNumber,
	]
		.map((value) => clean(value).toUpperCase())
		.filter(Boolean);
}

function needsInspection(product, enrichment, requestedPart = "") {
	const part = getPartNumber(product, enrichment).toUpperCase();
	if (requestedPart) {
		const requested = requestedPart.toUpperCase();
		if (!productPartValues(product, enrichment).includes(requested)) return false;
	}
	if (/^(?:BHCS|SHCS|FHCS|SSSB|SSSH|SSSF|MMS[BFH])\d/i.test(part)) return true;
	if (parseCs26HexPartNumber(part)) return true;
	if (["SBRZCS050108C", "CS060408T"].includes(part)) return true;

	const text = sourceText(product, enrichment);
	return targetHeadFamily(product, enrichment) && normalize(enrichment?.subcategory || "") === "hex cap screws";
}

async function main() {
	const dryRun = hasFlag("dry-run");
	const samples = hasFlag("samples");
	const requestedPart = clean(getArg("part", ""));

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	if (dryRun) console.log("🔎 Dry run only");

	const partFilter = requestedPart
		? new RegExp(`^${requestedPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
		: /^(?:[A-Z]{2})?CS[58][CF](?:26\d{4}|260\d{4})(?:P|T|TAP)?$/i;

	const partProducts = await Product.find({
		$or: [
			{ "fishbowl.partNum": partFilter },
			{ sku: partFilter },
			{ internalPartNumber: partFilter },
		],
	})
		.select({ _id: 1 })
		.lean();
	const partProductIds = partProducts.map((product) => product._id);

	const enrichments = await ProductEnrichment.find({
		$or: [
			{ category: /^bolts$/i, subcategory: /^hex cap screws$/i },
			{ productId: { $in: partProductIds } },
			{ "attributes.fishbowlPartNum": partFilter },
		],
	}).lean(false);

	const productIds = enrichments.map((item) => item.productId).filter(Boolean);
	const products = await Product.find({ _id: { $in: productIds } }).lean();
	const productMap = new Map(products.map((product) => [String(product._id), product]));

	const summary = {
		checked: 0,
		updated: 0,
		wouldUpdate: 0,
		movedHeadFamily: 0,
		fixedCs26Diameter: 0,
		fixedSiliconBronze: 0,
		fixedTapBolt: 0,
		unchanged: 0,
		missingProduct: 0,
		failed: 0,
	};
	const outputSamples = [];

	for (const enrichment of enrichments) {
		const product = productMap.get(String(enrichment.productId));
		if (!product) {
			summary.missingProduct += 1;
			continue;
		}
		if (!needsInspection(product, enrichment, requestedPart)) continue;

		summary.checked += 1;
		const partNumber = getPartNumber(product, enrichment);
		const changes = [];

		try {
			for (const fixer of [
				correctMisfiledHeadFamily,
				correctCs260HexCap,
				correctSpecificBronzeHexCap,
				correctSpecificTapBolt,
			]) {
				const result = fixer(product, enrichment);
				if (result) changes.push(result);
			}

			if (!changes.length) {
				summary.unchanged += 1;
				continue;
			}

			for (const change of changes) {
				if (change.type === "moved-head-family") summary.movedHeadFamily += 1;
				if (change.type === "fixed-cs26-diameter") summary.fixedCs26Diameter += 1;
				if (change.type === "fixed-silicon-bronze-hex-cap") summary.fixedSiliconBronze += 1;
				if (change.type === "fixed-cs060408t-tap-bolt") summary.fixedTapBolt += 1;
			}

			if (samples && outputSamples.length < 40) {
				outputSamples.push({ partNumber, changes });
			}

			if (dryRun) {
				summary.wouldUpdate += 1;
			} else {
				enrichment.markModified("attributes");
				enrichment.markModified("images");
				enrichment.markModified("seo");
				await enrichment.save();
				summary.updated += 1;
			}
		} catch (err) {
			summary.failed += 1;
			if (samples && outputSamples.length < 40) {
				outputSamples.push({ partNumber, error: err.message });
			}
		}
	}

	console.log("===== HEX CAP SCREW ANOMALY FIX SUMMARY =====");
	console.log(JSON.stringify(summary, null, 2));
	if (samples) {
		console.log("===== SAMPLES =====");
		console.log(JSON.stringify(outputSamples, null, 2));
	}

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Hex cap screw anomaly fix failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});

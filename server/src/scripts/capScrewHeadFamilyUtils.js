function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function slugify(value = "") {
	return clean(value)
		.toLowerCase()
		.replace(/["']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

const IMPERIAL_DIAMETER_MAP = {
	"02": "#2",
	"03": "#3",
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
	"26": "1-3/4",
	"020": "#2",
	"030": "#3",
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
	"260": "1-3/4",
};

const IMPERIAL_COARSE_PITCH = {
	"#2": "56",
	"#3": "48",
	"#4": "40",
	"#5": "40",
	"#6": "32",
	"#8": "32",
	"#10": "24",
	"#12": "24",
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
	"1-3/4": "5",
	"2": "4.5",
};

const IMPERIAL_FINE_PITCH = {
	"#2": "64",
	"#3": "56",
	"#4": "48",
	"#5": "44",
	"#6": "40",
	"#8": "36",
	"#10": "32",
	"#12": "28",
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
	"1-3/4": "12",
	"2": "6",
};

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

function lengthFromImperialCapScrewCode(code = "") {
	let digits = String(code || "").replace(/\D/g, "");
	if (!digits) return "";

	// Some real Fishbowl parts have an accidental trailing 00 after the
	// compact length code, for example SSSB08030800. Treat that the same as
	// SSSB080308, where 308 means 3 inches + 8/16 = 3-1/2.
	if (digits.length >= 5 && digits.endsWith("00")) {
		digits = digits.slice(0, -2);
	}

	// Standard compact cap-screw length coding uses whole inches plus
	// sixteenths: 200 or 0200 = 2", 308 or 0308 = 3-1/2".
	if (/^\d{3}$/.test(digits)) {
		const whole = Number(digits.slice(0, 1));
		const sixteenths = Number(digits.slice(1, 3));
		if (!Number.isFinite(whole) || !Number.isFinite(sixteenths)) return "";
		return mixedFractionFromSixteenths(whole * 16 + sixteenths);
	}

	if (/^\d{4}$/.test(digits)) {
		const whole = Number(digits.slice(0, 2));
		const sixteenths = Number(digits.slice(2, 4));
		if (!Number.isFinite(whole) || !Number.isFinite(sixteenths)) return "";
		return mixedFractionFromSixteenths(whole * 16 + sixteenths);
	}

	// Fallback for older decimal-hundredths style data.
	const value = Number(digits) / 100;
	if (!Number.isFinite(value) || value <= 0) return "";
	const nearestSixteenths = Math.max(1, Math.round(value * 16));
	return mixedFractionFromSixteenths(nearestSixteenths);
}

function getImperialCapScrewLengthAnomaly(code = "") {
	const digits = String(code || "").replace(/\D/g, "");
	if (/^\d{3}$/.test(digits) && !digits.endsWith("00")) {
		return "compact-sixteenth-length-code";
	}
	if (digits.length >= 5 && digits.endsWith("00")) {
		return "extra-trailing-zero-length-code";
	}
	return "";
}

function imperialDiameterFromCode(code = "") {
	const normalized = String(code || "").trim().toUpperCase();
	return IMPERIAL_DIAMETER_MAP[normalized] || "";
}

function threadDataForImperialDiameter(diameter = "", isFine = false) {
	const map = isFine ? IMPERIAL_FINE_PITCH : IMPERIAL_COARSE_PITCH;
	const threadPitch = map[diameter] || "";
	return {
		threadPitch,
		threadSeries: threadPitch ? (isFine ? "fine" : "coarse") : "",
	};
}

function pitchFromMetricCode(code = "") {
	const digits = String(code || "").replace(/\D/g, "");
	if (!digits) return "";
	const value = Number(digits) / 100;
	if (!Number.isFinite(value) || value <= 0) return "";
	return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, ".0");
}

function detectStainlessGrade(text = "") {
	if (/\b316\s*(?:ss|s\/s|stainless)?\b/i.test(text)) return "316";
	if (/\b304\s*(?:ss|s\/s|stainless)?\b/i.test(text)) return "304";
	return "";
}

function detectFinishOverride(text = "") {
	const raw = String(text || "");

	// Zinc should only win when it is clearly present in the real Fishbowl
	// part number/description. Do not let stale enrichment titles like
	// "zinc steel hex cap screw" keep polluting SHCS records.
	if (/\b(?:zinc|zp|z\.p\.)\b/i.test(raw)) return "zinc";
	if (/\bZ\b/.test(raw)) return "zinc";
	if (/\b(?:SHCS|MMSH)\d{5,8}Z\b/i.test(raw)) return "zinc";

	if (/\b(?:plain|pln)\b/i.test(raw)) return "plain";
	if (/\b(?:galv|galvanized|hdg|hot dip)\b/i.test(raw)) return "galvanized";
	if (/\bblack oxide\b|\bblk ox\b|\bbox\b/i.test(raw)) return "black oxide";
	return "";
}

function materialFinishFor({ stainless = false, sourceText = "" } = {}) {
	if (stainless) {
		return {
			material: "stainless steel",
			finish: "",
			displayMaterial: "stainless steel",
			displayFinish: "stainless steel",
			materialFinish: "stainless steel",
		};
	}

	const finish = detectFinishOverride(sourceText) || "black oxide";
	return {
		material: "steel",
		finish,
		displayMaterial: "steel",
		displayFinish: finish,
		materialFinish: `steel / ${finish}`,
	};
}

function sourceTextFor(product = {}, enrichment = null) {
	return [
		product?.fishbowl?.partNum,
		product?.sku,
		product?.internalPartNumber,
		product?.fishbowl?.description,
		product?.fishbowl?.raw?.original?.description,
		enrichment?.title,
		enrichment?.description,
		enrichment?.attributes?.fishbowlDescription,
		enrichment?.attributes?.fishbowlPartNum,
	]
		.filter(Boolean)
		.join(" ");
}

function rawProductSourceTextFor(product = {}) {
	return [
		product?.fishbowl?.partNum,
		product?.sku,
		product?.internalPartNumber,
		product?.fishbowl?.description,
		product?.fishbowl?.raw?.original?.description,
	]
		.filter(Boolean)
		.join(" ");
}

function findCapScrewPartToken(text = "") {
	const raw = String(text || "").toUpperCase();
	const patterns = [
		/\b(?:BHCS|SHCS)\d{5,8}(?:FLH|F|LH|Z)?\b/i,
		/\b(?:SSSB|SSSH)\d{5,8}(?:FLH|F|LH)?\b/i,
		/\bMMS[BFH]\d{8}(?:SS)?\b/i,
	];

	for (const pattern of patterns) {
		const match = raw.match(pattern);
		if (match?.[0]) return match[0].toUpperCase();
	}

	return "";
}

function familyFromImperialPrefix(prefix = "") {
	const normalized = String(prefix || "").toUpperCase();
	if (normalized === "BHCS" || normalized === "SSSB") {
		return {
			familyType: "button head cap screw",
			subcategory: "button head cap screws",
			headType: "button",
			driveType: "hex socket",
		};
	}
	if (normalized === "SHCS" || normalized === "SSSH") {
		return {
			familyType: "socket head cap screw",
			subcategory: "socket head cap screws",
			headType: "socket",
			driveType: "hex socket",
		};
	}
	return null;
}

function familyFromMetricType(type = "") {
	const normalized = String(type || "").toUpperCase();
	if (normalized === "B") {
		return {
			familyType: "button head cap screw",
			subcategory: "button head cap screws",
			headType: "button",
			driveType: "hex socket",
		};
	}
	if (normalized === "H") {
		return {
			familyType: "socket head cap screw",
			subcategory: "socket head cap screws",
			headType: "socket",
			driveType: "hex socket",
		};
	}
	if (normalized === "F") {
		return {
			familyType: "flat head cap screw",
			subcategory: "flat head cap screws",
			headType: "flat",
			driveType: "hex socket",
		};
	}
	return null;
}

function splitImperialCapScrewNumericBody(numericBody = "") {
	const digits = String(numericBody || "").replace(/\D/g, "");
	if (!/^\d{5,8}$/.test(digits)) return null;

	// Prefer the current three-digit diameter convention: 080200 = 1/2 x 2.
	// But many real Fishbowl SHCS rows are compact: 08400 = 1/2 x 4.
	const candidates = [
		{ diaCode: digits.slice(0, 3), lengthCode: digits.slice(3) },
		{ diaCode: digits.slice(0, 2), lengthCode: digits.slice(2) },
	];

	for (const candidate of candidates) {
		const diameter = imperialDiameterFromCode(candidate.diaCode);
		const length = lengthFromImperialCapScrewCode(candidate.lengthCode);

		if (diameter && length) {
			return {
				...candidate,
				diameter,
				length,
			};
		}
	}

	return null;
}

function decodeImperialCapScrewToken(token = "", sourceText = "") {
	const raw = String(token || "").trim().toUpperCase();
	const match = raw.match(/^(BHCS|SHCS|SSSB|SSSH)(\d{5,8})(FLH|F|LH|Z)?$/i);
	if (!match) return null;

	const [, prefix = "", numericBody = "", suffix = ""] = match;
	const family = familyFromImperialPrefix(prefix);
	if (!family) return null;

	const parsed = splitImperialCapScrewNumericBody(numericBody);
	if (!parsed) return null;

	const isFine = suffix.includes("F");
	const isLowHead = suffix.includes("LH");
	const stainless = prefix.startsWith("SS");
	const thread = threadDataForImperialDiameter(parsed.diameter, isFine);
	const materialFinish = materialFinishFor({ stainless, sourceText });
	const grade = stainless ? detectStainlessGrade(sourceText) : "grade 8";

	return {
		partToken: raw,
		partNumberAnomaly: getImperialCapScrewLengthAnomaly(parsed.lengthCode),
		category: "bolts",
		...family,
		measurementSystem: "imperial",
		diameter: parsed.diameter,
		length: parsed.length,
		...thread,
		threadCoverage: "full",
		headProfile: family.familyType === "socket head cap screw" ? (isLowHead ? "low head" : "standard") : "",
		grade,
		...materialFinish,
	};
}

function decodeMetricCapScrewToken(token = "", sourceText = "") {
	const raw = String(token || "").trim().toUpperCase();
	const match = raw.match(/^MMS([BFH])(\d{2})(\d{3})(\d{3})(SS)?$/i);
	if (!match) return null;

	const [, type = "", diaCode = "", lengthCode = "", pitchCode = "", ssSuffix = ""] = match;
	const family = familyFromMetricType(type);
	if (!family) return null;

	const diameterNumber = String(Number(diaCode || 0));
	const lengthNumber = String(Number(lengthCode || 0));
	const diameter = diameterNumber && diameterNumber !== "0" ? `M${diameterNumber}` : "";
	const length = lengthNumber && lengthNumber !== "0" ? `${lengthNumber}mm` : "";
	const threadPitch = pitchFromMetricCode(pitchCode);
	const stainless = Boolean(ssSuffix) || /(?:\bss\b|s\/s|stainless)/i.test(sourceText);
	const materialFinish = materialFinishFor({ stainless, sourceText });
	const grade = stainless ? detectStainlessGrade(sourceText) : "grade 8";

	if (!diameter || !length || !threadPitch) return null;

	return {
		partToken: raw,
		category: "bolts",
		...family,
		measurementSystem: "metric",
		diameter,
		length,
		threadPitch,
		threadSeries: "",
		threadCoverage: "full",
		headProfile: family.familyType === "socket head cap screw" ? "standard" : "",
		grade,
		...materialFinish,
	};
}

function decodeCapScrewHeadFamilyFromProduct(product = {}, enrichment = null) {
	const fullSourceText = sourceTextFor(product, enrichment);
	const rawSourceText = rawProductSourceTextFor(product);
	const token = findCapScrewPartToken(fullSourceText);
	if (!token) return null;

	// Use the raw Fishbowl product text for material/finish overrides. This
	// prevents stale enrichment fields like "steel / zinc" from surviving when
	// a SHCS item should default back to steel / black oxide.
	return (
		decodeImperialCapScrewToken(token, rawSourceText) ||
		decodeMetricCapScrewToken(token, rawSourceText)
	);
}

function buildSpecString(decoded = {}) {
	const diameter = clean(decoded.diameter || "");
	const length = clean(decoded.length || "");
	const pitch = clean(decoded.threadPitch || "");
	if (!diameter || !length) return "";
	if (pitch) return `${diameter}-${pitch} x ${length}`;
	return `${diameter} x ${length}`;
}

function toDisplayCase(value = "") {
	return clean(value)
		.split(" ")
		.map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
		.join(" ");
}

function buildTitle(decoded = {}, partNumber = "") {
	const family = toDisplayCase(decoded.familyType || "Cap Screw");
	const prefix = decoded.headProfile === "low head" ? "Low Head " : "";
	const spec = buildSpecString(decoded);
	const finishLabel = decoded.materialFinish ? toDisplayCase(decoded.materialFinish) : "";
	const grade = clean(decoded.grade || "");
	const parts = [
		`${prefix}${family}`,
		spec ? `- ${spec}` : "",
		finishLabel ? `- ${finishLabel}` : "",
		grade ? `- ${grade}` : "",
	]
		.filter(Boolean)
		.join(" ");
	return clean(parts || partNumber || "Cap Screw");
}

function buildFamilyKey(decoded = {}) {
	return [
		normalize(decoded.category),
		normalize(decoded.subcategory),
		normalize(decoded.familyType),
		normalize(decoded.material),
		normalize(decoded.finish),
		normalize(decoded.grade),
		normalize(decoded.measurementSystem),
		normalize(decoded.headProfile),
	]
		.filter(Boolean)
		.join("|");
}

function buildFamilyTitle(decoded = {}) {
	const parts = [
		decoded.headProfile === "low head" ? "Low Head" : "",
		toDisplayCase(decoded.materialFinish || ""),
		decoded.grade || "",
		toDisplayCase(decoded.familyType || "Cap Screw"),
	]
		.filter(Boolean)
		.join(" ");
	return clean(parts || toDisplayCase(decoded.familyType || "Cap Screw"));
}

function attributesFromDecoded(decoded = {}, product = {}, existingAttributes = {}) {
	const familyTitle = buildFamilyTitle(decoded);
	return {
		...existingAttributes,
		measurementSystem: decoded.measurementSystem || "",
		diameter: decoded.diameter || "",
		length: decoded.length || "",
		threadPitch: decoded.threadPitch || "",
		threadSeries: decoded.threadSeries || "",
		thread_series: decoded.threadSeries || "",
		threadCoverage: decoded.threadCoverage || "",
		thread_coverage: decoded.threadCoverage || "",
		headType: decoded.headType || "",
		headProfile: decoded.headProfile || "",
		driveType: decoded.driveType || "",
		drive_type: decoded.driveType || "",
		material: decoded.material || "",
		finish: decoded.finish || "",
		displayMaterial: decoded.displayMaterial || decoded.material || "",
		displayFinish: decoded.displayFinish || decoded.finish || decoded.material || "",
		materialFinish: decoded.materialFinish || "",
		grade: decoded.grade || "",
		fastenerType: decoded.familyType || "",
		fastenerTypeCanonical: decoded.familyType || "",
		familyType: decoded.familyType || "",
		categoryCanonical: decoded.category || "bolts",
		subcategoryCanonical: decoded.subcategory || "",
		familyKey: buildFamilyKey(decoded),
		familySlug: slugify(buildFamilyTitle(decoded)),
		familyTitle,
		fishbowlPartNum: product?.fishbowl?.partNum || existingAttributes.fishbowlPartNum || product?.sku || "",
		fishbowlDescription: clean(product?.fishbowl?.description || existingAttributes.fishbowlDescription || ""),
		sku: product?.sku || existingAttributes.sku || "",
		internalPartNumber: product?.internalPartNumber || existingAttributes.internalPartNumber || "",
	};
}

function diffDecodedAgainstEnrichment(decoded = {}, enrichment = null) {
	const attrs = enrichment?.attributes || {};
	const checks = {
		category: enrichment?.category || "",
		subcategory: enrichment?.subcategory || "",
		familyType: attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "",
		measurementSystem: attrs.measurementSystem || "",
		diameter: attrs.diameter || "",
		length: attrs.length || "",
		threadPitch: attrs.threadPitch || "",
		threadSeries: attrs.threadSeries || attrs.thread_series || "",
		material: attrs.material || "",
		finish: attrs.finish || "",
		materialFinish: attrs.materialFinish || "",
		grade: attrs.grade || "",
		headProfile: attrs.headProfile || "",
	};
	const expected = {
		category: decoded.category || "bolts",
		subcategory: decoded.subcategory || "",
		familyType: decoded.familyType || "",
		measurementSystem: decoded.measurementSystem || "",
		diameter: decoded.diameter || "",
		length: decoded.length || "",
		threadPitch: decoded.threadPitch || "",
		threadSeries: decoded.threadSeries || "",
		material: decoded.material || "",
		finish: decoded.finish || "",
		materialFinish: decoded.materialFinish || "",
		grade: decoded.grade || "",
		headProfile: decoded.headProfile || "",
	};

	const mismatches = [];
	for (const [key, expectedValue] of Object.entries(expected)) {
		if (clean(checks[key]).toLowerCase() !== clean(expectedValue).toLowerCase()) {
			mismatches.push({ field: key, current: checks[key], expected: expectedValue });
		}
	}
	return mismatches;
}

export {
	attributesFromDecoded,
	buildTitle,
	clean,
	decodeCapScrewHeadFamilyFromProduct,
	diffDecodedAgainstEnrichment,
	slugify,
};

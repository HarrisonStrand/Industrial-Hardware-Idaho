// server/src/services/catalog/detectProductFamilyFromDescription.js

function clean(value = "") {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim();
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

function uniqueStrings(values = []) {
	return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))];
}

function firstMatch(text = "", patterns = []) {
	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match?.[1]) return clean(match[1]);
	}
	return "";
}

function detectMeasurementSystem(text = "") {
	if (/\bmetric\b/i.test(text)) return "metric";
	if (/\bm\d+(?:\.\d+)?\b/i.test(text)) return "metric";
	if (/\b\d+(?:\.\d+)?\s*mm\b/i.test(text)) return "metric";
	if (/\bmm\b/i.test(text)) return "metric";
	return "imperial";
}

function detectFinish(text = "") {
	const value = normalize(text);

	if (value.includes("yellow zinc")) return "yellow zinc";
	if (value.includes("zinc yellow")) return "yellow zinc";
	if (value.includes("yellow / zinc")) return "yellow zinc";
	if (value.includes("yellow-zinc")) return "yellow zinc";
	if (value.includes("hdg")) return "hot dip galvanized";
	if (value.includes("hot dip galvanized")) return "hot dip galvanized";
	if (value.includes("galvanized")) return "galvanized";
	if (value.includes("black oxide")) return "black oxide";
	if (value.includes("phosphate")) return "phosphate";
	if (value.includes("plain")) return "plain";
	if (value.includes("zinc")) return "zinc";

	return "";
}

function detectMaterial(text = "") {
	const raw = String(text || "");
	const value = normalize(raw);

	if (/\bs\/s\b/i.test(raw)) return "stainless steel";
	if (/\bstainless\b/i.test(raw)) return "stainless steel";
	if (/\bss\b/i.test(raw)) return "stainless steel";
	if (/ss$/i.test(clean(raw))) return "stainless steel";
	if (/fwss/i.test(raw)) return "stainless steel";

	if (/\balum\b/i.test(raw)) return "aluminum";
	if (/\balu\b/i.test(raw)) return "aluminum";
	if (/\baluminum\b/i.test(raw)) return "aluminum";
	if (/\bplastic\b/i.test(raw)) return "plastic";
	if (/\bnylon\b/i.test(raw)) return "nylon";
	if (/\bbrass\b/i.test(raw)) return "brass";
	if (/\bcarbon steel\b/i.test(raw)) return "steel";
	if (/\bsteel\b/i.test(raw)) return "steel";

	// washer shorthand / common catalog hints for default steel items
	if (
		value.includes("gr2") ||
		value.includes("grade 2") ||
		/\buss\b/i.test(raw) ||
		/\bsae\b/i.test(raw) ||
		/\bf436\b/i.test(raw) ||
		value.includes("flat washer") ||
		value.includes("lockwasher") ||
		value.includes("lock washer") ||
		value.includes("fender washer")
	) {
		return "steel";
	}

	return "";
}

function normalizeMaterialAndFinish({ material = "", finish = "" }) {
	let nextMaterial = clean(material).toLowerCase();
	let nextFinish = clean(finish).toLowerCase();

	const materialMap = {
		stainless: "stainless steel",
		"stainless steel": "stainless steel",
		"s/s": "stainless steel",
		ss: "stainless steel",
		alu: "aluminum",
		alum: "aluminum",
		aluminum: "aluminum",
		nylon: "nylon",
		plastic: "plastic",
		brass: "brass",
		"carbon steel": "steel",
		steel: "steel",
	};

	const finishMap = {
		zinc: "zinc",
		plain: "plain",
		"black oxide": "black oxide",
		"black-oxide": "black oxide",
		chrome: "chrome",
		galvanized: "galvanized",
		"hot dip galvanized": "hot dip galvanized",
		hdg: "hot dip galvanized",
		"yellow zinc": "yellow zinc",
		"zinc yellow": "yellow zinc",
	};

	nextMaterial = materialMap[nextMaterial] || nextMaterial;
	nextFinish = finishMap[nextFinish] || nextFinish;

	// If we still don't know material for a washer-family style item,
	// default it to steel so the finish fallback can work.
	if (!nextMaterial) {
		nextMaterial = "steel";
	}

	// Non-coated base materials
	if (
		["stainless steel", "aluminum", "nylon", "plastic", "brass"].includes(
			nextMaterial,
		)
	) {
		nextFinish = "";
	}

	// Default standard steel items to zinc unless something explicit was detected
	if (nextMaterial === "steel" && !nextFinish) {
		nextFinish = "zinc";
	}

	const displayMaterial = nextMaterial || nextFinish || "";
	const displayFinish = nextFinish || nextMaterial || "";

	const materialFinish =
		nextFinish && nextMaterial
			? `${displayMaterial} / ${displayFinish}`
			: displayMaterial || displayFinish || "";

	return {
		material: nextMaterial,
		finish: nextFinish,
		displayMaterial,
		displayFinish,
		materialFinish,
	};
}

function detectGrade(text = "") {
	const value = normalize(text);

	if (/\bgrade\s*8\b/i.test(value)) return "grade 8";
	if (/\bgr\s*8\b/i.test(value)) return "grade 8";
	if (/\bgrade\s*5\b/i.test(value)) return "grade 5";
	if (/\bgr\s*5\b/i.test(value)) return "grade 5";
	if (/\ba2-70\b/i.test(value)) return "a2-70";
	if (/\ba4-70\b/i.test(value)) return "a4-70";
	return "";
}

function detectGenericDimensions(text = "") {
	const cleaned = clean(text);

	const size = firstMatch(cleaned, [
		/\b(\d+(?:\/\d+)?\s*x\s*\d+(?:\/\d+)?(?:\s*-\s*\d+(?:\/\d+)?)?)\b/i,
		/\b(\d+(?:\/\d+)?\s*x\s*\d+(?:\/\d+)?)\b/i,
	]);

	const diameter = firstMatch(cleaned, [
		/\b(\d+(?:\/\d+)?)\s*x\s*\d+(?:\/\d+)?(?:\.\d+)?\b/i,
		/\bdiam(?:eter)?\s*[:\-]?\s*(\d+(?:\/\d+)?)\b/i,
	]);

	const length = firstMatch(cleaned, [
		/\b\d+(?:\/\d+)?\s*x\s*(\d+(?:\/\d+)?(?:\.\d+)?)\b/i,
		/\blength\s*[:\-]?\s*(\d+(?:\/\d+)?(?:\.\d+)?)\b/i,
	]);

	const threadPitch = firstMatch(cleaned, [
		/\b\d+(?:\/\d+)?-(\d+)\b/i,
		/\b(\d+\s*tpi)\b/i,
	]);

	return {
		size,
		diameter,
		length,
		threadPitch,
	};
}

function fractionFromSixteenthsCode(code = "") {
	const raw = String(code || "").trim();
	if (!raw) return "";

	const digits = raw.replace(/\D/g, "");
	if (!digits) return "";

	// Fishbowl bolt format uses 4 digits as:
	// first 2 = whole inches
	// last 2 = sixteenths
	// examples:
	// 0200 => 2
	// 0308 => 3 1/2
	// 0408 => 4 1/2
	// 0112 => 1 3/4
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

	// fallback for any older oddball coding
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

function imperialThreadPitchAndSeriesFromCode(code = "", seriesCode = "") {
	const normalized = String(code || "")
		.trim()
		.toUpperCase();
	const series = String(seriesCode || "")
		.trim()
		.toUpperCase();

	if (normalized === "010") {
		return {
			threadPitch: series === "F" ? "32" : "24",
			threadSeries: series === "F" ? "fine" : "coarse",
		};
	}

	if (normalized === "011") {
		return {
			threadPitch: "32",
			threadSeries: "fine",
		};
	}

	const threadMap = {
		"04": { C: "20", F: "28" },
		"05": { C: "18", F: "24" },
		"06": { C: "16", F: "24" },
		"07": { C: "14", F: "20" },
		"08": { C: "13", F: "20" },
		"09": { C: "12", F: "18" },
		10: { C: "11", F: "18" },
		12: { C: "10", F: "16" },
		14: { C: "9", F: "14" },
		16: { C: "8", F: "12" },

		"040": { C: "20", F: "28" },
		"050": { C: "18", F: "24" },
		"060": { C: "16", F: "24" },
		"070": { C: "14", F: "20" },
		"080": { C: "13", F: "20" },
		"090": { C: "12", F: "18" },
		100: { C: "11", F: "18" },
		120: { C: "10", F: "16" },
		140: { C: "9", F: "14" },
		160: { C: "8", F: "12" },
	};

	const row = threadMap[normalized];
	if (!row) return { threadPitch: "", threadSeries: "" };

	const normalizedSeries = series === "F" ? "F" : "C";

	return {
		threadPitch: row[normalizedSeries] || "",
		threadSeries: normalizedSeries === "F" ? "fine" : "coarse",
	};
}

function imperialDiameterFromCode(code = "") {
	const normalized = String(code || "")
		.trim()
		.toUpperCase();

	const map = {
		"010": "#10",
		"011": "#10",

		"04": "1/4",
		"05": "5/16",
		"06": "3/8",
		"07": "7/16",
		"08": "1/2",
		"09": "9/16",
		10: "5/8",
		12: "3/4",
		14: "7/8",
		16: "1",

		"040": "1/4",
		"050": "5/16",
		"060": "3/8",
		"070": "7/16",
		"080": "1/2",
		"090": "9/16",
		100: "5/8",
		120: "3/4",
		140: "7/8",
		160: "1",
	};

	return map[normalized] || "";
}

function imperialThreadPitchFromCode(code = "", gradeDigit = "") {
	const normalized = String(code || "")
		.trim()
		.toUpperCase();

	if (normalized === "010") return "24";
	if (normalized === "011") return "32";

	// coarse/fine could eventually vary by series, but this is a safe starting map
	const map = {
		"040": "20",
		"050": "18",
		"060": "16",
		"080": "13",
		100: "11",
		120: "10",
		140: "9",
		160: "8",
		"06": "16",
		10: "11",
	};

	return map[normalized] || "";
}

function metricDiameterFromCode(code = "") {
	const normalized = String(code || "")
		.trim()
		.toUpperCase();

	const map = {
		"040": "M4",
		"050": "M5",
		"060": "M6",
		"080": "M8",
		100: "M10",
		120: "M12",
		160: "M16",
		200: "M20",
	};

	return map[normalized] || "";
}

function metricThreadPitchFromDiameter(diameter = "") {
	const normalized = String(diameter || "")
		.trim()
		.toUpperCase();

	const map = {
		M4: "0.7",
		M5: "0.8",
		M6: "1.0",
		M8: "1.25",
		M10: "1.5",
		M12: "1.75",
		M16: "2.0",
		M20: "2.5",
	};

	return map[normalized] || "";
}

function decodeImperialHexCapPartNumber(partNum = "") {
	const raw = String(partNum || "")
		.trim()
		.toUpperCase();
	if (!raw) return null;

	// optional 2-letter finish/material prefix, then CS, then grade digit,
	// then thread series C/F, then diameter code, then length code, then optional P or T
	const match = raw.match(
		/^(?:([A-Z]{2}))?(CS)(\d)([CF])(\d{2,3})(\d{4})(P|T)?$/i,
	);
	if (!match) return null;

	const [
		,
		prefix = "",
		typeCode = "",
		gradeDigit = "",
		seriesCode = "",
		diaCode = "",
		lenCode = "",
		suffixCode = "",
	] = match;

	const diameter = imperialDiameterFromCode(diaCode);
	const length = fractionFromSixteenthsCode(lenCode);
	const threadData = imperialThreadPitchAndSeriesFromCode(diaCode, seriesCode);

	let materialHint = "";
	let finishHint = "";

	if (prefix === "SS") {
		materialHint = "stainless steel";
	} else {
		materialHint = "steel";
	}

	const isPlain = suffixCode === "P";
	const isTapBolt = suffixCode === "T";

	if (isPlain) finishHint = "plain";
	else if (prefix === "HH") finishHint = "hot dip galvanized";
	else if (prefix === "SB") finishHint = "black oxide";
	else if (prefix === "AN") finishHint = "plain";
	else if (materialHint === "steel") finishHint = "zinc";

	let grade = "";
	if (materialHint === "stainless steel") {
		grade = "";
	} else if (gradeDigit === "5") {
		grade = "grade 5";
	} else if (gradeDigit === "8") {
		grade = "grade 8";
	} else if (gradeDigit) {
		grade = `grade ${gradeDigit}`;
	}

	return {
		familyType: typeCode === "CS" ? "hex cap screw" : "",
		measurementSystem: "imperial",
		diameter,
		length,
		threadPitch: threadData.threadPitch,
		threadSeries: threadData.threadSeries,
		threadCoverage: isTapBolt ? "full" : "partial",
		grade,
		materialHint,
		finishHint,
	};
}

function decodeMetricHexCapPartNumber(partNum = "") {
	const raw = String(partNum || "")
		.trim()
		.toUpperCase();
	if (!raw) return null;

	const match = raw.match(/^(MM)(CS)(\d{2,3})(\d{4})(SS|P)?$/i);
	if (!match) return null;

	const [, , typeCode = "", diaCode = "", lenCode = "", suffix = ""] = match;

	const diameter = metricDiameterFromCode(diaCode);
	const length = fractionFromSixteenthsCode(lenCode);
	const threadPitch = metricThreadPitchFromDiameter(diameter);

	const materialHint = suffix === "SS" ? "stainless steel" : "steel";
	const finishHint =
		suffix === "P" ? "plain" : materialHint === "steel" ? "zinc" : "";

	return {
		familyType: typeCode === "CS" ? "hex cap screw" : "",
		measurementSystem: "metric",
		diameter,
		length,
		threadPitch,
		threadSeries: "",
		grade: "",
		materialHint,
		finishHint,
	};
}

function decodeHexCapPartNumber(product = null, parsed = {}) {
	const partNum = getPartNumberText(product, parsed).toUpperCase();

	if (partNum.startsWith("MMCS")) {
		return decodeMetricHexCapPartNumber(partNum);
	}

	if (partNum.includes("CS")) {
		return decodeImperialHexCapPartNumber(partNum);
	}

	return null;
}

function detectBoltHeadType(text = "", familyType = "") {
	const value = normalize(text);
	const family = normalize(familyType);

	if (family === "hex cap screw") return "hex";
	if (family === "socket head cap screw") return "socket";
	if (family === "carriage bolt") return "carriage";
	if (family === "lag screw") return "hex";

	if (value.includes("hex cap screw")) return "hex";
	if (value.includes("hex head bolt")) return "hex";
	if (value.includes("socket head cap screw")) return "socket";
	if (value.includes("socket cap screw")) return "socket";
	if (value.includes("carriage bolt")) return "carriage";
	if (value.includes("lag bolt") || value.includes("lag screw")) return "hex";

	return "";
}

function detectBoltDriveType(text = "", familyType = "") {
	const value = normalize(text);
	const family = normalize(familyType);

	if (value.includes("torx")) return "torx";
	if (value.includes("star drive")) return "torx";
	if (value.includes("square drive")) return "square";
	if (value.includes("robertson")) return "square";
	if (value.includes("phillips")) return "phillips";
	if (value.includes("slotted")) return "slotted";
	if (value.includes("allen")) return "hex socket";
	if (value.includes("internal hex")) return "hex socket";
	if (family === "socket head cap screw") return "hex socket";
	if (family === "hex cap screw") return "hex";
	if (family === "carriage bolt") return "";
	if (family === "lag screw") return "hex";

	return "";
}

function detectWasherStandard(text = "", parsed = {}) {
	const explicit = clean(
		parsed.washerStandard || parsed.standard || parsed.pattern || "",
	);

	if (explicit) return explicit.toUpperCase();

	if (/\bf436\b/i.test(text)) return "F436";
	if (/\bfender\b/i.test(text)) return "FENDER";
	if (/\buss\b/i.test(text)) return "USS";
	if (/\bsae\b/i.test(text)) return "SAE";
	if (/\ban\b/i.test(text)) return "AN";
	return "";
}

function isLikelyWasherHeadScrew(text = "") {
	const value = normalize(text);

	return (
		value.includes("pan washer") ||
		value.includes("washer head") ||
		value.includes("hex washer head") ||
		value.includes("self drilling") ||
		value.includes("s/m/s") ||
		value.includes("sq.dr")
	);
}

function detectWasherSubtype(text = "") {
	const value = normalize(text);

	if (value.includes("wedge lock washer")) return "lock washer";
	if (value.includes("split lock washer")) return "lock washer";
	if (value.includes("lockwasher")) return "lock washer";
	if (value.includes("lock washer")) return "lock washer";
	if (value.includes("fender washer")) return "fender washer";
	if (value.includes("flat washer")) return "flat washer";
	if (value.includes("sq washer") || value.includes("square washer"))
		return "flat washer";
	if (value.includes("hardened washer")) return "flat washer";
	if (value.includes("sealing washer")) return "flat washer";
	if (
		/\buss\b/i.test(text) ||
		/\bsae\b/i.test(text) ||
		/\ban\b/i.test(text) ||
		/\bf436\b/i.test(text)
	) {
		return "flat washer";
	}
	if (value.includes("washer")) return "washer";
	return "";
}

function detectLockWasherType(text = "", parsed = {}) {
	const explicit = clean(parsed.washerType || parsed.type || "");
	if (explicit) return explicit.toLowerCase();

	const value = normalize(text);

	if (
		value.includes("hi-collar") ||
		value.includes("hicollar") ||
		value.includes("high collar")
	) {
		return "hi-collar";
	}

	if (
		value.includes("lockwasher") ||
		value.includes("lock washer") ||
		value.includes("split lock washer")
	) {
		return "regular";
	}

	return "";
}

function detectWasherGrade(text = "", parsed = {}, material = "", finish = "") {
	const explicit = clean(parsed.grade || "");
	if (explicit) return explicit;

	const value = normalize(text);
	const mat = clean(material).toLowerCase();
	const fin = clean(finish).toLowerCase();

	if (value.includes("grade 8") || value.includes("gr8")) return "8";
	if (value.includes("316")) return "316";
	if (value.includes("304")) return "304";
	if (value.includes("gr2") || value.includes("grade 2")) return "2";

	if (mat === "stainless steel") return "304";

	if (
		mat === "steel" &&
		[
			"zinc",
			"plain",
			"yellow zinc",
			"galvanized",
			"hot dip galvanized",
		].includes(fin || "zinc")
	) {
		return "2";
	}

	return "";
}

function detectMetricNominalSize(text = "") {
	const mmValue = firstMatch(text, [
		/\bwasher\s+(\d+(?:\.\d+)?\s*mm)\b/i,
		/\bflat washer\s+(\d+(?:\.\d+)?\s*mm)\b/i,
		/\block(?:\s*|\-)washer\s+(\d+(?:\.\d+)?\s*mm)\b/i,
		/\b(\d+(?:\.\d+)?\s*mm)\s+(?:flat\s+|lock\s+|fender\s+)?washer\b/i,
	]);
	if (mmValue) return mmValue.toUpperCase().replace(/\s+/g, "");

	const mValue = firstMatch(text, [
		/\bwasher\s+(m\d+(?:\.\d+)?)\b/i,
		/\bflat washer\s+(m\d+(?:\.\d+)?)\b/i,
		/\block(?:\s*|\-)washer\s+(m\d+(?:\.\d+)?)\b/i,
		/\bwedge lock washer\s+(m\d+(?:\.\d+)?)\b/i,
		/\b(m\d+(?:\.\d+)?)\s+(?:flat\s+|lock\s+|fender\s+)?washer\b/i,
	]);
	if (mValue) return mValue.toUpperCase();

	return "";
}

function detectImperialNominalSize(text = "") {
	return firstMatch(text, [
		/\bwasher\s+([#]?\d+(?:\/\d+)?)\b/i,
		/\bflat washer\s+([#]?\d+(?:\/\d+)?)\b/i,
		/\block(?:\s*|\-)washer\s+([#]?\d+(?:\/\d+)?)\b/i,
		/\bfender washer\s+([#]?\d+(?:\/\d+)?)\b/i,
		/\bhardened washer\s+([#]?\d+(?:\/\d+)?)\b/i,
		/\b(?:sae|uss|an)\s+([#]?\d+(?:\/\d+)?)\b/i,
		/^\s*([#]?\d+(?:\/\d+)?)\s+(?:uss\s+|sae\s+|an\s+|f436\s+)?(?:flat\s+|fender\s+|lock\s+|hardened\s+)?washer\b/i,
		/^\s*([#]?\d+(?:\/\d+)?)\s+f436\s+hardened washer\b/i,
	]);
}

function detectWasherNominalAndOD(text = "") {
	const compactTriple = text.match(
		/\b([#]?\d+(?:\/\d+)?(?:\.\d+)?)x(\d+(?:\/\d+)?(?:\.\d+)?)x(\.\d+(?:-\.\d+)?)\b/i,
	);
	if (compactTriple) {
		return {
			size: clean(compactTriple[1]),
			diameter: clean(compactTriple[1]),
			insideDiameter: clean(compactTriple[1]),
			outsideDiameter: clean(compactTriple[2]),
			thickness: clean(compactTriple[3]),
		};
	}

	const compactPair = text.match(
		/\b([#]?\d+(?:\/\d+)?(?:\.\d+)?)x(\d+(?:\/\d+)?(?:\.\d+)?)\b/i,
	);
	if (compactPair) {
		return {
			size: clean(compactPair[1]),
			diameter: clean(compactPair[1]),
			insideDiameter: clean(compactPair[1]),
			outsideDiameter: clean(compactPair[2]),
			thickness: "",
		};
	}

	return {
		size: "",
		diameter: "",
		insideDiameter: "",
		outsideDiameter: "",
		thickness: "",
	};
}

function detectWasherOD(text = "") {
	return firstMatch(text, [
		/\(\s*(\d+(?:\/\d+)?(?:\.\d+)?)\s*x\s*\d+(?:\/\d+)?(?:\.\d+)?\s*"?\s*od\s*\)/i,
		/\(\s*\d+(?:\/\d+)?(?:\.\d+)?\s*x\s*(\d+(?:\/\d+)?(?:\.\d+)?)\s*"?\s*od\s*\)/i,
		/\b(?:od|outside diameter|outer diameter)\s*[:\-]?\s*(\d+(?:\/\d+)?(?:\.\d+)?)\b/i,
	]);
}

function detectWasherThickness(text = "") {
	return firstMatch(text, [
		/\b(?:thickness|thk)\s*[:\-]?\s*(\d+(?:\/\d+)?(?:\.\d+)?)\b/i,
		/\b\d+(?:\/\d+)?(?:\.\d+)?x\d+(?:\/\d+)?(?:\.\d+)?x(\.\d+(?:-\.\d+)?)\b/i,
	]);
}

function detectWasherFamily(text = "", parsed = {}) {
	const value = normalize(text);
	if (!value.includes("washer")) return null;
	if (isLikelyWasherHeadScrew(text)) return null;

	const subtype = detectWasherSubtype(text);
	if (!subtype) return null;

	const compact = detectWasherNominalAndOD(text);

	const nominalSize =
		clean(parsed.size || parsed.diameter || "") ||
		compact.size ||
		detectMetricNominalSize(text) ||
		detectImperialNominalSize(text);

	const outsideDiameter =
		clean(parsed.outsideDiameter || parsed.od || "") ||
		compact.outsideDiameter ||
		detectWasherOD(text);

	const width =
		subtype === "fender washer"
			? clean(parsed.width || "") || outsideDiameter
			: "";

	const thickness =
		clean(parsed.thickness || "") ||
		compact.thickness ||
		detectWasherThickness(text);

	const washerStandard =
		subtype === "flat washer" ? detectWasherStandard(text, parsed) : "";

	const washerType =
		subtype === "lock washer" ? detectLockWasherType(text, parsed) : "";

	const normalizedMF = normalizeMaterialAndFinish({
		material: parsed.material || detectMaterial(text),
		finish: parsed.finish || detectFinish(text),
	});

	const grade = detectWasherGrade(
		text,
		parsed,
		normalizedMF.material,
		normalizedMF.finish,
	);

	return {
		familyType: subtype,
		category: "washers",
		subcategory:
			subtype === "fender washer"
				? "fender washers"
				: subtype === "lock washer"
					? "lock washers"
					: "flat washers",
		fastenerType: subtype,
		washerType,
		washerStandard,
		size: nominalSize,
		diameter: nominalSize,
		insideDiameter: nominalSize,
		outsideDiameter,
		width,
		thickness,
		length: "",
		threadPitch: "",
		measurementSystem:
			parsed.measurementSystem || detectMeasurementSystem(text),
		material: normalizedMF.material,
		finish: normalizedMF.finish,
		displayMaterial: normalizedMF.displayMaterial,
		displayFinish: normalizedMF.displayFinish,
		materialFinish: normalizedMF.materialFinish,
		grade,
	};
}

function detectCotterPinFamily(text = "", parsed = {}) {
	const value = normalize(text);
	if (!value.includes("cotter pin")) return null;

	const dims = detectGenericDimensions(text);

	return {
		familyType: "cotter pin",
		category: "pins",
		subcategory: "cotter pins",
		fastenerType: "cotter pin",
		size: parsed.size || dims.size || "",
		diameter: parsed.diameter || dims.diameter || "",
		length: parsed.length || dims.length || "",
		threadPitch: "",
		measurementSystem:
			parsed.measurementSystem || detectMeasurementSystem(text),
		material: parsed.material || detectMaterial(text),
		finish: parsed.finish || detectFinish(text),
		grade: "",
	};
}

function getPartNumberText(product = null, parsed = {}) {
	return clean(
		parsed.fishbowlPartNum || product?.fishbowl?.partNum || product?.sku || "",
	);
}

function detectBoltMaterial(
	text = "",
	product = null,
	parsed = {},
	decoded = null,
) {
	const rawText = String(text || "");

	if (clean(parsed.material)) return clean(parsed.material);
	if (decoded?.materialHint) return decoded.materialHint;

	if (/\bs\/s\b/i.test(rawText)) return "stainless steel";
	if (/\bstainless\b/i.test(rawText)) return "stainless steel";
	if (/[\s/(-]ss[\s/)-]?/i.test(` ${rawText} `)) return "stainless steel";

	return detectMaterial(text) || "steel";
}

function detectBoltFinish(
	text = "",
	product = null,
	parsed = {},
	material = "",
	decoded = null,
) {
	const rawText = String(text || "");
	const value = normalize(rawText);
	const mat = clean(material).toLowerCase();

	if (clean(parsed.finish)) return clean(parsed.finish);
	if (decoded?.finishHint) return decoded.finishHint;

	if (value.includes("plain")) return "plain";
	if (value.includes("hot dip galvanized")) return "hot dip galvanized";
	if (value.includes("hdg")) return "hot dip galvanized";
	if (value.includes("yellow zinc")) return "yellow zinc";
	if (value.includes("zinc yellow")) return "yellow zinc";
	if (value.includes("black oxide")) return "black oxide";
	if (value.includes("phosphate")) return "phosphate";
	if (value.includes("galvanized")) return "galvanized";
	if (value.includes("zinc")) return "zinc";

	if (mat === "stainless steel") return "";

	return "zinc";
}

function detectBoltGrade(
	text = "",
	measurementSystem = "",
	material = "",
	parsed = {},
	decoded = null,
) {
	const explicit = clean(parsed.grade || "");
	if (explicit) return explicit;

	const rawText = String(text || "");
	const mat = clean(material).toLowerCase();
	const system = clean(measurementSystem).toLowerCase();

	if (mat === "stainless steel") {
		if (/\b316\b/i.test(rawText)) return "316";
		return "304";
	}

	if (system === "metric") {
		if (/\b12\.9\b/i.test(rawText)) return "12.9";
		if (/\b10\.9\b/i.test(rawText)) return "10.9";
		return "8.8";
	}

	return clean(decoded?.grade || detectGrade(text) || "");
}

function detectBoltLikeFamily(text = "", parsed = {}, product = null) {
	const value = normalize(text);
	const decoded = decodeHexCapPartNumber(product, parsed);
	const partNum = getPartNumberText(product, parsed).toUpperCase();

	const looksLikeEncodedHexCap =
		partNum.startsWith("MMCS") || /(?:^|[A-Z]{0,2})CS\d/i.test(partNum);

	const isHexCap =
		value.includes("hex cap screw") ||
		value.includes("hex head bolt") ||
		value.includes("hex bolt") ||
		decoded?.familyType === "hex cap screw" ||
		looksLikeEncodedHexCap;

	const isCarriage = value.includes("carriage bolt");
	const isLag = value.includes("lag bolt") || value.includes("lag screw");
	const isSocket =
		value.includes("socket head cap screw") ||
		value.includes("socket cap screw");

	if (!isHexCap && !isCarriage && !isLag && !isSocket) return null;

	const dims = detectGenericDimensions(text);

	let familyType = "fastener";
	let subcategory = "fasteners";

	if (isHexCap) {
		familyType = "hex cap screw";
		subcategory = "hex cap screws";
	} else if (isCarriage) {
		familyType = "carriage bolt";
		subcategory = "carriage bolts";
	} else if (isLag) {
		familyType = "lag screw";
		subcategory = "lag screws";
	} else if (isSocket) {
		familyType = "socket head cap screw";
		subcategory = "socket head cap screws";
	}

	const measurementSystem =
		parsed.measurementSystem ||
		decoded?.measurementSystem ||
		detectMeasurementSystem(text);

	const diameter = parsed.diameter || decoded?.diameter || dims.diameter || "";

	const length = parsed.length || decoded?.length || dims.length || "";

	const threadPitch =
		parsed.threadPitch || decoded?.threadPitch || dims.threadPitch || "";

	const threadSeries =
		clean(parsed.threadSeries || parsed.thread_series || "") ||
		clean(decoded?.threadSeries || "");

	const boltMaterial = detectBoltMaterial(text, product, parsed, decoded);
	const boltFinish = detectBoltFinish(
		text,
		product,
		parsed,
		boltMaterial,
		decoded,
	);

	const grade = detectBoltGrade(
		text,
		measurementSystem,
		boltMaterial,
		parsed,
		decoded,
	);

	const normalizedMF = normalizeMaterialAndFinish({
		material: boltMaterial,
		finish: boltFinish,
	});

	const headType =
		clean(parsed.headType || parsed.head_type || "") ||
		detectBoltHeadType(text, familyType);

	const driveType =
		clean(parsed.driveType || parsed.drive_type || "") ||
		detectBoltDriveType(text, familyType);

	return {
		familyType,
		category: "bolts",
		subcategory,
		fastenerType: familyType,
		headType,
		driveType,
		size: parsed.size || "",
		diameter,
		length,
		threadPitch,
		threadSeries,
		threadCoverage:
			clean(parsed.threadCoverage || parsed.thread_coverage || "") ||
			clean(decoded?.threadCoverage || ""),
		measurementSystem,
		material: normalizedMF.material,
		finish: normalizedMF.finish,
		displayMaterial: normalizedMF.displayMaterial,
		displayFinish: normalizedMF.displayFinish,
		materialFinish: normalizedMF.materialFinish,
		grade,
	};
}

function detectAbrasiveFamily(text = "", parsed = {}) {
	const value = normalize(text);

	const isAbrasive =
		value.includes("abrasive") ||
		value.includes("cut off wheel") ||
		value.includes("cutoff wheel") ||
		value.includes("flap disc") ||
		value.includes("grinding wheel") ||
		value.includes("sanding disc") ||
		value.includes("belt ");

	if (!isAbrasive) return null;

	let subtype = "abrasives";
	if (value.includes("flap disc")) subtype = "flap disc";
	else if (value.includes("cut off wheel") || value.includes("cutoff wheel"))
		subtype = "cut off wheel";
	else if (value.includes("grinding wheel")) subtype = "grinding wheel";
	else if (value.includes("sanding disc")) subtype = "sanding disc";
	else if (value.includes("belt")) subtype = "abrasive belt";

	const grit = firstMatch(text, [/\b(\d+\s*grit)\b/i, /\b(grit\s*\d+)\b/i]);
	const diameter = firstMatch(text, [/\b(\d+(?:\/\d+)?)["”]?\s*(?:x|\b)/i]);

	return {
		familyType: subtype,
		category: "abrasives",
		subcategory: subtype.endsWith("s") ? subtype : `${subtype}s`,
		fastenerType: "",
		size: parsed.size || "",
		diameter: parsed.diameter || diameter || "",
		length: parsed.length || "",
		threadPitch: "",
		measurementSystem:
			parsed.measurementSystem || detectMeasurementSystem(text),
		material: parsed.material || "",
		finish: parsed.finish || "",
		grade: grit || "",
	};
}

function detectAuvecoFamily(text = "", parsed = {}, product = null) {
	const value = normalize(text);
	const vendor = normalize(product?.vendor || "");
	const brand = normalize(product?.brand || "");

	const looksAuveco =
		vendor.includes("auveco") ||
		brand.includes("auveco") ||
		value.includes("auveco");

	if (!looksAuveco) return null;

	let subtype = "auveco hardware";
	if (value.includes("clip")) subtype = "auveco clips";
	else if (value.includes("retainer")) subtype = "auveco retainers";
	else if (value.includes("panel fastener")) subtype = "auveco panel fasteners";

	return {
		familyType: subtype,
		category: "specialty hardware",
		subcategory: subtype,
		fastenerType: subtype,
		size: parsed.size || "",
		diameter: parsed.diameter || "",
		length: parsed.length || "",
		threadPitch: "",
		measurementSystem:
			parsed.measurementSystem || detectMeasurementSystem(text),
		material: parsed.material || detectMaterial(text),
		finish: parsed.finish || detectFinish(text),
		grade: "",
	};
}

function detectFallbackFamily(text = "", parsed = {}, product = null) {
	const vendor = clean(product?.vendor || "");
	const brand = clean(product?.brand || "");
	const measurementSystem =
		parsed.measurementSystem || detectMeasurementSystem(text);
	const dims = detectGenericDimensions(text);

	const normalizedMF = normalizeMaterialAndFinish({
		material: parsed.material || detectMaterial(text),
		finish: parsed.finish || detectFinish(text),
	});

	return {
		familyType: "general hardware",
		category: "uncategorized",
		subcategory: "needs classification",
		fastenerType: "",
		size: parsed.size || dims.size || "",
		diameter: parsed.diameter || dims.diameter || "",
		insideDiameter: parsed.insideDiameter || parsed.id || "",
		outsideDiameter: parsed.outsideDiameter || parsed.od || "",
		thickness: parsed.thickness || "",
		length: parsed.length || dims.length || "",
		threadPitch: parsed.threadPitch || dims.threadPitch || "",
		measurementSystem,
		material: normalizedMF.material,
		finish: normalizedMF.finish,
		displayMaterial: normalizedMF.displayMaterial,
		displayFinish: normalizedMF.displayFinish,
		materialFinish: normalizedMF.materialFinish,
		grade: parsed.grade || detectGrade(text),
		vendor,
		brand,
	};
}

function buildFamilyIdentity(detected = {}) {
	const familyType = clean(detected.familyType || "general hardware");
	const category = clean(detected.category || "uncategorized");
	const subcategory = clean(detected.subcategory || "needs classification");
	const finish = clean(detected.finish || "");
	const grade = clean(detected.grade || "");
	const material = clean(detected.material || "");
	const measurementSystem = clean(detected.measurementSystem || "");
	const vendor = clean(detected.vendor || "");
	const brand = clean(detected.brand || "");
	const washerStandard = clean(detected.washerStandard || "");
	const washerType = clean(detected.washerType || "");
	const diameter = clean(detected.diameter || "");
	const width = clean(detected.width || "");

	const familyKeyParts = [category, subcategory, familyType];

	if (familyType === "flat washer") {
		familyKeyParts.push(measurementSystem, washerStandard, diameter);
	} else if (familyType === "fender washer") {
		familyKeyParts.push(measurementSystem, diameter, width);
	} else if (familyType === "lock washer") {
		familyKeyParts.push(measurementSystem, washerType, diameter);
	} else if (familyType.includes("washer")) {
		familyKeyParts.push(measurementSystem, diameter);
	} else if (familyType.includes("cotter pin")) {
		familyKeyParts.push(finish, material, measurementSystem);
	} else if (
		familyType.includes("hex cap screw") ||
		familyType.includes("carriage bolt") ||
		familyType.includes("lag screw") ||
		familyType.includes("socket head cap screw")
	) {
		familyKeyParts.push(finish, grade, material, measurementSystem);
	} else if (familyType.includes("abrasive")) {
		familyKeyParts.push(grade, measurementSystem);
	} else if (familyType.includes("auveco")) {
		familyKeyParts.push(vendor, brand);
	} else {
		familyKeyParts.push(finish, material, measurementSystem, vendor, brand);
	}

	const familyKey = familyKeyParts
		.filter(Boolean)
		.map((v) => normalize(v))
		.join("|");

	let titleParts = [];

	if (familyType === "flat washer") {
		titleParts = [washerStandard, diameter, familyType].filter(Boolean);
	} else if (familyType === "fender washer") {
		titleParts = [diameter, width, familyType].filter(Boolean);
	} else if (familyType === "lock washer") {
		titleParts = [washerType, diameter, familyType].filter(Boolean);
	} else if (familyType.includes("washer")) {
		titleParts = [diameter, familyType].filter(Boolean);
	} else {
		titleParts = [
			washerStandard,
			washerType,
			finish,
			grade,
			material,
			familyType,
		].filter(Boolean);
	}

	const familyTitle = titleParts.join(" ") || familyType || "Catalog Family";
	const familySlug = slugify(familyTitle);

	return {
		familyKey,
		familyTitle,
		familySlug,
	};
}

export default function detectProductFamilyFromDescription({
	product = null,
	parsed = {},
}) {
	const sourceText = [
		product?.fishbowl?.description,
		product?.fishbowl?.partNum,
		product?.sku,
		parsed?.fastenerType,
		parsed?.category,
		parsed?.subcategory,
		parsed?.washerStandard,
		parsed?.standard,
		parsed?.pattern,
	]
		.filter(Boolean)
		.join(" ");

	const detected =
		detectBoltLikeFamily(sourceText, parsed, product) ||
		detectWasherFamily(sourceText, parsed) ||
		detectCotterPinFamily(sourceText, parsed) ||
		detectAbrasiveFamily(sourceText, parsed) ||
		detectAuvecoFamily(sourceText, parsed, product) ||
		detectFallbackFamily(sourceText, parsed, product);

	const identity = buildFamilyIdentity(detected);

	return {
		...detected,
		...identity,
		tags: uniqueStrings([
			detected.category,
			detected.subcategory,
			detected.familyType,
			detected.washerStandard,
			detected.washerType,
			detected.finish,
			detected.material,
			detected.grade,
			detected.measurementSystem,
			detected.vendor,
			detected.brand,
		])
			.filter(Boolean)
			.map(slugify),
	};
}

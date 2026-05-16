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

function looksImperialByStandard(text = "") {
	const raw = String(text || "");
	return /\buss\b/i.test(raw) || /\bsae\b/i.test(raw);
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
	if (/\bgalv\b/i.test(text)) return "galvanized";
	if (/\bcad(?:mium)?(?:-|\s)?plated\b/i.test(text)) return "cad plated";
	if (/\bzp\b/i.test(text)) return "zinc";

	return "";
}

function detectMaterial(text = "") {
	const raw = String(text || "");
	const value = normalize(raw);

	if (/\bnyl\b/i.test(raw)) return "nylon";
	if (/\bnylon\b/i.test(raw)) return "nylon";

	if (/\bs\/s\b/i.test(raw)) return "stainless steel";
	if (/\bstainless\b/i.test(raw)) return "stainless steel";
	if (/\bss\b/i.test(raw)) return "stainless steel";
	if (/ss$/i.test(clean(raw))) return "stainless steel";
	if (/fwss/i.test(raw)) return "stainless steel";

	if (/\balu\b/i.test(raw)) return "aluminum";
	if (/\balum\b/i.test(raw)) return "aluminum";
	if (/\baluminum\b/i.test(raw)) return "aluminum";

	if (/\bbrs\b/i.test(raw)) return "brass";
	if (/\bbrass\b/i.test(raw)) return "brass";

	if (/\bsilicon bronze\b/i.test(raw)) return "silicon bronze";
	if (/\bplastic\b/i.test(raw)) return "plastic";
	if (/\bcarbon steel\b/i.test(raw)) return "steel";
	if (/\bsteel\b/i.test(raw)) return "steel";

	if (
		value.includes("gr2") ||
		value.includes("grade 2") ||
		value.includes("a307") ||
		value.includes("a325") ||
		/\buss\b/i.test(raw) ||
		/\bsae\b/i.test(raw) ||
		/\bf436\b/i.test(raw) ||
		value.includes("hex bolt") ||
		value.includes("hex head bolt") ||
		value.includes("hex cap screw") ||
		value.includes("structural bolt") ||
		/\bc\/s\b/i.test(raw)
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
		"silicon bronze": "silicon bronze",
		"carbon steel": "steel",
		steel: "steel",
	};

	const finishMap = {
		zinc: "zinc",
		plain: "plain",
		Plain: "plain",
		"black oxide": "black oxide",
		"black-oxide": "black oxide",
		chrome: "chrome",
		galvanized: "galvanized",
		"hot dip galvanized": "hot dip galvanized",
		hdg: "hot dip galvanized",
		"yellow zinc": "yellow zinc",
		"zinc yellow": "yellow zinc",
		"cad plated": "cad plated",
	};

	nextMaterial = materialMap[nextMaterial] || nextMaterial;
	nextFinish = finishMap[nextFinish] || nextFinish;

	if (
		[
			"stainless steel",
			"aluminum",
			"nylon",
			"plastic",
			"brass",
			"silicon bronze",
		].includes(nextMaterial)
	) {
		nextFinish = "";
	}

	if (nextMaterial === "steel" && !nextFinish) {
		nextFinish = "zinc";
	}

	const displayMaterial = nextMaterial || nextFinish || "";
	const displayFinish = nextFinish || "";

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

	if (/\ba325\b/i.test(value)) return "A325";
	if (/\ba307\b/i.test(value)) return "A307";
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
		/\b(\d+(?:-\d+\/\d+|\/\d+)?\s*x\s*\d+(?:-\d+\/\d+|\/\d+)?(?:\s*-\s*\d+(?:\/\d+)?)?)\b/i,
		/\b(\d+(?:\/\d+)?\s*x\s*\d+(?:\/\d+)?)\b/i,
		/\b(m\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*x\s*\d+(?:mm)?)\b/i,
		/\b(m\d+(?:\.\d+)?x\d+(?:\.\d+)?x\d+(?:mm)?)\b/i,
	]);

	const diameter = firstMatch(cleaned, [
		/\b(m\d+(?:\.\d+)?)\s*x\s*\d+(?:\.\d+)?\s*x\s*\d+(?:mm)?\b/i,
		/\b(m\d+(?:\.\d+)?)x\d+(?:\.\d+)?x\d+(?:mm)?\b/i,
		/\b(\d+(?:-\d+\/\d+|\/\d+)?)\s*x\s*\d+(?:-\d+\/\d+|\/\d+)?(?:\.\d+)?\b/i,
		/\bdiam(?:eter)?\s*[:\-]?\s*(\d+(?:-\d+\/\d+|\/\d+)?)\b/i,
	]);

	const length = firstMatch(cleaned, [
		/\bm\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*x\s*(\d+(?:mm)?)\b/i,
		/\bm\d+(?:\.\d+)?x\d+(?:\.\d+)?x(\d+(?:mm)?)\b/i,
		/\b\d+(?:-\d+\/\d+|\/\d+)?\s*x\s*(\d+(?:-\d+\/\d+|\/\d+)?(?:\.\d+)?)\b/i,
		/\blength\s*[:\-]?\s*(\d+(?:-\d+\/\d+|\/\d+)?(?:\.\d+)?)\b/i,
	]);

	const threadPitch = firstMatch(cleaned, [
		/\bm\d+(?:\.\d+)?-(\d+(?:\.\d+)?)\b/i,
		/\b\d+(?:-\d+\/\d+|\/\d+)?-(\d+(?:\.\d+)?)\b/i,
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

function imperialThreadPitchAndSeriesFromCode(code = "", seriesCode = "") {
	const normalized = String(code || "").trim().toUpperCase();
	const series = String(seriesCode || "").trim().toUpperCase();

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
		"10": { C: "11", F: "18" },
		"12": { C: "10", F: "16" },
		"14": { C: "9", F: "14" },
		"16": { C: "8", F: "12" },
		"18": { C: "7", F: "8" },
		"20": { C: "7", F: "8" },
		"22": { C: "6", F: "8" },
		"24": { C: "6", F: "8" },
		"26": { C: "4.5", F: "6" },

		"040": { C: "20", F: "28" },
		"050": { C: "18", F: "24" },
		"060": { C: "16", F: "24" },
		"070": { C: "14", F: "20" },
		"080": { C: "13", F: "20" },
		"090": { C: "12", F: "18" },
		"100": { C: "11", F: "18" },
		"120": { C: "10", F: "16" },
		"140": { C: "9", F: "14" },
		"160": { C: "8", F: "12" },
		"180": { C: "7", F: "8" },
		"200": { C: "7", F: "8" },
		"220": { C: "6", F: "8" },
		"240": { C: "6", F: "8" },
		"260": { C: "4.5", F: "6" },
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

function metricDiameterFromCode(code = "") {
	const normalized = String(code || "").trim().toUpperCase();

	const map = {
		"030": "M3",
		"040": "M4",
		"050": "M5",
		"060": "M6",
		"080": "M8",
		"100": "M10",
		"120": "M12",
		"160": "M16",
		"180": "M18",
		"200": "M20",
	};

	return map[normalized] || "";
}

function metricThreadPitchFromDiameter(diameter = "") {
	const normalized = String(diameter || "").trim().toUpperCase();

	const map = {
		M3: "0.50",
		M4: "0.70",
		M5: "0.80",
		M6: "1.00",
		M8: "1.25",
		M10: "1.50",
		M12: "1.75",
		M16: "2.00",
		M18: "2.50",
		M20: "2.50",
		M24: "3.00",
		M30: "3.50",
	};

	return map[normalized] || "";
}

function isImperialStainlessHexCapPartNumber(partNum = "") {
	const raw = String(partNum || "").trim().toUpperCase().replace(/\s+/g, "");

	// Imperial stainless hex-cap/head bolts in Fishbowl are not always fully
	// encoded with the C/F thread-series marker. Examples like SSCS140700 316SS
	// still need to be treated as stainless hex-cap candidates because the SSCS
	// prefix is the reliable signal for this family.
	return /^SSCS/i.test(raw);
}

function textHasImperialStainlessHexCapPartNumber(text = "") {
	const raw = String(text || "").toUpperCase();
	return /(?:^|[^A-Z0-9])SSCS[A-Z0-9-]*/i.test(raw);
}

function detectStainlessGradeFromText(text = "") {
	const raw = String(text || "");

	if (/\b316\s*(?:s\/?s|ss|stainless)?\b/i.test(raw)) return "316";
	if (/\b304\s*(?:s\/?s|ss|stainless)?\b/i.test(raw)) return "304";
	if (/\ba4[-\s]?70\b/i.test(raw)) return "316";
	if (/\ba2[-\s]?70\b/i.test(raw)) return "304";

	return "";
}

function metricHexDescriptionEndsWithStainless(text = "", partNum = "") {
	const rawText = String(text || "").trim();
	const rawPart = String(partNum || "").trim().toUpperCase();

	if (!rawText) return false;
	if (!rawPart.startsWith("MMCS") && !/\bmetric\b|\bmm\b|\bm\d+/i.test(rawText)) {
		return false;
	}

	return /(?:^|\s)(?:s\/s|ss)\s*$/i.test(rawText);
}

function isStainlessHexCapCandidate(text = "", partNum = "") {
	return (
		isImperialStainlessHexCapPartNumber(partNum) ||
		textHasImperialStainlessHexCapPartNumber(text) ||
		metricHexDescriptionEndsWithStainless(text, partNum)
	);
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

function decodeLooseStainlessHexCapThreadFromText(text = "", partNum = "") {
	const combined = `${partNum || ""} ${text || ""}`.toUpperCase();
	const match = combined.match(/(?:^|[^A-Z0-9])SSCS(\d{2,3})(\d{4})([CF])(?:[^A-Z0-9]|$)/i);
	if (!match) return null;

	const [, diaCode = "", lenCode = "", seriesCode = ""] = match;
	const diameter = imperialDiameterFromCode(diaCode);
	const threadSeries = seriesCode.toUpperCase() === "F" ? "fine" : "coarse";
	const threadPitch = inferImperialThreadPitchBySeries(diameter, seriesCode);

	return {
		measurementSystem: "imperial",
		diameter,
		length: fractionFromSixteenthsCode(lenCode),
		threadPitch,
		threadSeries,
	};
}

function decodeImperialHexCapPartNumber(partNum = "") {
	const raw = String(partNum || "").trim().toUpperCase();
	if (!raw) return null;

	const match = raw.match(
		/^(?:([A-Z]{2}))?(CS)(\d)([CF])(\d{2,3})(\d{4})(P|T|TAP)?$/i,
	);
	if (!match) return null;

	const [
		,
		prefix = "",
		,
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
	} else if (prefix === "AL" || prefix === "AU") {
		materialHint = "aluminum";
	} else if (prefix === "BR") {
		materialHint = "brass";
	} else {
		materialHint = "steel";
	}

	const isPlain = suffixCode === "P";
	const isTapBolt = suffixCode === "T" || suffixCode === "TAP";

	if (isPlain) finishHint = "plain";
	else if (prefix === "HH") finishHint = "hot dip galvanized";
	else if (prefix === "SB") finishHint = "black oxide";
	else if (prefix === "AN") finishHint = "plain";
	else if (materialHint === "steel") finishHint = "zinc";

	let grade = "";
	if (materialHint === "stainless steel") {
		grade = "";
	} else if (
		materialHint === "aluminum" ||
		materialHint === "brass" ||
		materialHint === "nylon" ||
		materialHint === "silicon bronze"
	) {
		grade = "";
	} else if (gradeDigit === "5") {
		grade = "grade 5";
	} else if (gradeDigit === "8") {
		grade = "grade 8";
	} else if (gradeDigit === "2") {
		grade = "grade 2";
	} else if (gradeDigit) {
		grade = `grade ${gradeDigit}`;
	}

	return {
		familyType: "hex cap screw",
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
	const raw = String(partNum || "").trim().toUpperCase();
	if (!raw) return null;

	const match = raw.match(/^(MM)(CS)(\d{2,3})(\d{4})(SS|P)?$/i);
	if (!match) return null;

	const [, , , diaCode = "", lenCode = "", suffix = ""] = match;

	const diameter = metricDiameterFromCode(diaCode);
	const lengthValue = String(lenCode || "").replace(/^0+/, "") || "0";
	const length = `${Number(lengthValue)}mm`;
	const threadPitch = metricThreadPitchFromDiameter(diameter);

	const materialHint = suffix === "SS" ? "stainless steel" : "steel";
	const finishHint =
		suffix === "P" ? "plain" : materialHint === "steel" ? "zinc" : "";

	return {
		familyType: "hex cap screw",
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

function getPartNumberText(product = null, parsed = {}) {
	return clean(
		parsed.fishbowlPartNum || product?.fishbowl?.partNum || product?.sku || "",
	);
}

function decodeHexCapPartNumber(product = null, parsed = {}) {
	const partNum = getPartNumberText(product, parsed).toUpperCase();

	if (partNum.startsWith("MMCS")) {
		return decodeMetricHexCapPartNumber(partNum);
	}

	if (/^(?:SS|HH|SB|AN|AL|BR)?CS\d/i.test(partNum)) {
		return decodeImperialHexCapPartNumber(partNum);
	}

	return null;
}

function detectBoltHeadType(text = "", familyType = "") {
	const value = normalize(text);
	const family = normalize(familyType);

	if (family === "hex cap screw") return "hex";
	if (family === "socket head cap screw") return "socket";
	if (family === "structural bolt") return "hex";
	if (family === "heavy hex bolt") return "hex";
	if (family === "carriage bolt") return "carriage";
	if (family === "lag screw") return "hex";

	if (
		value.includes("hex cap screw") ||
		value.includes("hex head bolt") ||
		value.includes("hex bolt") ||
		value.includes("heavy hex bolt") ||
		value.includes("structural bolt") ||
		value.includes("hex hd") ||
		value.includes("hx hd")
	) {
		return "hex";
	}

	if (
		value.includes("socket head cap screw") ||
		value.includes("socket cap screw") ||
		value.includes("soc. hd") ||
		value.includes("soc hd") ||
		value.includes("socket hd")
	) {
		return "socket";
	}

	if (
		value.includes("square hd") ||
		value.includes("sq. hd") ||
		value.includes("sq hd")
	) {
		return "square";
	}

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

	if (
		value.includes("soc. hd") ||
		value.includes("soc hd") ||
		value.includes("socket hd") ||
		value.includes("socket head")
	) {
		return "hex socket";
	}

	if (
		family === "socket head cap screw"
	) {
		return "hex socket";
	}

	if (
		family === "hex cap screw" ||
		family === "structural bolt" ||
		family === "heavy hex bolt"
	) {
		return "hex";
	}

	if (family === "carriage bolt") return "";
	if (family === "lag screw") return "hex";

	return "";
}

function looksLikeSocketHead(text = "") {
	const value = normalize(text);
	return (
		value.includes("soc. hd") ||
		value.includes("soc hd") ||
		value.includes("socket hd") ||
		value.includes("socket head") ||
		value.includes("soc.c/s") ||
		value.includes("soc c/s") ||
		value.includes("soc. cap")
	);
}

function looksLikeSquareHead(text = "") {
	const value = normalize(text);
	return (
		value.includes("sq. hd") ||
		value.includes("sq hd") ||
		value.includes("square hd") ||
		value.includes("square head")
	);
}

function looksLikeFlatHead(text = "") {
	const value = normalize(text);
	return (
		value.includes("flt hd") ||
		value.includes("flat hd") ||
		value.includes("flat head")
	);
}

function looksLikeHexCapShorthand(text = "") {
	const value = normalize(text);

	return (
		value.includes("hex hd c/s") ||
		value.includes("hex hd. c/s") ||
		value.includes("hx hd c/s") ||
		value.includes("hx hd. c/s") ||
		value.includes("hex hd bolt") ||
		value.includes("hex bolt") ||
		value.includes("hex head bolt") ||
		value.includes("heavy hex bolt") ||
		value.includes("structural bolt") ||
		value.includes("a325") ||
		value.includes("a307") ||
		value.includes("galv.hex bolt") ||
		value.includes("galv. hex bolt") ||
		value.includes("chrome hex hd c/s") ||
		value.includes("chrome hx hd c/s") ||
		value.includes("hex hd") ||
		(/\bc\/s\b/i.test(text) &&
			(/\buss\b/i.test(text) ||
				/\bsae\b/i.test(text) ||
				/\bhex\b/i.test(text) ||
				/\bhx\b/i.test(text) ||
				/\bm\d+/i.test(text)))
	);
}

function detectImperialThreadedSize(text = "") {
	const raw = String(text || "");
	const match = raw.match(/\b(#?\d+)-(\d+(?:\.\d+)?)\s*x\s*([0-9./"-]+)\b/i);
	if (!match) return null;

	const [, diameterCode = "", threadPitch = "", length = ""] = match;
	const normalizedDiameter =
		String(diameterCode) === "10"
			? "#10"
			: String(diameterCode).startsWith("#")
				? String(diameterCode)
				: `#${diameterCode}`;

	return {
		size: `${normalizedDiameter}-${clean(threadPitch)}`,
		diameter: normalizedDiameter,
		threadPitch: clean(threadPitch),
		threadSeries: "",
		length: clean(String(length).replace(/"/g, "").replace(/-/g, " ")),
	};
}

function detectImperialThreadedDescription(text = "") {
	const raw = String(text || "");

	const patterns = [
		/\b(\d+(?:-\d+\/\d+|\/\d+)?)[\"”]?\s*-\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:-\d+\/\d+|\/\d+)?)[\"”]?\b/i,
		/\b(\d+(?:-\d+\/\d+|\/\d+)?)[\"”]?\s*-\s*(\d+(?:\.\d+)?)\s*(?:thread size)?[, ]+\s*(\d+(?:-\d+\/\d+|\/\d+)?)[\"”]?\s*(?:long)?\b/i,
	];

	for (const pattern of patterns) {
		const match = raw.match(pattern);
		if (!match) continue;

		const [, diameter = "", threadPitch = "", length = ""] = match;

		return {
			size: `${clean(diameter)}-${clean(threadPitch)}`,
			diameter: clean(diameter).replace(/"/g, ""),
			threadPitch: clean(threadPitch),
			length: clean(length).replace(/"/g, ""),
		};
	}

	return null;
}

function detectMetricThreadedSize(text = "") {
	const raw = String(text || "");

	const patterns = [
		/\b(M\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:mm)?)\b/i,
		/\b(M\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:mm)?)\b/i,
		/\b(M\d+(?:\.\d+)?)x(\d+(?:mm)?)-(\d+(?:\.\d+)?)\b/i,
		/\b(\d+(?:\.\d+)?)x(\d+(?:mm)?)-(\d+(?:\.\d+)?)\b/i,
	];

	for (const pattern of patterns) {
		const match = raw.match(pattern);
		if (!match) continue;

		if (/^M/i.test(match[1])) {
			const [, diameter = "", threadPitch = "", length = ""] = match;
			return {
				size: `${clean(diameter)}-${clean(threadPitch)}`,
				diameter: clean(diameter).toUpperCase(),
				threadPitch: clean(threadPitch),
				threadSeries: "",
				length: clean(length).toLowerCase().includes("mm")
					? clean(length)
					: `${clean(length)}mm`,
				measurementSystem: "metric",
			};
		}

		const [, diameter = "", length = "", threadPitch = ""] = match;
		return {
			size: `M${clean(diameter)}-${clean(threadPitch)}`,
			diameter: `M${clean(diameter)}`,
			threadPitch: clean(threadPitch),
			threadSeries: "",
			length: clean(length).toLowerCase().includes("mm")
				? clean(length)
				: `${clean(length)}mm`,
			measurementSystem: "metric",
		};
	}

	return null;
}

function inferImperialThreadSeries(diameter = "", threadPitch = "") {
	const dia = clean(diameter);
	const pitch = clean(threadPitch);

	if (!dia || !pitch) return "";

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

	if (coarseMap[dia] === pitch) return "coarse";
	if (fineMap[dia] === pitch) return "fine";

	return "";
}

function inferImperialCoarsePitchFromDiameter(diameter = "") {
	const dia = clean(diameter);

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

	return coarseMap[dia] || "";
}

function inferImperialSeriesFromPitch(diameter = "", threadPitch = "") {
	return inferImperialThreadSeries(diameter, threadPitch);
}

function detectImperialShorthandCapScrew(text = "") {
	const raw = String(text || "");

	const gradeMatch = raw.match(/\bGR\s*(\d+)\b/i);
	const a307 = /\bA307\b/i.test(raw);
	const a325 = /\bA325\b/i.test(raw);

	const sizeMatch = raw.match(
		/\b(?:GR\s*\d+\s+)?C\/S(?:\s+\w+)?\s+(?:USS|SAE)?\s*(\d+(?:-\d+\/\d+|\/\d+)?)X(\d+(?:-\d+\/\d+|\/\d+)?)\b/i,
	);

	if (!sizeMatch) return null;

	const diameter = clean(sizeMatch[1]);
	const length = clean(sizeMatch[2]);

	let grade = "";
	let familyType = "hex cap screw";
	let finish = "";
	let material = "steel";

	if (a325) {
		grade = "A325";
		familyType = "structural bolt";
		finish = /\bgalv\b|\bgalvanized\b/i.test(raw) ? "galvanized" : "plain";
	} else if (a307) {
		grade = "A307";
		familyType = "heavy hex bolt";
		finish = /\bgalv\b|\bgalvanized\b/i.test(raw)
			? "galvanized"
			: /\bzinc\b|\bzp\b/i.test(raw)
				? "zinc"
				: "plain";
	} else if (gradeMatch?.[1]) {
		grade = `grade ${clean(gradeMatch[1])}`;
		familyType = "hex cap screw";
		finish = detectFinish(raw) || "zinc";
	}

	const threadPitch = inferImperialCoarsePitchFromDiameter(diameter);
	const threadSeries = threadPitch ? "coarse" : "";

	return {
		diameter,
		length,
		threadPitch,
		threadSeries,
		grade,
		finish,
		material,
		measurementSystem: "imperial",
		familyType,
	};
}

function detectStructuralBoltDescription(text = "") {
	const raw = String(text || "");

	if (!/\ba325\b/i.test(raw) && !/\bstructural bolt\b/i.test(raw)) {
		return null;
	}

	const match = raw.match(
		/\bA325(?:\s+STRUCTURAL\s+BOLT)?\s+(\d+(?:-\d+\/\d+|\/\d+)?)X(\d+(?:-\d+\/\d+|\/\d+)?)\b/i,
	);

	if (!match) return null;

	const [, diameter = "", length = ""] = match;
	const cleanDiameter = clean(diameter);
	const cleanLength = clean(length);
	const finish =
		/\bgalv\b|\bgalvanized\b/i.test(raw) ? "galvanized" : "plain";
	const threadPitch = inferImperialCoarsePitchFromDiameter(cleanDiameter);
	const threadSeries = threadPitch ? "coarse" : "";

	return {
		familyType: "structural bolt",
		category: "bolts",
		subcategory: "hex cap screws",
		fastenerType: "hex cap screw",
		diameter: cleanDiameter,
		length: cleanLength,
		threadPitch,
		threadSeries,
		measurementSystem: "imperial",
		material: "steel",
		finish,
		grade: "A325",
	};
}


function detectCompactMetricCapScrew(text = "", product = null) {
	const raw = String(text || "");
	const partNum = getPartNumberText(product).toUpperCase();
	if (!partNum.startsWith("MM") && !/\bmm\b/i.test(raw)) return null;

	const patterns = [
		/\bC\/S\s+(\d+(?:\.\d+)?)MMX(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:\s*(S\/S|SS))?\b/i,
		/\bC\/S\s+(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)MM[\s-]?(\d+(?:\.\d+)?)(?:\s*(S\/S|SS))?\b/i,
		/\b(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)MM[\s-]?(\d+(?:\.\d+)?)(?:\s*(S\/S|SS))?\b/i,
		/\bC\/S\s+(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)[\s]+(\d+(?:\.\d+)?)(?:\s*(PL|ZC|S\/S|SS))?\b/i,
		/\b(\d+(?:\.\d+)?)MMX(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?:\s*(S\/S|SS))?\b/i,
		/\b(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)[\s]+(\d+(?:\.\d+)?)(?:\s*(ZC|PL))\b/i,
	];
	for (const pattern of patterns) {
		const m = raw.match(pattern);
		if (!m) continue;
		const [, d = '', l = '', pitch = '', suffix = ''] = m;
		const isStainless = /S\/S|SS/i.test(suffix) || /SS$/i.test(partNum) || /\bS\/S\b/i.test(raw);
		return {
			measurementSystem: 'metric',
			diameter: `M${clean(d)}`,
			length: `${clean(l)}mm`,
			threadPitch: clean(pitch),
			threadSeries: '',
			material: isStainless ? 'stainless steel' : 'steel',
			finish: isStainless ? '' : /\bPL\b/i.test(raw) ? 'plain' : 'zinc',
			grade: isStainless ? (/\b316\b/i.test(raw) ? '316' : '304') : (/\b12\.9\b/i.test(raw) ? '12.9' : (/\b10\.9\b/i.test(raw) ? '10.9' : '8.8')),
		};
	}
	return null;
}

function detectStainlessOneInchCapScrew(text = '', product = null) {
	const raw = String(text || '');
	const partNum = getPartNumberText(product).toUpperCase();
	const m = partNum.match(/^SSCS160(\d{4})(C)?(?:\s*TAP)?$/i);
	if (!m) return null;
	const lenCode = m[1] || '';
	const isTap = /TAP/i.test(partNum) || /TAP/i.test(raw);
	return {
		measurementSystem: 'imperial',
		diameter: '1',
		length: fractionFromSixteenthsCode(lenCode),
		threadPitch: '8',
		threadSeries: 'coarse',
		material: 'stainless steel',
		finish: '',
		grade: /316/i.test(raw) ? '316' : '304',
		threadCoverage: isTap ? 'full' : '',
	};
}

function detectRoundStockA307(text = '') {
	const raw = String(text || '');
	if (!/\bround stock\b/i.test(raw) || !/\bA307\b/i.test(raw)) return null;
	const m = raw.match(/(\d+(?:-\d+\/\d+|\/\d+)?)\s*["”]?\s*X\s*(\d+)\s*['′]?/i);
	if (!m) return null;
	const diameter = clean(m[1]);
	const length = clean(m[2]);
	const pitch = inferImperialCoarsePitchFromDiameter(diameter);
	return {measurementSystem:'imperial', diameter, length, threadPitch:pitch, threadSeries: pitch ? 'coarse':'', grade:'A307', material:'steel', finish:'zinc'};
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

function detectBoltMaterial(text = "", product = null, parsed = {}, decoded = null) {
	const rawText = String(text || "");
	const partNum = getPartNumberText(product, parsed).toUpperCase();

	// Stainless signals from the Fishbowl part number/description must win over
	// older parsed attributes, because some imported rows were parsed as steel/zinc
	// before stainless handling existed.
	if (isImperialStainlessHexCapPartNumber(partNum)) return "stainless steel";
	if (textHasImperialStainlessHexCapPartNumber(rawText)) return "stainless steel";
	if (metricHexDescriptionEndsWithStainless(rawText, partNum)) return "stainless steel";
	if (/\bs\/s\b/i.test(rawText)) return "stainless steel";
	if (/\bstainless\b/i.test(rawText)) return "stainless steel";
	if (/[\s/(-]ss[\s/)-]?/i.test(` ${rawText} `)) return "stainless steel";

	if (clean(parsed.material)) return clean(parsed.material);

	if (decoded?.materialHint) return decoded.materialHint;

	const detected = detectMaterial(text);
	if (detected) return detected;

	return "steel";
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

	if (mat === "stainless steel") return "";
	if (mat === "aluminum") return "";
	if (mat === "brass") return "";
	if (mat === "nylon") return "";
	if (mat === "silicon bronze") return "";

	if (decoded?.finishHint) return decoded.finishHint;

	if (value.includes("plain")) return "plain";
	if (value.includes("hot dip galvanized")) return "hot dip galvanized";
	if (value.includes("hdg")) return "hot dip galvanized";
	if (value.includes("yellow zinc")) return "yellow zinc";
	if (value.includes("zinc yellow")) return "yellow zinc";
	if (value.includes("black oxide")) return "black oxide";
	if (value.includes("phosphate")) return "phosphate";
	if (/\bgalv\b/i.test(rawText)) return "galvanized";
	if (/\bcad(?:mium)?(?:-|\s)?plated\b/i.test(rawText)) return "cad plated";
	if (/\bzp\b/i.test(rawText)) return "zinc";
	if (value.includes("galvanized")) return "galvanized";
	if (value.includes("chrome")) return "chrome";
	if (value.includes("zinc")) return "zinc";

	if (mat === "stainless steel") return "";
	if (mat === "aluminum") return "";
	if (mat === "brass") return "";
	if (mat === "nylon") return "";
	if (mat === "silicon bronze") return "";

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
	const rawText = String(text || "");
	const mat = clean(material).toLowerCase();
	const system = clean(measurementSystem).toLowerCase();
	const value = normalize(rawText);

	if (mat === "stainless steel") {
		const stainlessGrade = detectStainlessGradeFromText(rawText);
		return stainlessGrade || explicit || "304";
	}

	if (explicit) return explicit;

	if (
		mat === "nylon" ||
		mat === "aluminum" ||
		mat === "brass" ||
		mat === "silicon bronze"
	) {
		return "";
	}

	if (system === "metric") {
		if (/\b12\.9\b/i.test(rawText)) return "12.9";
		if (/\b10\.9\b/i.test(rawText)) return "10.9";
		if (/\b8\.8\b/i.test(rawText)) return "8.8";
		return "8.8";
	}

	if (/\ba325\b/i.test(rawText)) return "A325";
	if (/\bg36\b/i.test(rawText)) return "grade 8";
	if (/\ba307\b/i.test(rawText)) return "A307";

	const decodedGrade = clean(decoded?.grade || detectGrade(text) || "");
	if (decodedGrade) return decodedGrade;

	const looksSteelHexBolt =
		value.includes("hex bolt") ||
		value.includes("hex head bolt") ||
		value.includes("heavy hex bolt") ||
		value.includes("structural bolt") ||
		value.includes("hex hd c/s") ||
		value.includes("hx hd c/s") ||
		looksLikeHexCapShorthand(text);

	if (looksSteelHexBolt) {
		if (value.includes("galv")) return "grade 2";
		if (value.includes("galvanized")) return "grade 2";
		if (value.includes("chrome")) return "grade 5";
		if (value.includes("plain")) return "grade 2";
	}

	return "";
}

function detectBoltLikeFamily(text = "", parsed = {}, product = null) {
	const value = normalize(text);
	const decoded = decodeHexCapPartNumber(product, parsed);
	const partNum = getPartNumberText(product, parsed).toUpperCase();

	const socketLike = looksLikeSocketHead(text);
	const squareLike = looksLikeSquareHead(text);
	const flatLike = looksLikeFlatHead(text);

	const isAssemblyLike =
		value.includes("assy") ||
		value.includes("assembly") ||
		value.includes("bolt assy") ||
		value.includes("bolt assembly") ||
		value.includes("kit") ||
		value.includes("assortment") ||
		value.includes("auto assortment") ||
		value.includes(" w/") ||
		value.includes(" with ") ||
		/\(\d+\)\s*\d/i.test(text);

	const isToolingLike =
		value.includes("combo drill") ||
		value.includes("countersink");

	const isExcludedBA =
		/^BA/i.test(partNum) || /\bBA\d/i.test(partNum);
	const isExcludedFT = /^SSCSFT/i.test(partNum);

	const isNonHexHeadLike =
		socketLike ||
		squareLike ||
		flatLike ||
		value.includes("button hd") ||
		value.includes("button head");

	if (isAssemblyLike || isToolingLike || isExcludedBA || isExcludedFT || isNonHexHeadLike) {
		return null;
	}

	const looksLikeEncodedHexCap =
		partNum.startsWith("MMCS") ||
		/^(?:SS|HH|SB|AN|AL|BR)?CS\d/i.test(partNum) ||
		isStainlessHexCapCandidate(text, partNum);

	const shorthand = detectImperialShorthandCapScrew(text);
	const structural = detectStructuralBoltDescription(text);
	const compactMetric = detectCompactMetricCapScrew(text, product);
	const stainlessOneInch = detectStainlessOneInchCapScrew(text, product);
	const looseStainlessHexThread = decodeLooseStainlessHexCapThreadFromText(text, partNum);
	const roundStock = detectRoundStockA307(text);

	const isHexCap =
		!isNonHexHeadLike &&
		(
			value.includes("hex cap screw") ||
			value.includes("hex head bolt") ||
			value.includes("hex bolt") ||
			looksLikeHexCapShorthand(text) ||
			shorthand?.familyType === "hex cap screw" ||
			decoded?.familyType === "hex cap screw" ||
			looksLikeEncodedHexCap
		);

	const isHeavyHex =
		!isNonHexHeadLike &&
		(
			value.includes("heavy hex bolt") ||
			value.includes("a307") ||
			shorthand?.familyType === "heavy hex bolt"
		);

	const isStructural =
		!isNonHexHeadLike &&
		(
			value.includes("structural bolt") ||
			value.includes("a325") ||
			structural?.familyType === "structural bolt" ||
			shorthand?.familyType === "structural bolt"
		);

	const isCarriage = value.includes("carriage bolt");
	const isLag = value.includes("lag bolt") || value.includes("lag screw");

	if (!isHexCap && !isHeavyHex && !isStructural && !isCarriage && !isLag) {
		return null;
	}

	const dims = detectGenericDimensions(text);
	const threadedSize = detectImperialThreadedSize(text);
	const imperialThreadedDescription = detectImperialThreadedDescription(text);
	const metricThreadedSize = looksImperialByStandard(text)
		? null
		: detectMetricThreadedSize(text);

	let familyType = "fastener";
	let subcategory = "fasteners";

	if (isStructural) {
		familyType = "structural bolt";
		subcategory = "hex cap screws";
	} else if (isHeavyHex) {
		familyType = "heavy hex bolt";
		subcategory = "hex cap screws";
	} else if (isHexCap) {
		familyType = "hex cap screw";
		subcategory = "hex cap screws";
	} else if (isCarriage) {
		familyType = "carriage bolt";
		subcategory = "carriage bolts";
	} else if (isLag) {
		familyType = "lag screw";
		subcategory = "lag screws";
	}

	const forceMetric =
		partNum.startsWith("MM") ||
		/^M\d/i.test(clean(parsed.size || "")) ||
		/^M\d/i.test(clean(compactMetric?.diameter || "")) ||
		/^M\d/i.test(clean(metricThreadedSize?.diameter || "")) ||
		/^M\d/i.test(clean(decoded?.diameter || ""));

	const measurementSystem =
		(forceMetric ? "metric" : "") ||
		(/^M\d/i.test(clean(parsed.diameter || "")) ? "metric" : "") ||
		parsed.measurementSystem ||
		compactMetric?.measurementSystem ||
		stainlessOneInch?.measurementSystem ||
		looseStainlessHexThread?.measurementSystem ||
		roundStock?.measurementSystem ||
		structural?.measurementSystem ||
		shorthand?.measurementSystem ||
		(/^M\d/i.test(clean(parsed.diameter || "")) ? "metric" : "") ||
		(/^M\d/i.test(clean(metricThreadedSize?.diameter || "")) ? "metric" : "") ||
		(/^M\d/i.test(clean(decoded?.diameter || "")) ? "metric" : "") ||
		(looksImperialByStandard(text) ? "imperial" : "") ||
		metricThreadedSize?.measurementSystem ||
		decoded?.measurementSystem ||
		detectMeasurementSystem(text);

	const decodedDiameter = clean(decoded?.diameter || "");
	const decodedPitch = clean(decoded?.threadPitch || "");
	const decodedLength = clean(decoded?.length || "");

	const structuralDiameter = clean(structural?.diameter || "");
	const structuralPitch = clean(structural?.threadPitch || "");
	const structuralLength = clean(structural?.length || "");

	const shorthandDiameter = clean(shorthand?.diameter || "");
	const shorthandPitch = clean(shorthand?.threadPitch || "");
	const shorthandLength = clean(shorthand?.length || "");

	const imperialTextDiameter = clean(imperialThreadedDescription?.diameter || "");
	const imperialTextPitch = clean(imperialThreadedDescription?.threadPitch || "");
	const imperialTextLength = clean(imperialThreadedDescription?.length || "");

	const metricDiameter = clean(metricThreadedSize?.diameter || "");
	const metricPitch = clean(metricThreadedSize?.threadPitch || "");
	const metricLength = clean(metricThreadedSize?.length || "");

	const looseStainlessDiameter = clean(looseStainlessHexThread?.diameter || "");
	const looseStainlessPitch = clean(looseStainlessHexThread?.threadPitch || "");
	const looseStainlessSeries = clean(looseStainlessHexThread?.threadSeries || "");
	const looseStainlessLength = clean(looseStainlessHexThread?.length || "");

	const genericDiameter = clean(dims.diameter || "");
	const genericPitch = clean(dims.threadPitch || "");
	const genericLength = clean(dims.length || "");

	const diameter =
		clean(parsed.diameter || "") ||
		clean(compactMetric?.diameter || "") ||
		clean(stainlessOneInch?.diameter || "") ||
		looseStainlessDiameter ||
		clean(roundStock?.diameter || "") ||
		structuralDiameter ||
		decodedDiameter ||
		shorthandDiameter ||
		(forceMetric ? metricDiameter : "") ||
		imperialTextDiameter ||
		metricDiameter ||
		clean(threadedSize?.diameter || "") ||
		genericDiameter ||
		"";

	let threadPitch =
		clean(parsed.threadPitch || "") ||
		clean(compactMetric?.threadPitch || "") ||
		clean(stainlessOneInch?.threadPitch || "") ||
		looseStainlessPitch ||
		clean(roundStock?.threadPitch || "") ||
		structuralPitch ||
		decodedPitch ||
		shorthandPitch ||
		(forceMetric ? metricPitch : "") ||
		((/\bDOM\b|\bDOMESTIC\b/i.test(text) && decodedPitch) ? "" : imperialTextPitch) ||
		metricPitch ||
		clean(threadedSize?.threadPitch || "") ||
		genericPitch ||
		"";

	const length =
		clean(parsed.length || "") ||
		clean(compactMetric?.length || "") ||
		clean(stainlessOneInch?.length || "") ||
		looseStainlessLength ||
		clean(roundStock?.length || "") ||
		structuralLength ||
		decodedLength ||
		shorthandLength ||
		(forceMetric ? metricLength : "") ||
		imperialTextLength ||
		metricLength ||
		clean(threadedSize?.length || "") ||
		genericLength ||
		"";

	if (
		!threadPitch &&
		clean(measurementSystem).toLowerCase() !== "metric" &&
		diameter &&
		(
			normalize(text).includes("c/s") ||
			normalize(text).includes("hex bolt") ||
			normalize(text).includes("heavy hex bolt") ||
			normalize(text).includes("structural bolt")
		)
	) {
		threadPitch = inferImperialCoarsePitchFromDiameter(diameter);
	}

	const threadSeries =
		clean(parsed.threadSeries || parsed.thread_series || "") ||
		clean(structural?.threadSeries || "") ||
		looseStainlessSeries ||
		clean(decoded?.threadSeries || "") ||
		clean(shorthand?.threadSeries || "") ||
		(
			clean(measurementSystem).toLowerCase() === "imperial"
				? inferImperialSeriesFromPitch(diameter, threadPitch)
				: ""
		);

	const stainlessMaterialOverride =
		isImperialStainlessHexCapPartNumber(partNum) ||
		textHasImperialStainlessHexCapPartNumber(text) ||
		metricHexDescriptionEndsWithStainless(text, partNum) ||
		detectMaterial(text) === "stainless steel";

	const boltMaterial = stainlessMaterialOverride
		? "stainless steel"
		: clean(parsed.material || "") ||
			clean(compactMetric?.material || "") ||
			clean(stainlessOneInch?.material || "") ||
			clean(roundStock?.material || "") ||
			clean(structural?.material || "") ||
			clean(shorthand?.material || "") ||
			detectBoltMaterial(text, product, parsed, decoded);

	const boltFinish = stainlessMaterialOverride
		? ""
		: clean(parsed.finish || "") ||
			clean(compactMetric?.finish || "") ||
			clean(stainlessOneInch?.finish || "") ||
			clean(roundStock?.finish || "") ||
			clean(structural?.finish || "") ||
			clean(shorthand?.finish || "") ||
			detectBoltFinish(text, product, parsed, boltMaterial, decoded);

	const grade = stainlessMaterialOverride
		? detectBoltGrade(text, measurementSystem, boltMaterial, parsed, decoded)
		: clean(parsed.grade || "") ||
			clean(compactMetric?.grade || "") ||
			clean(stainlessOneInch?.grade || "") ||
			clean(roundStock?.grade || "") ||
			clean(structural?.grade || "") ||
			clean(shorthand?.grade || "") ||
			detectBoltGrade(text, measurementSystem, boltMaterial, parsed, decoded);

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
		fastenerType:
			familyType === "structural bolt" || familyType === "heavy hex bolt"
				? "hex cap screw"
				: familyType,
		headType,
		driveType,
		size:
			clean(parsed.size || "") ||
			clean(imperialThreadedDescription?.size || "") ||
			clean(metricThreadedSize?.size || "") ||
			clean(threadedSize?.size || "") ||
			"",
		diameter,
		length,
		threadPitch,
		threadSeries,
		threadCoverage:
			clean(parsed.threadCoverage || parsed.thread_coverage || "") ||
			clean(stainlessOneInch?.threadCoverage || "") ||
			clean(decoded?.threadCoverage || ""),
		measurementSystem:
			partNum.startsWith("MM") || /^M\d/i.test(clean(diameter || ""))
				? "metric"
				: measurementSystem,
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
	if (
		!value.includes("abrasive") &&
		!value.includes("cutoff wheel") &&
		!value.includes("grinding wheel") &&
		!value.includes("flap disc")
	) {
		return null;
	}

	return {
		familyType: "abrasive accessory",
		category: "abrasives",
		subcategory: "abrasive accessories",
		fastenerType: "",
		size: parsed.size || "",
		diameter: parsed.diameter || "",
		length: parsed.length || "",
		threadPitch: "",
		measurementSystem: parsed.measurementSystem || detectMeasurementSystem(text),
		material: parsed.material || detectMaterial(text),
		finish: parsed.finish || detectFinish(text),
		grade: parsed.grade || "",
	};
}

function detectAuvecoFamily(text = "", parsed = {}, product = null) {
	const value = normalize(text);
	const vendor = clean(product?.vendor || parsed.vendor || "");
	const brand = clean(product?.brand || parsed.brand || "");

	if (
		!value.includes("auveco") &&
		normalize(vendor) !== "auveco" &&
		normalize(brand) !== "auveco"
	) {
		return null;
	}

	return {
		familyType: "auveco hardware",
		category: "specialty hardware",
		subcategory: "auveco hardware",
		fastenerType: "",
		size: parsed.size || "",
		diameter: parsed.diameter || "",
		length: parsed.length || "",
		threadPitch: parsed.threadPitch || "",
		measurementSystem: parsed.measurementSystem || detectMeasurementSystem(text),
		material: parsed.material || detectMaterial(text),
		finish: parsed.finish || detectFinish(text),
		grade: parsed.grade || "",
		vendor,
		brand,
	};
}

function detectFallbackFamily(text = "", parsed = {}, product = null) {
	return {
		familyType: "general hardware",
		category: parsed.category || "uncategorized",
		subcategory: parsed.subcategory || "needs classification",
		fastenerType: parsed.fastenerType || "",
		size: parsed.size || detectGenericDimensions(text).size || "",
		diameter: parsed.diameter || detectGenericDimensions(text).diameter || "",
		length: parsed.length || detectGenericDimensions(text).length || "",
		threadPitch:
			parsed.threadPitch || detectGenericDimensions(text).threadPitch || "",
		measurementSystem:
			parsed.measurementSystem || detectMeasurementSystem(text),
		material: parsed.material || detectMaterial(text),
		finish: parsed.finish || detectFinish(text),
		grade: parsed.grade || detectGrade(text) || "",
		vendor: product?.vendor || parsed.vendor || "",
		brand: product?.brand || parsed.brand || "",
	};
}

function buildFamilyIdentity(detected = {}) {
	const category = clean(detected.category || "");
	const subcategory = clean(detected.subcategory || "");
	const familyType = clean(detected.familyType || detected.fastenerType || "");
	const finish = clean(detected.finish || "");
	const grade = clean(detected.grade || "");
	const material = clean(detected.material || "");
	const measurementSystem = clean(detected.measurementSystem || "");
	const washerStandard = clean(detected.washerStandard || "");
	const washerType = clean(detected.washerType || "");
	const diameter = clean(detected.diameter || "");
	const width = clean(detected.width || "");
	const vendor = clean(detected.vendor || "");
	const brand = clean(detected.brand || "");

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
		familyType.includes("heavy hex bolt") ||
		familyType.includes("structural bolt") ||
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
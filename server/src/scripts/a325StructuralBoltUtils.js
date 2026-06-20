const VALID_IMAGE_STATUSES = new Set(["none", "matched", "partial", "needs-cleanup", "approved"]);
const VALID_IMAGE_SOURCES = new Set(["vendor", "manual", "generated", "website", "unknown"]);

export function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalize(value = "") {
	return clean(value).toLowerCase();
}

export function slugify(value = "") {
	return clean(value)
		.toLowerCase()
		.replace(/["']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function asObject(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function sanitizeImageEnums(enrichment) {
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
		enrichment.markModified?.("images");
	}
}

export function fractionFromSixteenthsCode(code = "") {
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

export function imperialDiameterFromCode(code = "") {
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
		"26": "1-3/4",
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

	return map[String(code || "").trim().toUpperCase()] || "";
}

export const COARSE_PITCH = {
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
	"1-3/4": "5",
	"2": "4.5",
};

const A325_DIAMETER_CODES = [
	"010", "011", "040", "050", "060", "070", "080", "090", "100", "120", "140", "160", "180", "200", "220", "240", "260",
	"04", "05", "06", "07", "08", "09", "10", "12", "14", "16", "18", "20", "22", "24", "26",
];

export const A325_SUFFIX_PATTERN = "GALVANIZED|GALV|HDG|HOT\\s*DIP|PLAIN|PL|ZINC|ZN|G|P|Z";
export const A325_DOMESTIC_PATTERN = "DOMESTIC|DOM|D";

// Real Fishbowl examples include both a trailing domestic code and a spaced DOM flag:
//   A325SB120908D
//   A325SB120908 DOM
//   A325SB120908G DOM
// Finish still defaults to plain unless a finish suffix/description explicitly says galvanized/zinc/etc.
export const A325_SEARCH_REGEX = new RegExp(
	`(?:^|[^A-Z0-9])A325\\s*SB\\s*[0-9]{5,7}(?:\\s*[-_/]?\\s*(?:${A325_SUFFIX_PATTERN}))?(?:\\s*[-_/]?\\s*(?:${A325_DOMESTIC_PATTERN}))?(?=[^A-Z0-9]|$)`,
	"i",
);
export const A325_DECODE_REGEX = new RegExp(
	`(?:^|[^A-Z0-9])A325\\s*SB\\s*([0-9]{5,7})(?:\\s*[-_/]?\\s*(${A325_SUFFIX_PATTERN}))?(?:\\s*[-_/]?\\s*(${A325_DOMESTIC_PATTERN}))?(?=[^A-Z0-9]|$)`,
	"i",
);

export function normalizeA325Suffix(value = "") {
	const suffix = clean(value).toUpperCase();
	if (["G", "GALV", "GALVANIZED", "HDG"].includes(suffix)) return "G";
	if (["P", "PL", "PLAIN"].includes(suffix)) return "P";
	if (["Z", "ZN", "ZINC"].includes(suffix)) return "Z";
	return "";
}

export function isGalvanizedText(value = "") {
	return /\b(?:G|GALV|GALVANIZED|HDG|HOT\s*DIP)\b/i.test(String(value || ""));
}

export function isPlainText(value = "") {
	return /\b(?:P|PL|PLAIN)\b/i.test(String(value || ""));
}

export function isDomesticText(value = "") {
	const raw = String(value || "");
	return (
		/\bDOM(?:ESTIC)?\b/i.test(raw) ||
		/\bMADE\s+IN\s+USA\b/i.test(raw) ||
		/\bUSA\b/i.test(raw) ||
		/\bA325\s*SB\s*[0-9]{5,7}D\b/i.test(raw)
	);
}

export function normalizeA325Domestic(value = "") {
	const domestic = clean(value).toUpperCase();
	if (["D", "DOM", "DOMESTIC"].includes(domestic)) return "domestic";
	return "";
}

export function finishFromA325({ suffix = "", sourceText = "" } = {}) {
	const normalizedSuffix = normalizeA325Suffix(suffix);
	if (normalizedSuffix === "G") return "galvanized";
	if (normalizedSuffix === "P") return "plain";
	if (normalizedSuffix === "Z") return "zinc";
	if (isGalvanizedText(sourceText)) return "galvanized";
	if (isPlainText(sourceText)) return "plain";
	return "plain";
}

export function decodeA325StructuralBolt(value = "") {
	const sourceText = String(value || "").toUpperCase();
	const match = sourceText.match(A325_DECODE_REGEX);
	if (!match) return null;

	const digits = match[1] || "";
	const suffix = normalizeA325Suffix(match[2] || "");
	const domesticFlag = normalizeA325Domestic(match[3] || "");
	const candidates = [];

	for (const diaCode of A325_DIAMETER_CODES) {
		if (!digits.startsWith(diaCode)) continue;
		const rawLenCode = digits.slice(diaCode.length);
		if (![3, 4].includes(rawLenCode.length)) continue;

		const diameter = imperialDiameterFromCode(diaCode);
		if (!diameter) continue;

		const lenCode = rawLenCode.length === 3 ? `0${rawLenCode}` : rawLenCode;
		const length = fractionFromSixteenthsCode(lenCode);
		if (!length) continue;

		candidates.push({
			diaCode,
			rawLenCode,
			lenCode,
			diameter,
			length,
			wasMissingLengthLeadingZero: rawLenCode.length === 3,
		});
	}

	if (!candidates.length) return null;

	const best = candidates.sort((a, b) => {
		if (a.rawLenCode.length !== b.rawLenCode.length) return b.rawLenCode.length - a.rawLenCode.length;
		return b.diaCode.length - a.diaCode.length;
	})[0];

	const finish = finishFromA325({ suffix, sourceText });
	const origin = domesticFlag === "domestic" || isDomesticText(sourceText) ? "domestic" : "standard";

	return {
		familyType: "structural bolt",
		measurementSystem: "imperial",
		diameter: best.diameter,
		length: best.length,
		threadPitch: COARSE_PITCH[best.diameter] || "",
		threadSeries: COARSE_PITCH[best.diameter] ? "coarse" : "",
		threadCoverage: "partial",
		grade: "A325",
		material: "steel",
		finish,
		displayMaterial: "steel",
		displayFinish: finish,
		materialFinish: finish ? `steel / ${finish}` : "steel",
		origin,
		wasMissingLengthLeadingZero: best.wasMissingLengthLeadingZero,
		rawA325Digits: digits,
		diaCode: best.diaCode,
		lenCode: best.lenCode,
		suffix,
	};
}

export function decodeA325Product(product = {}) {
	const source = [
		product?.fishbowl?.partNum || "",
		product?.sku || "",
		product?.internalPartNumber || "",
		product?.fishbowl?.description || "",
	]
		.filter(Boolean)
		.join(" ");

	return decodeA325StructuralBolt(source);
}

export function titleCase(value = "") {
	return clean(value).replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildA325Title(decoded = {}, partNumber = "") {
	const finishLabel = titleCase(decoded.finish || "");
	const originLabel = decoded.origin === "domestic" ? "Domestic" : "";
	return clean(
		`A325 Structural Bolt - ${decoded.diameter}-${decoded.threadPitch} x ${decoded.length}${finishLabel ? ` - ${finishLabel}` : ""}${originLabel ? ` - ${originLabel}` : ""}${partNumber ? ` (${partNumber})` : ""}`,
	);
}

export function buildA325FamilyKey(decoded = {}) {
	return [
		"bolts",
		"hex cap screws",
		"structural bolt",
		decoded.finish || "plain",
		"A325",
		"steel",
		"imperial",
	]
		.filter(Boolean)
		.map(normalize)
		.join("|");
}

export function buildA325FamilyTitle(decoded = {}) {
	const finishLabel = titleCase(decoded.finish || "plain");
	return clean(`A325 Steel / ${finishLabel} Structural Bolt`);
}

export function buildA325NextAttributes({ product = {}, enrichment = {}, decoded = {} } = {}) {
	const attrs = { ...(enrichment?.attributes?.toObject?.() || enrichment?.attributes || {}) };
	const familyTitle = buildA325FamilyTitle(decoded);
	const familyKey = buildA325FamilyKey(decoded);

	return {
		...attrs,
		categoryCanonical: "bolts",
		subcategoryCanonical: "hex cap screws",
		familyType: "structural bolt",
		fastenerType: "structural bolt",
		fastenerTypeCanonical: "structural bolt",
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
		origin: decoded.origin,
		domestic: decoded.origin === "domestic" ? "domestic" : "standard",
		material: decoded.material,
		finish: decoded.finish,
		displayMaterial: decoded.displayMaterial,
		displayFinish: decoded.displayFinish,
		materialFinish: decoded.materialFinish,
		grade: decoded.grade,
		familyKey,
		familySlug: slugify(familyTitle),
		familyTitle,
		familyTitleBase: familyTitle,
		fishbowlPartNum: product?.fishbowl?.partNum || "",
		fishbowlDescription: clean(product?.fishbowl?.description || ""),
		sku: product?.sku || "",
		internalPartNumber: product?.internalPartNumber || "",
		a325StructuralAudit: {
			rawA325Digits: decoded.rawA325Digits,
			diaCode: decoded.diaCode,
			lenCode: decoded.lenCode,
			suffix: decoded.suffix,
			origin: decoded.origin,
			wasMissingLengthLeadingZero: !!decoded.wasMissingLengthLeadingZero,
			lastBackfilledAt: new Date(),
		},
	};
}

export function hasCorrectA325Attributes(enrichment = {}, decoded = {}) {
	const attrs = enrichment?.attributes || {};
	return (
		normalize(enrichment.category) === "bolts" &&
		normalize(enrichment.subcategory) === "hex cap screws" &&
		normalize(attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType) === "structural bolt" &&
		clean(attrs.grade) === "A325" &&
		normalize(attrs.material) === "steel" &&
		normalize(attrs.finish) === normalize(decoded.finish) &&
		normalize(attrs.materialFinish) === normalize(decoded.materialFinish) &&
		clean(attrs.diameter) === clean(decoded.diameter) &&
		clean(attrs.length) === clean(decoded.length) &&
		clean(attrs.threadPitch) === clean(decoded.threadPitch) &&
		normalize(attrs.threadSeries || attrs.thread_series) === normalize(decoded.threadSeries) &&
		normalize(attrs.origin || attrs.domestic) === normalize(decoded.origin)
	);
}

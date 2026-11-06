// Display-only inch marks for size values on builder and grid pages: 6 -> 6", 1-1/2 -> 1-1/2", .045 -> .045".
// The stored value never changes; selections and filters still match on the raw value.
//
// Rules:
// - Only inch-measure keys get the mark (length, diameter, width, thickness, bore, size, ...). Thread pitch, TPI,
//   gauge, wire gauge, grit, grade, counts and text never do.
// - Nothing on metric rows (system "metric"), and nothing on a value that already carries a unit or any letters
//   (6', 3 ft, 20mm, M6, 1/2", Large).
// - Fractions (1/4, 1-1/2) are always inches. A bare whole number or decimal is inches unless the product titles
//   show it as something else (#10, 500', 12mm). Inside a multi-part size (12 x 14) a whole number gets the mark
//   only when it is clearly inches: a title shows it with a mark, or another part of the value is a fraction.
// - system "mixed" (the rows that carry this value are both metric and inch, e.g. length 6 on a page with 6" and
//   6mm screws): a lone number reads 6" / 6mm, so neither buyer is misled. Fractions are inches as usual.
// - system "unknown" (a filter list over metric and inch rows, no per-value rows): only fractions get the mark.

const INCH_MEASURE_KEYS = new Set([
	"length",
	"overalllength",
	"diameter",
	"width",
	"thickness",
	"height",
	"depth",
	"bore",
	"boresize",
	"borediameter",
	"size",
	"insidediameter",
	"outsidediameter",
	"studsize",
	"threadsize",
	"arbor",
	"arborsize",
	"shanksize",
	"shankdiameter",
	"pindiameter",
	"knucklediameter",
	"drillbitsize",
]);

export function isInchMeasureKey(key = "") {
	return INCH_MEASURE_KEYS.has(String(key || "").toLowerCase());
}

function normalizeSystem(system = "") {
	const lower = String(system || "").trim().toLowerCase();
	if (lower === "mixed") return "mixed";
	if (lower === "unknown") return "unknown";
	if (lower.includes("metric")) return "metric";
	return "inch";
}

const FRACTION_RE = /^(\d+)\/(\d+)$/;
const MIXED_RE = /^(\d+)[-\s](\d+)\/(\d+)$/;
const DECIMAL_RE = /^\d*\.\d+$/;
const WHOLE_RE = /^[1-9]\d{0,3}$/; // 1..9999; "0", "035" and stray item numbers stay bare
const THREAD_RE = /^(\d+\/\d+|\d+-\d+\/\d+|\d*\.\d+)-(\d+)$/; // 5/8-11 -> 5/8"-11

function isFraction(part) {
	const fraction = part.match(FRACTION_RE);
	if (fraction) return Number(fraction[1]) > 0 && Number(fraction[2]) > 0; // chain trade sizes 1/0, 2/0 are not inches
	const mixed = part.match(MIXED_RE);
	return Boolean(mixed) && Number(mixed[3]) > 0;
}

function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// How the product titles write this number: "inch" (6"), "other" (#10, 500', 12mm, 10-24) or "none".
export function titleEvidence(number = "", titles = []) {
	if (!Array.isArray(titles) || !titles.length) return "none";
	const n = escapeRegExp(String(number));
	const inchRe = new RegExp(`(?<![\\d/.#-])${n}(?:\\s?["”″]|\\s?in\\b|\\s?-?inch)`, "i");
	const otherRe = new RegExp(
		`#${n}(?![\\d./])` +
			`|(?<![\\d/.])${n}\\s?(?:'|’|ft\\b|feet\\b|foot\\b|yds?\\b|yards?\\b|mm\\b|cm\\b|m\\b|awg\\b|ga\\b|gauge\\b|grit\\b|tpi\\b|t\\b|tooth|teeth|lbs?\\b|pcs?\\b|pk\\b|pack\\b|count\\b|v\\b)` +
			`|\\d-${n}(?![\\d/.])` +
			`|(?<![\\d/.#"-])${n}-\\d+(?![\\d/])`,
		"i",
	);
	let other = false;
	for (const title of titles) {
		const text = String(title || "");
		if (inchRe.test(text)) return "inch";
		if (otherRe.test(text)) other = true;
	}
	return other ? "other" : "none";
}

/**
 * formatBuilderValue(key, value, system, options)
 * key: attribute key (length, diameter, ...). value: the stored value. system: the row's measurement system
 * ("imperial", "Standard", "metric", "Metric", "mixed" or ""). options.titles: product titles that use this value,
 * read as evidence for bare numbers. Returns the display string; never changes the stored value.
 */
// Shop words for stored values: an uninsulated terminal is sold as "Bare".
const VALUE_LABELS = { insulation: { "non-insulated": "Bare" } };

export function formatBuilderValue(key = "", value = "", system = "", options = {}) {
	if (value === undefined || value === null) return "";
	const raw = String(value).trim();
	const shopWord = VALUE_LABELS[key]?.[raw.toLowerCase()];
	if (shopWord) return shopWord;
	if (!raw || !isInchMeasureKey(key)) return String(value);

	const mode = normalizeSystem(system);
	if (mode === "metric") return String(value);

	// Already carries a unit or is text: a quote/prime mark, or any letter other than an "x" between sizes.
	if (/["'”″’]/.test(raw)) return String(value);
	const withoutSeparators = raw.replace(/(?<=[\d\s])[x×](?=[\s\d.#])/gi, " ");
	if (/[a-z]/i.test(withoutSeparators)) return String(value);

	const titles = Array.isArray(options?.titles) ? options.titles : [];
	const pieces = raw.split(/(\s*[x×]\s*)/i);
	const parts = pieces.filter((_, index) => index % 2 === 0).map((part) => part.trim());
	const multiPart = parts.length > 1;
	const hasFractionPart = parts.some((part) => isFraction(part) || DECIMAL_RE.test(part) || THREAD_RE.test(part));

	const markPart = (part) => {
		if (!part || part.startsWith("#")) return part;
		if (isFraction(part)) return `${part}"`;

		const thread = part.match(THREAD_RE);
		if (thread) {
			if ((mode === "mixed" || mode === "unknown") && !isFraction(thread[1])) return part;
			return `${thread[1]}"-${thread[2]}`;
		}

		const isWhole = WHOLE_RE.test(part);
		const isDecimal = DECIMAL_RE.test(part);
		if (!isWhole && !isDecimal) return part;
		if (mode === "unknown") return part;
		if (mode === "mixed") return multiPart ? part : `${part}" / ${part}mm`;

		const evidence = titleEvidence(part, titles);
		if (evidence === "inch") return `${part}"`;
		if (evidence === "other") return part;
		if (isDecimal) return `${part}"`;
		// A bare whole number: inches on its own; inside a multi-part size only next to a fraction.
		if (!multiPart || hasFractionPart) return `${part}"`;
		return part;
	};

	return pieces.map((piece, index) => (index % 2 === 0 ? piece.replace(piece.trim(), markPart(piece.trim())) : piece)).join("");
}

// The measurement system a value belongs to, from the rows that carry it: "metric", "imperial" or "mixed".
export function systemForRows(systems = []) {
	let metric = false;
	let inch = false;
	for (const system of systems) {
		if (/metric/i.test(String(system || ""))) metric = true;
		else inch = true;
	}
	if (metric && inch) return "mixed";
	return metric ? "metric" : "imperial";
}

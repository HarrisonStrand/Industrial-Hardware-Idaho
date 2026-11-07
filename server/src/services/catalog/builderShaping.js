// General "pick your size" builder shaping.
//
// The hand-tuned pages (hex cap screws, hex nuts, washers, flange and hanger bolts, machine and sheet metal
// screws, threaded rod) keep their own shapes in getCatalogBuilderSubcategory.js. Every other builder page
// uses the general shaping here: its choices are the page's own filters from categories.json, or a default
// set in buyer order, never an internal key, and two different products never fold into one variant.
//
// Pure functions only (no database), so the tests can run them directly.

export const NUMBERED_DIAMETER_SIZES = new Set(["0", "2", "3", "4", "5", "6", "8", "10", "12"]);

// Subcategory names (lowercase, spaces) that have a hand-tuned shape. Their output must not change.
export const HAND_TUNED_BUILDER_SUBCATEGORIES = new Set([
	"flat washers",
	"fender washers",
	"lock washers",
	"hex cap screws",
	"hex nuts",
	"flange bolts",
	"hanger bolts",
	"hanger bolt drivers",
	"machine screws",
	"sheet metal screws",
	"threaded rod",
	"threaded rods",
]);

export function isHandTunedBuilderPage(subcategoryId = "") {
	const sub = String(subcategoryId || "").trim().toLowerCase().replace(/-/g, " ");
	return HAND_TUNED_BUILDER_SUBCATEGORIES.has(sub);
}

// General shaping applies to every builder page except the hand-tuned ones.
export function usesGeneralBuilderShaping(subcategoryId = "", preview = false) {
	return !isHandTunedBuilderPage(subcategoryId);
}

// The product type key: the first of these present on the page, offered only when it has more than one value.
export const TYPE_KEYS = [
	"productType",
	"familyType",
	"hardwareType",
	"toolType",
	"terminalType",
	"anchorType",
	"ringType",
	"collarType",
	"ppeType",
];

// Size keys in buyer order. "diameter" and "threadSize" are alternatives: diameter wins when both are present.
export const SIZE_KEYS = [
	"diameter",
	"threadPitch",
	"length",
	"size",
	"width",
	"wireGauge",
	"studSize",
	"clampRange",
	"bore",
	"grit",
	"tpi",
	"rollLength",
];

// Readable names for the client. A page filter's own label (categories.json) wins over these.
export const BUILDER_CHOICE_LABELS = {
	productType: "Type",
	familyType: "Type",
	hardwareType: "Type",
	toolType: "Type",
	terminalType: "Terminal Type",
	anchorType: "Anchor Type",
	ringType: "Ring Type",
	collarType: "Collar Type",
	ppeType: "Type",
	measurementSystem: "Measurement System",
	diameter: "Diameter",
	threadSize: "Thread Size",
	threadPitch: "Thread",
	threadSeries: "Thread Series",
	length: "Length",
	size: "Size",
	width: "Width",
	thickness: "Thickness",
	wireGauge: "Wire Gauge",
	studSize: "Stud Size",
	clampRange: "Clamp Range",
	bore: "Bore",
	grit: "Grit",
	tpi: "Teeth per Inch",
	teethPerInch: "Teeth per Inch",
	rollLength: "Roll Length",
	materialFinish: "Material / Finish",
	material: "Material",
	finish: "Finish",
	grade: "Grade",
	color: "Color",
	gender: "Gender",
	packageQuantity: "Package Quantity",
	arborSize: "Arbor Size",
};

// Keys whose values sort by size (fractions, mm, numbered sizes) instead of alphabetically. Lowercase.
const SIZE_SORT_KEYS = new Set([
	"diameter",
	"threadsize",
	"threadpitch",
	"length",
	"size",
	"width",
	"thickness",
	"wiregauge",
	"studsize",
	"clamprange",
	"bore",
	"grit",
	"tpi",
	"teethperinch",
	"rolllength",
	"bandwidth",
	"arborsize",
	"packagequantity",
	"toothcount",
	"voltage",
	"batterycapacity",
]);

// Bookkeeping keys a shopper never picks from.
const INTERNAL_KEYS = new Set([
	"sku",
	"internalPartNumber",
	"partNumber",
	"partId",
	"productId",
	"enrichmentId",
	"slug",
	"seoSlug",
	"upc",
	"mcn",
	"mfrPartNumber",
	"displayMaterial",
	"displayFinish",
]);

export function isInternalBuilderKey(key = "") {
	const text = String(key || "");
	if (!text) return true;
	if (INTERNAL_KEYS.has(text)) return true;
	if (/^fishbowl/i.test(text)) return true;
	// family* is bookkeeping (familyKey, familySlug, familyTitle, ...), except familyType, which names the product type.
	if (/^family/i.test(text) && text !== "familyType") return true;
	if (/canonical$/i.test(text)) return true;
	if (/^fastener_?type/i.test(text)) return true;
	if (/(^|_)slug$|Slug$/.test(text)) return true;
	if (/^(source|provenance|sourceHash)/i.test(text)) return true;
	return false;
}

function isBlank(value) {
	return value === undefined || value === null || value === "" || typeof value === "object";
}

export function parseBuilderSizeSort(value = "", key = "") {
	const lowerKey = String(key || "").toLowerCase();
	let str = String(value || "")
		.trim()
		.replace(/[”″]/g, '"')
		.replace(/"|in\.?$/gi, "")
		.replace(/mm$/i, "")
		.trim();

	if (!str) return null;

	const metricMatch = str.match(/^m(\d+(?:\.\d+)?)$/i);
	if (metricMatch) return { primary: Number(metricMatch[1]), secondary: 0 };

	const numberedThreadMatch = str.match(/^#?(\d+)\s*-\s*(\d+(?:\.\d+)?)$/);
	if (numberedThreadMatch && NUMBERED_DIAMETER_SIZES.has(numberedThreadMatch[1])) {
		return {
			primary: Number(numberedThreadMatch[1]) / 1000,
			secondary: Number(numberedThreadMatch[2]),
		};
	}

	str = str.replace(/^(\d+)\s*-\s*(\d+\/\d+)$/, "$1 $2");

	if (/^\d+\/\d+$/.test(str)) {
		const [num, den] = str.split("/").map(Number);
		return den ? { primary: num / den, secondary: 0 } : null;
	}

	if (/^\d+\s+\d+\/\d+$/.test(str)) {
		const [whole, frac] = str.split(/\s+/, 2);
		const [num, den] = frac.split("/").map(Number);
		return den ? { primary: Number(whole) + num / den, secondary: 0 } : null;
	}

	if (/^#\d+(?:\.\d+)?$/.test(str)) {
		return { primary: Number(str.replace(/^#/, "")) / 1000, secondary: 0 };
	}

	if (lowerKey === "diameter" && NUMBERED_DIAMETER_SIZES.has(str)) {
		return { primary: Number(str) / 1000, secondary: 0 };
	}

	if (/^\d+(?:\.\d+)?$/.test(str)) {
		return { primary: Number(str), secondary: 0 };
	}

	return null;
}

// General pages only: a value the strict parser cannot read ("1/2\" - 1-1/4\"", "M6 x 1.0", "60 Grit",
// "4-1/2 x .045 x 7/8") sorts by its first number.
function leadingSizeSort(value = "") {
	const text = String(value || "").replace(/[”″]/g, '"');
	const match = text.match(/(\d+)\s*-\s*(\d+)\/(\d+)|(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|(\d*\.\d+|\d+)/);
	if (!match) return null;
	if (match[1]) return Number(match[1]) + Number(match[2]) / Number(match[3] || 1);
	if (match[4]) return Number(match[4]) + Number(match[5]) / Number(match[6] || 1);
	if (match[7]) return Number(match[7]) / Number(match[8] || 1);
	return Number(match[9]);
}

// Keys whose values the strict size parser reads as written on fasteners (#10-24, M6, 1-1/4). Other size
// keys (clamp ranges, grit, roll length) sort by their first number, so "2\" - 4\"" is not read as "#2-4".
const STRICT_SIZE_KEYS = new Set(["diameter", "threadsize", "threadpitch", "length", "width", "thickness", "size"]);

function generalSizeSortValue(value, key) {
	// A bare "3" is a 3" wheel here, not a #3 screw gauge: only a written "#" reads as a numbered size.
	const lower = String(key || "").toLowerCase();
	const strict = STRICT_SIZE_KEYS.has(lower) ? parseBuilderSizeSort(value, lower === "diameter" ? "" : key) : null;
	if (strict) return strict;
	const loose = leadingSizeSort(value);
	return Number.isFinite(loose) ? { primary: loose, secondary: 0 } : null;
}

function compareText(a, b) {
	return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function isSizeSortKey(key = "", sort = "") {
	return sort === "size" || SIZE_SORT_KEYS.has(String(key || "").toLowerCase());
}

// Wire gauge, thinnest wire first: the largest AWG number in the value leads ("22-18", "16-14", "12-10", "8", "2").
export function wireGaugeSortKey(value = "") {
	const numbers = (String(value).match(/\d+/g) || []).map(Number);
	if (!numbers.length) return null;
	return [-Math.max(...numbers), -Math.min(...numbers)];
}

// Abrasive grade, coarsest first: Coarse, Medium, Fine, Very Fine, Ultra Fine ("Coarse (Brown)" reads as Coarse).
const GRADE_ORDER = ["coarse", "medium", "fine", "very fine", "ultra fine"];
export function gradeSortKey(value = "") {
	const word = String(value).toLowerCase().replace(/\(.*\)/, "").trim();
	const index = GRADE_ORDER.indexOf(word);
	return index === -1 ? null : index;
}

// Terminal stud size, smallest first: numbered sizes (#4 ... #12, read as their real diameter) before inch sizes.
export function studSizeSortKey(value = "") {
	const text = String(value).replace(/[”″]/g, '"').trim();
	const numbered = text.match(/^#\s*(\d+)/);
	if (numbered) return 0.06 + 0.013 * Number(numbered[1]);
	const loose = leadingSizeSort(text);
	return Number.isFinite(loose) ? loose : null;
}

function compareByKey(keyOf) {
	return (a, b) => {
		const ka = keyOf(a);
		const kb = keyOf(b);
		if (ka !== null && kb !== null) {
			const la = [].concat(ka);
			const lb = [].concat(kb);
			for (let i = 0; i < Math.max(la.length, lb.length); i += 1) {
				if ((la[i] ?? 0) !== (lb[i] ?? 0)) return (la[i] ?? 0) - (lb[i] ?? 0);
			}
		}
		if (ka !== null && kb === null) return -1;
		if (ka === null && kb !== null) return 1;
		return compareText(a, b);
	};
}

// Sizes by value (as sortBuilderOptionValues does, plus the general size keys); everything else alphabetically.
// sort "gauge": wire gauge, thinnest first. sort "stud": stud size, smallest first (numbered sizes before inches).
export function sortGeneralChoiceValues(values = [], key = "", sort = "") {
	if (sort === "gauge") return [...values].sort(compareByKey(wireGaugeSortKey));
	if (sort === "stud") return [...values].sort(compareByKey(studSizeSortKey));
	if (sort === "grade") return [...values].sort(compareByKey(gradeSortKey));
	if (!isSizeSortKey(key, sort)) return [...values].sort(compareText);
	return [...values].sort((a, b) => {
		const aSort = generalSizeSortValue(a, key);
		const bSort = generalSizeSortValue(b, key);
		if (aSort && bSort) {
			if (aSort.primary !== bSort.primary) return aSort.primary - bSort.primary;
			if (aSort.secondary !== bSort.secondary) return aSort.secondary - bSort.secondary;
		}
		if (aSort && !bSort) return -1;
		if (!aSort && bSort) return 1;
		return compareText(a, b);
	});
}

function formatMeasurementSystem(value = "") {
	const raw = String(value || "").trim();
	if (/^imperial$/i.test(raw)) return "Standard";
	if (/^metric$/i.test(raw)) return "Metric";
	return raw;
}

// A variant's attributes on a general page: every attribute a shopper could read, internal keys removed,
// materialFinish built from material and finish as the hand-tuned pages do. material, finish and size stay
// (a page filter may use them).
export function shapeGeneralBuilderAttributes(attributes = {}) {
	const attrs = { ...(attributes || {}) };
	const materialFinish =
		attrs.materialFinish ||
		[attrs.displayMaterial, attrs.displayFinish]
			.filter(Boolean)
			.join(" / ")
			.replace(/^(.+?) \/ \1$/, "$1") ||
		[attrs.material, attrs.finish]
			.filter(Boolean)
			.join(" / ")
			.replace(/^(.+?) \/ \1$/i, "$1");

	const out = {};
	for (const [key, value] of Object.entries(attrs)) {
		if (isInternalBuilderKey(key) || isBlank(value)) continue;
		out[key] = typeof value === "string" ? value.trim() : value;
	}
	if (materialFinish) out.materialFinish = materialFinish;
	if (out.measurementSystem) out.measurementSystem = formatMeasurementSystem(out.measurementSystem);
	return out;
}

function distinctValues(attributeRows = [], key = "") {
	const values = new Set();
	for (const attrs of attributeRows) {
		const value = attrs?.[key];
		if (!isBlank(value) && String(value).trim()) values.add(String(value).trim());
	}
	return values;
}

// The page's choices, in order: [{ key, label, sort }].
//   - the page's own filters (categories.json) when it has some;
//   - otherwise the type key, measurement system, size keys, materialFinish, grade, color.
// Internal keys are never offered, and a choice is dropped when fewer than two values exist on the page.
export function planGeneralBuilderChoices(attributeRows = [], pageFilters = []) {
	const has = (key) => distinctValues(attributeRows, key).size > 0;
	let candidates;

	if (Array.isArray(pageFilters) && pageFilters.length) {
		candidates = pageFilters
			.filter((filter) => filter && filter.key)
			.map((filter) => ({ key: filter.key, label: filter.label || "", sort: filter.sort || "" }));
	} else {
		const keys = [];
		const typeKey = TYPE_KEYS.find(has);
		if (typeKey) keys.push(typeKey);
		keys.push("measurementSystem");
		for (const key of SIZE_KEYS) {
			if (key === "diameter") keys.push(has("diameter") ? "diameter" : "threadSize");
			else keys.push(key);
		}
		keys.push("materialFinish", "grade", "color");
		candidates = keys.map((key) => ({ key, label: "", sort: "" }));
	}

	const seen = new Set();
	const kept = candidates.filter(({ key }) => {
		if (seen.has(key) || isInternalBuilderKey(key)) return false;
		seen.add(key);
		return distinctValues(attributeRows, key).size > 1;
	});
	const keptKeys = kept.map(({ key }) => key);
	const fromPageFilters = Array.isArray(pageFilters) && pageFilters.length > 0;
	return kept
		.filter(({ key }) => !(key === "size" && isSizeDeterminedByOtherChoices(attributeRows, keptKeys)))
		.filter(({ key }) => fromPageFilters || key !== "threadPitch" || isThreadPitchBackedBySize(attributeRows))
		.map(({ key, label, sort }) => ({
			key,
			label: label && label !== key ? label : BUILDER_CHOICE_LABELS[key] || readableKey(key),
			sort: sort || (isSizeSortKey(key) ? "size" : ""),
		}));
}

// "size" often just joins diameter and length ("3/64X1"). It is dropped when the page already offers both a
// diameter (or thread size) and a length, or when the other size choices pin it down: every row's other size
// values lead to a single size (compared without spaces, quotes or "#").
const SIZE_PART_KEYS = new Set(SIZE_KEYS.filter((key) => key !== "size").concat("threadSize"));

export function isSizeDeterminedByOtherChoices(attributeRows = [], choiceKeys = []) {
	const others = choiceKeys.filter((key) => SIZE_PART_KEYS.has(key));
	if (!others.length) return false;
	if ((others.includes("diameter") || others.includes("threadSize")) && others.includes("length")) return true;
	const sizeByTuple = new Map();
	for (const attrs of attributeRows) {
		const size = attrs?.size;
		if (isBlank(size) || !String(size).trim()) continue;
		const parts = others.map((key) => String(attrs?.[key] ?? "").trim().toLowerCase());
		if (parts.every((part) => !part)) return false;
		const tuple = parts.join("|");
		const value = String(size).toLowerCase().replace(/[\s"#”″]/g, "");
		if (sizeByTuple.has(tuple) && sizeByTuple.get(tuple) !== value) return false;
		sizeByTuple.set(tuple, value);
	}
	return true;
}

// Many non-threaded rows (cable ties, terminals, saw blades, hose clamps) carry a stray threadPitch from the old
// fastener parser. In the default set, Thread is offered only when most rows with a pitch also have a
// diameter or thread size, as a threaded part does.
export function isThreadPitchBackedBySize(attributeRows = [], share = 0.8) {
	let withPitch = 0;
	let backed = 0;
	for (const attrs of attributeRows) {
		const pitch = attrs?.threadPitch;
		if (isBlank(pitch) || !String(pitch).trim()) continue;
		withPitch += 1;
		const size = [attrs?.diameter, attrs?.threadSize].find((value) => !isBlank(value) && String(value).trim());
		if (size) backed += 1;
	}
	return withPitch > 0 && backed / withPitch >= share;
}

// Values that differ only in letter case ("Stainless Steel" / "stainless steel") read as one choice: every
// row takes the spelling most rows use (ties: the one with more capitals). Changes the rows in place.
export function unifyChoiceValueCase(attributeRows = []) {
	const spellings = new Map();
	for (const attrs of attributeRows) {
		for (const [key, value] of Object.entries(attrs || {})) {
			if (typeof value !== "string" || !value) continue;
			const id = `${key}\u0000${value.toLowerCase()}`;
			if (!spellings.has(id)) spellings.set(id, new Map());
			const counts = spellings.get(id);
			counts.set(value, (counts.get(value) || 0) + 1);
		}
	}
	const capitals = (text) => (text.match(/[A-Z]/g) || []).length;
	const chosen = new Map();
	for (const [id, counts] of spellings) {
		if (counts.size < 2) continue;
		const best = [...counts.entries()].sort(
			(a, b) => b[1] - a[1] || capitals(b[0]) - capitals(a[0]) || a[0].localeCompare(b[0]),
		)[0][0];
		chosen.set(id, best);
	}
	if (!chosen.size) return attributeRows;
	for (const attrs of attributeRows) {
		for (const [key, value] of Object.entries(attrs || {})) {
			if (typeof value !== "string") continue;
			const best = chosen.get(`${key}\u0000${value.toLowerCase()}`);
			if (best) attrs[key] = best;
		}
	}
	return attributeRows;
}

export function readableKey(key = "") {
	return String(key)
		.replace(/_/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

// { key: [sorted values] } for the given choices.
export function collectGeneralChoiceOptions(variants = [], choices = []) {
	const result = {};
	for (const { key, sort } of choices) {
		const values = distinctValues(variants.map((variant) => variant?.attributes || {}), key);
		if (values.size) result[key] = sortGeneralChoiceValues([...values], key, sort);
	}
	return result;
}

// The fold key on a general page: every choice value plus the product id, so two different products never fold.
export function generalSpecKey(variant = {}, choiceKeys = []) {
	const attrs = variant?.attributes || {};
	const parts = choiceKeys.map((key) => `${key}:${String(attrs[key] ?? "").trim().toLowerCase()}`);
	parts.push(`product:${String(variant?.productId ?? variant?.enrichmentId ?? "")}`);
	return parts.join("|");
}

function choiceSignature(variant = {}, choiceKeys = []) {
	const attrs = variant?.attributes || {};
	return choiceKeys.map((key) => String(attrs[key] ?? "").trim().toLowerCase()).join("|");
}

// Fold only true duplicates (the same product twice). Rows that share every choice but are different products
// stay apart, and when they would read the same, the part number is added to the name so the cards differ.
export function dedupeGeneralVariants(variants = [], choiceKeys = [], sortForSelection = () => 0) {
	const grouped = new Map();
	for (const variant of variants) {
		const key = generalSpecKey(variant, choiceKeys);
		if (!grouped.has(key)) grouped.set(key, []);
		grouped.get(key).push(variant);
	}

	const deduped = [];
	for (const group of grouped.values()) {
		const sorted = [...group].sort(sortForSelection);
		deduped.push({
			...sorted[0],
			duplicateCount: group.length,
			groupedPartNumbers: sorted.map((item) => item.partNumber).filter(Boolean),
		});
	}

	const bySignature = new Map();
	for (const variant of deduped) {
		const signature = choiceSignature(variant, choiceKeys);
		if (!bySignature.has(signature)) bySignature.set(signature, []);
		bySignature.get(signature).push(variant);
	}
	for (const group of bySignature.values()) {
		if (group.length < 2) continue;
		const nameCounts = new Map();
		for (const variant of group) nameCounts.set(variant.name, (nameCounts.get(variant.name) || 0) + 1);
		for (const variant of group) {
			variant.sharesChoicesWith = group.length - 1;
			if (nameCounts.get(variant.name) > 1 && variant.partNumber) {
				variant.name = `${variant.name} (${variant.partNumber})`;
			}
		}
	}
	return deduped;
}

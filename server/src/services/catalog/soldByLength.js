// Products sold by length (tubing, loom, sleeving, chain, wire, cable). Plain code, no database.
//
// On these pages a product is sold by the foot: the cart counts feet, and the spool length in the title
// ("x 100'", "(250 ft Roll)") is not shown, because the price is per foot. Exceptions:
//   - dual wall heat shrink is sold in 4 ft pieces;
//   - a whole roll or drum priced as one item ("x 400 ft" at $1,634.60) is a "roll". When the same product is
//     also sold by the foot (its "per-foot twin"), the roll row is hidden; otherwise it is sold as one item;
//   - a fixed-length assembly (a tie-down chain with hooks) is sold as one item.

export const SOLD_BY_LENGTH_PAGES = new Set([
	"electrical/shrink-wrap",
	"electrical/wire-loom",
	"electrical/primary-wire",
	"wire-hardware/chain",
	"wire-hardware/cable-wire-rope",
]);

// Normalized "category/subcategory" page key ("wire hardware" / "chain" -> "wire-hardware/chain").
export function pageKeyFor(category = "", subcategory = "") {
	const slug = (value) =>
		String(value || "")
			.toLowerCase()
			.replace(/&/g, " ")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	return `${slug(category)}/${slug(subcategory)}`;
}

// A length in feet written in a title: "x 400 ft", ", 100'", "x 4'", "(250 ft Roll)", "(Black, 100 ft)".
const LENGTH_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:ft\.?|feet|foot|')(?!\w)(?:\s*roll)?/i;
// The same, with the separator before it, for taking it out of a title.
const LENGTH_IN_TITLE_RE =
	/\s*(?:[x×]\s*)?(\d[\d,]*(?:\.\d+)?)\s*(?:ft\.?|feet|foot|')(?!\w)(?:\s*roll)?/gi;

export function lengthInFeet(title = "") {
	const match = String(title).match(LENGTH_RE);
	return match ? Number(match[1].replace(/,/g, "")) : null;
}

// The title without its spool length: "Split Wire Loom – 1/2" ID x 100', Black" -> "Split Wire Loom – 1/2" ID, Black".
export function titleWithoutLength(title = "") {
	return String(title)
		.replace(LENGTH_IN_TITLE_RE, "")
		.replace(/\(\s*,\s*/g, "(")
		.replace(/,\s*\)/g, ")")
		.replace(/\(\s*\)/g, "")
		.replace(/\s+,/g, ",")
		.replace(/,\s*,/g, ",")
		.replace(/[\s,–-]+$/g, "")
		.replace(/\s{2,}/g, " ")
		.trim();
}

function twinKey(title = "") {
	return titleWithoutLength(title)
		.toLowerCase()
		.replace(/[^a-z0-9/.#]+/g, " ")
		.trim();
}

const ASSEMBLY_RE = /\bwith\b.*\bhooks?\b|\bhooks?\b.*\bassembly\b|\bassembl(y|ies)\b/i;
const DUAL_WALL_RE = /\bdual wall\b/i;
// A roll costs at least this many times its per-foot twin.
const ROLL_PRICE_RATIO = 8;
// With no twin: a row is a whole roll when its title says "Roll", or it is at least ROLL_MIN_FEET long and
// costs at least ROLL_MIN_PRICE (a 25' battery cable at $7.48 is a per-foot price, a 100' one at $284 a roll).
const ROLL_MIN_FEET = 100;
const ROLL_MIN_PRICE = 50;
const ROLL_WORD_RE = /\broll\b|\bdrum\b|\bspool\b|\breel\b/i;

// rows: [{ partNumber, title, price }] of one page. Returns Map partNumber -> { unit, reason, twinOf }:
//   unit "ft"     sold by the foot (no length on the card)
//   unit "piece"  dual wall heat shrink, 4 ft pieces
//   unit "hide"   a roll whose per-foot twin is on the page
//   unit "each"   a roll with no twin, or a fixed-length assembly (keeps its length)
export function classifySoldByLength(rows = []) {
	const out = new Map();
	const groups = new Map();
	for (const row of rows) {
		const key = twinKey(row.title);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(row);
	}

	for (const row of rows) {
		const title = String(row.title || "");
		const price = Number(row.price) || 0;
		const feet = lengthInFeet(title);

		if (DUAL_WALL_RE.test(title)) {
			out.set(row.partNumber, { unit: "piece", reason: "dual wall heat shrink: 4 ft pieces" });
			continue;
		}
		if (ASSEMBLY_RE.test(title)) {
			out.set(row.partNumber, { unit: "each", reason: "fixed-length assembly" });
			continue;
		}

		const twins = (groups.get(twinKey(title)) || []).filter((other) => other !== row && Number(other.price) > 0);
		const cheapestTwin = twins.reduce((min, other) => Math.min(min, Number(other.price)), Infinity);
		if (feet && Number.isFinite(cheapestTwin) && price >= cheapestTwin * ROLL_PRICE_RATIO) {
			const twin = twins.find((other) => Number(other.price) === cheapestTwin);
			out.set(row.partNumber, { unit: "hide", reason: `roll of ${feet} ft; sold by the foot as ${twin.partNumber}`, twinOf: twin.partNumber });
			continue;
		}
		if (feet && (ROLL_WORD_RE.test(title) || (feet >= ROLL_MIN_FEET && price >= ROLL_MIN_PRICE))) {
			out.set(row.partNumber, { unit: "each", reason: `whole roll of ${feet} ft, no per-foot twin` });
			continue;
		}
		out.set(row.partNumber, { unit: "ft", reason: "per foot" });
	}
	return out;
}

// Single-row decisions: 18 AWG green has two per-foot rows; 1118104 stays.
export const SOLD_BY_LENGTH_OVERRIDES = {
	"54183": { unit: "hide", reason: "same wire as 1118104 (18 AWG green, per foot)" },
};

export const UNIT_LABELS = { ft: "ft", piece: "4' pieces", each: "" };

export function isSoldByLengthPage(category = "", subcategory = "") {
	return SOLD_BY_LENGTH_PAGES.has(pageKeyFor(category, subcategory));
}

// Classify one page's rows, with the overrides applied.
export function soldByLengthMap(rows = []) {
	const map = classifySoldByLength(rows);
	for (const [partNumber, override] of Object.entries(SOLD_BY_LENGTH_OVERRIDES)) {
		if (map.has(partNumber)) map.set(partNumber, { ...map.get(partNumber), ...override });
	}
	return map;
}

// Builder rows of a sold-by-length page: roll twins dropped; per-foot rows lose their spool length (title and
// the length attribute); every row says how it is sold (sellUnit, unitLabel). Rows need partNumber, name, price.
export function applySoldByLength(variants = []) {
	const map = soldByLengthMap(
		variants.map((v) => ({ partNumber: v.partNumber, title: v.name, price: v.baseCatalogPrice ?? v.price })),
	);
	const out = [];
	for (const variant of variants) {
		const sold = map.get(variant.partNumber) || { unit: "ft" };
		if (sold.unit === "hide") continue;
		if (sold.unit === "ft") {
			const attributes = { ...(variant.attributes || {}) };
			delete attributes.length;
			delete attributes.rollLength;
			out.push({
				...variant,
				name: titleWithoutLength(variant.name),
				familyTitle: variant.familyTitle ? titleWithoutLength(variant.familyTitle) : variant.familyTitle,
				attributes,
				sellUnit: "ft",
				unitLabel: UNIT_LABELS.ft,
			});
		} else {
			out.push({ ...variant, sellUnit: sold.unit, unitLabel: UNIT_LABELS[sold.unit] || "" });
		}
	}
	return out;
}

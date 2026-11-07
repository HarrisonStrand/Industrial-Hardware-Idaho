// Choice values some pages read from what a product already says, without changing product data.
// Plain code, no database.
//   electrical/shrink-wrap  wallType: "Single Wall" or "Dual Wall" (from the title)
//   rivets/blind-rivets     flangeType: "Standard", "Large Flange" or "Countersunk" (from the head style / title)
//   abrasives/velcro-discs  gritColor: the disc's grade with its color, "Coarse (Brown)" (from the grade)
//   concrete/wedge-anchors  anchorSize: diameter and thread together, "1/4-20"
//   concrete/lag-expansion-shields  shieldType: "Lag Shield" or "Expansion Shield" (single or double)
//   concrete/* anchor pages  diameter without a stray inch mark (1/4" and 1/4 are one choice)

import { pageKeyFor, withHeatShrinkWall } from "./soldByLength.js";

export function rivetFlangeType(attributes = {}, title = "") {
	const head = String(attributes.headStyle || "").toLowerCase();
	const text = String(title || "");
	if (head === "flange" || /\blarge flange\b/i.test(text)) return "Large Flange";
	if (head === "countersunk" || head === "flat" || /\bcountersunk\b/i.test(text)) return "Countersunk";
	return "Standard";
}

export function withRivetFlange(variants = []) {
	return variants.map((variant) => ({
		...variant,
		attributes: { ...(variant.attributes || {}), flangeType: rivetFlangeType(variant.attributes, variant.name) },
	}));
}

// Hook-and-loop surface conditioning discs: each grade has one color (the disc titles state the same colors).
export const GRADE_COLORS = {
	coarse: "Brown",
	medium: "Red",
	fine: "Blue",
	"very fine": "Blue",
	"ultra fine": "Grey",
};

export function gradeWithColor(grade = "") {
	const text = String(grade || "").trim();
	if (!text) return "";
	const words = text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
	const color = GRADE_COLORS[text.toLowerCase()];
	return color ? `${words} (${color})` : words;
}

export function withVelcroGritColor(variants = []) {
	return variants.map((variant) => {
		const attributes = variant.attributes || {};
		const grade = attributes.density || attributes.grit || "";
		return { ...variant, attributes: { ...attributes, gritColor: gradeWithColor(grade) } };
	});
}

const stripInch = (value) => String(value || "").replace(/["”″]+$/, "").trim();

// Anchor diameters and lengths: no stray inch mark; a plastic anchor's screw range ("#8-#10") and a hollow wall
// anchor's own size ("1/8"" when the stored value is the screw thread "32") come from the title.
function cleanDiameter(attributes = {}, title = "") {
	const out = { ...attributes };
	let diameter = stripInch(attributes.diameter);
	const screwRange = String(title).match(/#\d+\s*-\s*#\d+/);
	if (screwRange && (/^#?\d+$/.test(diameter) || !diameter)) diameter = screwRange[0].replace(/\s+/g, "");
	else if (/^\d+$/.test(diameter) && Number(diameter) > 16) {
		const own = String(title).match(/–\s*(\d+\/\d+|\d+)"/);
		if (own) diameter = own[1];
	}
	if (diameter) out.diameter = diameter;
	if (attributes.length) out.length = stripInch(attributes.length);
	return out;
}

export function wedgeAnchorSize(attributes = {}) {
	const diameter = String(attributes.diameter || "").replace(/["”″]+$/, "").trim();
	const thread = String(attributes.threadPitch || "").trim();
	return diameter && /^\d+$/.test(thread) ? `${diameter}-${thread}` : diameter;
}

export function withWedgeAnchorSize(variants = []) {
	return variants.map((variant) => ({
		...variant,
		attributes: { ...cleanDiameter(variant.attributes, variant.name), anchorSize: wedgeAnchorSize(variant.attributes) },
	}));
}

export function shieldType(attributes = {}, title = "") {
	const text = `${attributes.anchorType || ""} ${title}`.toLowerCase();
	if (text.includes("expansion")) return "Expansion Shield";
	if (text.includes("lag")) return "Lag Shield";
	return "";
}

export function withShieldType(variants = []) {
	return variants.map((variant) => ({
		...variant,
		attributes: { ...cleanDiameter(variant.attributes, variant.name), shieldType: shieldType(variant.attributes, variant.name) },
	}));
}

export function withCleanDiameter(variants = []) {
	return variants.map((variant) => ({ ...variant, attributes: cleanDiameter(variant.attributes, variant.name) }));
}

const BY_PAGE = {
	"electrical/shrink-wrap": withHeatShrinkWall,
	"rivets/blind-rivets": withRivetFlange,
	"abrasives/velcro-discs": withVelcroGritColor,
	"concrete/wedge-anchors": withWedgeAnchorSize,
	"concrete/lag-expansion-shields": withShieldType,
	"concrete/hollow-wall-anchors": withCleanDiameter,
	"concrete/light-duty-anchors": withCleanDiameter,
};

export function withPageAttributes(category = "", subcategory = "", variants = []) {
	const add = BY_PAGE[pageKeyFor(category, subcategory)];
	return add ? add(variants) : variants;
}

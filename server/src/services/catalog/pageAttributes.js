// Choice values some pages read from what a product already says, without changing product data.
// Plain code, no database.
//   electrical/shrink-wrap  wallType: "Single Wall" or "Dual Wall" (from the title)
//   rivets/blind-rivets     flangeType: "Standard", "Large Flange" or "Countersunk" (from the head style / title)
//   abrasives/velcro-discs  gritColor: the disc's grade with its color, "Coarse (Brown)" (from the grade)

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

const BY_PAGE = {
	"electrical/shrink-wrap": withHeatShrinkWall,
	"rivets/blind-rivets": withRivetFlange,
	"abrasives/velcro-discs": withVelcroGritColor,
};

export function withPageAttributes(category = "", subcategory = "", variants = []) {
	const add = BY_PAGE[pageKeyFor(category, subcategory)];
	return add ? add(variants) : variants;
}

// Choice values some pages read from what a product already says, without changing product data.
// Plain code, no database.
//   electrical/shrink-wrap  wallType: "Single Wall" or "Dual Wall" (from the title)
//   rivets/blind-rivets     flangeType: "Standard", "Large Flange" or "Countersunk" (from the head style / title)

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

const BY_PAGE = {
	"electrical/shrink-wrap": withHeatShrinkWall,
	"rivets/blind-rivets": withRivetFlange,
};

export function withPageAttributes(category = "", subcategory = "", variants = []) {
	const add = BY_PAGE[pageKeyFor(category, subcategory)];
	return add ? add(variants) : variants;
}

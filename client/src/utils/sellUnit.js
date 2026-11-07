// How a product is counted in the cart: by the foot (tubing, loom, chain, wire, cable), in 4 ft pieces
// (dual wall heat shrink), or one at a time. The server sets sellUnit on products of those pages.
const WORDS = {
	ft: { qtyLabel: "Feet", per: "per ft", short: "ft" },
	piece: { qtyLabel: "4' Pieces", per: "per 4' piece", short: "× 4' pc" },
};

export function sellUnitWords(sellUnit = "") {
	return WORDS[sellUnit] || { qtyLabel: "Qty", per: "each", short: "" };
}

// "12 ft", "3 × 4' pc", or just "5".
export function quantityText(quantity = 1, sellUnit = "") {
	const { short } = sellUnitWords(sellUnit);
	return short ? `${quantity} ${short}` : String(quantity);
}

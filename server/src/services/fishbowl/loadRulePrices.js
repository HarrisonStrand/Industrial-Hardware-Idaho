import { FishbowlProductPrice } from "../../models/FishbowlPricing.js";

// The copied Fishbowl rule prices for a list of website products, keyed by part number.
// Only read when Admin > Pricing uses "Fishbowl rules"; otherwise returns an empty map.
export function productPartNumber(product = {}) {
	return String(product?.fishbowl?.partNum || product?.sku || "").trim();
}

export async function loadRulePrices(products = [], pricingSettings = null) {
	if (pricingSettings?.priceMode !== "fishbowl-rules") return new Map();
	const parts = [...new Set(products.map(productPartNumber).filter(Boolean))];
	if (!parts.length) return new Map();
	const rows = await FishbowlProductPrice.find({ partNumber: { $in: parts } }, { partNumber: 1, prices: 1 }).lean();
	return new Map(rows.map((row) => [row.partNumber, row.prices || null]));
}

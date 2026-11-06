// Fixed-price groups: products that sell at the Fishbowl price for every account (a fixed margin),
// instead of the Retail / House / Net 30 markup. A group picks products by category or by maker.
// Admin > Pricing edits the list; until it is saved once, these defaults apply.

export const DEFAULT_FIXED_PRICE_GROUPS = [
  { type: "category", value: "strut", label: "Strut", multiplier: 1 },
  { type: "category", value: "diablo", label: "Diablo", multiplier: 1 },
  { type: "category", value: "makita", label: "Makita", multiplier: 1 },
  { type: "maker", value: "Big Timber", label: "Big Timber", multiplier: 1 },
];

const GROUP_TYPES = new Set(["category", "maker"]);

// "Bits & Drivers", "bits-and-drivers" and "bits and drivers" all compare equal.
export function normalizeGroupKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sanitizeFixedPriceGroups(input) {
  if (!Array.isArray(input)) return DEFAULT_FIXED_PRICE_GROUPS.map((group) => ({ ...group }));
  const seen = new Set();
  const groups = [];
  for (const raw of input) {
    const type = String(raw?.type || "").trim().toLowerCase();
    const value = String(raw?.value || "").trim();
    if (!GROUP_TYPES.has(type) || !value) continue;
    const key = `${type}:${normalizeGroupKey(value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const multiplier = Number(raw?.multiplier);
    groups.push({
      type,
      value,
      label: String(raw?.label || value).trim(),
      multiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
    });
  }
  return groups;
}

// What a product is matched on: its website category and every name its maker goes by.
// rulePrices: the product's copied Fishbowl rule prices (only used in "Fishbowl rules" mode).
export function priceGroupInfo(product = {}, enrichment = {}, rulePrices = null) {
  return {
    category: enrichment?.category || "",
    makers: [enrichment?.manufacturer?.name, product?.brand, product?.vendor].filter(Boolean),
    rulePrices,
  };
}

export function findFixedPriceGroup(info = {}, groups = []) {
  if (!info || !Array.isArray(groups) || !groups.length) return null;
  const category = normalizeGroupKey(info.category);
  const makers = (info.makers || []).map(normalizeGroupKey).filter(Boolean);
  for (const group of groups) {
    const value = normalizeGroupKey(group.value);
    if (!value) continue;
    if (group.type === "category" && category && category === value) return group;
    if (group.type === "maker" && makers.some((maker) => maker === value)) return group;
  }
  return null;
}

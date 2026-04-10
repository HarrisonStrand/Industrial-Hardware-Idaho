export const ACCOUNT_PRICE_RULES = {
  RETAIL: {
    label: "Retail",
    multiplier: 1.0,
  },
  HOUSE: {
    label: "House Account",
    multiplier: 1.0,
  },
  NET30: {
    label: "Net 30",
    multiplier: 1.0,
  },
};

export function normalizeApprovedType(value = "RETAIL") {
  const normalized = String(value || "RETAIL").trim().toUpperCase();

  if (normalized === "HOUSE") return "HOUSE";
  if (normalized === "NET30") return "NET30";
  return "RETAIL";
}

export function getAccountPriceRule(value = "RETAIL") {
  const type = normalizeApprovedType(value);
  return ACCOUNT_PRICE_RULES[type] || ACCOUNT_PRICE_RULES.RETAIL;
}
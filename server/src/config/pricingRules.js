export const DEFAULT_ACCOUNT_PRICE_RULES = {
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

function sanitizeRuleValue(rule = {}, fallback = {}) {
  const multiplier = Number(rule?.multiplier);
  return {
    label: String(rule?.label || fallback?.label || "").trim(),
    multiplier:
      Number.isFinite(multiplier) && multiplier >= 0
        ? Number(multiplier)
        : Number(fallback?.multiplier ?? 1),
  };
}

export function sanitizeAccountRules(input = {}) {
  return {
    RETAIL: sanitizeRuleValue(input?.RETAIL, DEFAULT_ACCOUNT_PRICE_RULES.RETAIL),
    HOUSE: sanitizeRuleValue(input?.HOUSE, DEFAULT_ACCOUNT_PRICE_RULES.HOUSE),
    NET30: sanitizeRuleValue(input?.NET30, DEFAULT_ACCOUNT_PRICE_RULES.NET30),
  };
}
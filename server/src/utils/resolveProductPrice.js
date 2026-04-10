import {
  getAccountPriceRule,
  normalizeApprovedType,
} from "../config/pricingRules.js";

function roundCurrency(value = 0) {
  return Number(Number(value || 0).toFixed(2));
}

function getBaseCatalogPrice(product = {}) {
  const basePrice = product?.pricing?.basePrice;
  const salePrice = product?.pricing?.salePrice;

  if (basePrice !== null && basePrice !== undefined) {
    return roundCurrency(basePrice);
  }

  if (salePrice !== null && salePrice !== undefined) {
    return roundCurrency(salePrice);
  }

  return 0;
}

function resolveEffectiveApprovedType({
  approvedType = "RETAIL",
  approvalStatus = "NONE",
} = {}) {
  const normalizedType = normalizeApprovedType(approvedType);

  if (normalizedType === "RETAIL") return "RETAIL";
  if (String(approvalStatus || "").toUpperCase() !== "APPROVED") return "RETAIL";

  return normalizedType;
}

export function getPricingContext(input = {}) {
  const effectiveApprovedType = resolveEffectiveApprovedType({
    approvedType: input?.approvedType,
    approvalStatus: input?.approvalStatus,
  });

  const rule = getAccountPriceRule(effectiveApprovedType);

  return {
    approvedType: effectiveApprovedType,
    approvalStatus: String(input?.approvalStatus || "NONE").toUpperCase(),
    label: rule.label,
    multiplier: Number(rule.multiplier || 1),
    originalApprovedType: normalizeApprovedType(input?.approvedType || "RETAIL"),
  };
}

export function buildPricingContextFromUser(user = null) {
  const account = user?.account || {};

  return getPricingContext({
    approvedType: account.approvedType || "RETAIL",
    approvalStatus: account.approvalStatus || "NONE",
  });
}

export function resolveProductPrice(product = {}, pricingInput = {}) {
  const pricingContext = getPricingContext(pricingInput);
  const baseCatalogPrice = getBaseCatalogPrice(product);
  const resolvedPrice = roundCurrency(
    baseCatalogPrice * Number(pricingContext.multiplier || 1)
  );

  return {
    ...pricingContext,
    baseCatalogPrice,
    resolvedPrice,
    currency: product?.pricing?.currency || "USD",
    source: product?.pricing?.priceSource || "fishbowl",
  };
}
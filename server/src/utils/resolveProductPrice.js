import PricingSettings from "../models/PricingSettings.js";
import {
  DEFAULT_ACCOUNT_PRICE_RULES,
  normalizeApprovedType,
  sanitizeAccountRules,
} from "../config/pricingRules.js";

let pricingSettingsCache = {
  value: null,
  expiresAt: 0,
};

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

export function clearPricingSettingsCache() {
  pricingSettingsCache = {
    value: null,
    expiresAt: 0,
  };
}

export async function getPricingSettings({ forceRefresh = false } = {}) {
  if (
    !forceRefresh &&
    pricingSettingsCache.value &&
    Date.now() < pricingSettingsCache.expiresAt
  ) {
    return pricingSettingsCache.value;
  }

  const doc = await PricingSettings.findOne({ key: "default" }).lean();

  const value = {
    key: "default",
    accountRules: sanitizeAccountRules(doc?.accountRules || DEFAULT_ACCOUNT_PRICE_RULES),
    updatedAt: doc?.updatedAt || null,
  };

  pricingSettingsCache = {
    value,
    expiresAt: Date.now() + 10000,
  };

  return value;
}

function getAccountPriceRuleFromSettings(value = "RETAIL", pricingSettings = null) {
  const settings = pricingSettings?.accountRules || DEFAULT_ACCOUNT_PRICE_RULES;
  const type = normalizeApprovedType(value);
  return settings[type] || settings.RETAIL || DEFAULT_ACCOUNT_PRICE_RULES.RETAIL;
}

export async function getPricingContext(input = {}, pricingSettings = null) {
  const settings = pricingSettings || (await getPricingSettings());

  const effectiveApprovedType = resolveEffectiveApprovedType({
    approvedType: input?.approvedType,
    approvalStatus: input?.approvalStatus,
  });

  const rule = getAccountPriceRuleFromSettings(effectiveApprovedType, settings);

  return {
    approvedType: effectiveApprovedType,
    approvalStatus: String(input?.approvalStatus || "NONE").toUpperCase(),
    label: rule.label,
    multiplier: Number(rule.multiplier || 1),
    originalApprovedType: normalizeApprovedType(input?.approvedType || "RETAIL"),
  };
}

export async function buildPricingContextFromUser(user = null, pricingSettings = null) {
  const account = user?.account || {};

  return getPricingContext(
    {
      approvedType: account.approvedType || "RETAIL",
      approvalStatus: account.approvalStatus || "NONE",
    },
    pricingSettings
  );
}

export async function resolveProductPrice(product = {}, pricingInput = {}, pricingSettings = null) {
  const settings = pricingSettings || (await getPricingSettings());
  const pricingContext = await getPricingContext(pricingInput, settings);
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
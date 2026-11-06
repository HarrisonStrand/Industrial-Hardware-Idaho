import PricingSettings from "../models/PricingSettings.js";
import {
  DEFAULT_ACCOUNT_PRICE_RULES,
  normalizeApprovedType,
  sanitizeAccountRules,
} from "../config/pricingRules.js";
import {
  findFixedPriceGroup,
  sanitizeFixedPriceGroups,
} from "../config/fixedPriceGroups.js";
import { websiteGroupFor } from "../services/fishbowl/fishbowlPricingRules.js";

// "markup": Fishbowl list price x account markup (or a fixed-price group).
// "fishbowl-rules": the price Fishbowl's own pricing rules give (copied nightly); markup when a product has none.
export const PRICE_MODES = ["markup", "fishbowl-rules"];

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
    // Never saved = the default groups; saved as an empty list = no fixed-price groups.
    fixedPriceGroups: sanitizeFixedPriceGroups(doc?.fixedPriceGroups),
    priceMode: PRICE_MODES.includes(doc?.priceMode) ? doc.priceMode : "markup",
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

  // An account's own multiplier wins over its account type's multiplier.
  const override = input?.priceMultiplierOverride;
  const hasOverride =
    override !== null && override !== undefined && override !== "" && Number.isFinite(Number(override)) && Number(override) >= 0;

  return {
    approvedType: effectiveApprovedType,
    approvalStatus: String(input?.approvalStatus || "NONE").toUpperCase(),
    label: hasOverride ? `${rule.label} (account price)` : rule.label,
    multiplier: hasOverride ? Number(override) : Number(rule.multiplier || 1),
    priceMultiplierOverride: hasOverride ? Number(override) : null,
    originalApprovedType: normalizeApprovedType(input?.approvedType || "RETAIL"),
  };
}

export async function buildPricingContextFromUser(user = null, pricingSettings = null) {
  const account = user?.account || {};

  return getPricingContext(
    {
      approvedType: account.approvedType || "RETAIL",
      approvalStatus: account.approvalStatus || "NONE",
      priceMultiplierOverride: account.priceMultiplier ?? null,
    },
    pricingSettings
  );
}

// The price a customer pays: the Fishbowl price times the account's markup, unless the product is in
// a fixed-price group (strut, Diablo, ...), which sells at the group's multiplier (1 = Fishbowl price)
// for every account. `groupInfo` is { category, makers } from priceGroupInfo(); without it no group applies.
export function applyPriceMultiplier(
  baseCatalogPrice = 0,
  pricingContext = {},
  groupInfo = null,
  fixedPriceGroups = [],
  priceMode = "markup"
) {
  // Fishbowl rules mode: the rule price for the account's Fishbowl group (Retail, or House for House / Net 30).
  if (priceMode === "fishbowl-rules") {
    const rulePrice = groupInfo?.rulePrices?.[websiteGroupFor(pricingContext?.approvedType)];
    if (rulePrice && Number(rulePrice.price) > 0) {
      return {
        multiplier: null,
        fixedPriceGroup: null,
        priceRule: rulePrice.source === "rule" ? rulePrice.ruleName || "Fishbowl rule" : "Fishbowl list price",
        resolvedPrice: roundCurrency(Number(rulePrice.price)),
      };
    }
  }
  const group = groupInfo ? findFixedPriceGroup(groupInfo, fixedPriceGroups) : null;
  const multiplier = group ? Number(group.multiplier || 1) : Number(pricingContext?.multiplier || 1);
  return {
    multiplier,
    fixedPriceGroup: group ? group.label : null,
    resolvedPrice: roundCurrency(Number(baseCatalogPrice || 0) * multiplier),
  };
}

export async function resolveProductPrice(product = {}, pricingInput = {}, pricingSettings = null, groupInfo = null) {
  const settings = pricingSettings || (await getPricingSettings());
  const pricingContext = await getPricingContext(pricingInput, settings);
  const baseCatalogPrice = getBaseCatalogPrice(product);
  const { resolvedPrice, multiplier, fixedPriceGroup, priceRule } = applyPriceMultiplier(
    baseCatalogPrice,
    pricingContext,
    groupInfo,
    settings?.fixedPriceGroups || [],
    settings?.priceMode || "markup"
  );

  return {
    ...pricingContext,
    multiplier,
    fixedPriceGroup,
    priceRule: priceRule || null,
    label: priceRule
      ? `${pricingContext.label} (Fishbowl pricing)`
      : fixedPriceGroup
        ? `${fixedPriceGroup} (fixed price)`
        : pricingContext.label,
    baseCatalogPrice,
    resolvedPrice,
    currency: product?.pricing?.currency || "USD",
    source: product?.pricing?.priceSource || "fishbowl",
  };
}
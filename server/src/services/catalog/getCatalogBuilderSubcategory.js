import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import CatalogFamilyAsset from "../../models/CatalogFamilyAsset.js";
import { resolveProductPrice, getPricingContext } from "../../utils/resolveProductPrice.js";

function toTitle(value = "") {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, " ");
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function collectAttributeOptions(variants = []) {
  const map = new Map();

  for (const variant of variants) {
    const attrs = variant.attributes || {};

    for (const [key, value] of Object.entries(attrs)) {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        [
          "fishbowlPartNum",
          "sku",
          "internalPartNumber",
          "familyKey",
          "familySlug",
          "familyTitle",
          "familyAttributeOptions",
          "familyImage",
          "familyImageAlt",
          "fishbowlDescription",
          "categoryCanonical",
          "subcategoryCanonical",
          "fastenerTypeCanonical",
        ].includes(key)
      ) {
        continue;
      }

      if (!map.has(key)) {
        map.set(key, new Set());
      }

      map.get(key).add(String(value));
    }
  }

  const result = {};
  for (const [key, values] of map.entries()) {
    result[key] = Array.from(values).sort((a, b) =>
      String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  }

  return result;
}

function buildSpecKey(attributes = {}) {
  const keys = [
    "size",
    "diameter",
    "threadPitch",
    "length",
    "measurementSystem",
    "material",
    "finish",
    "grade",
    "fastenerTypeCanonical",
    "fastenerType",
  ];

  return keys
    .map((key) => `${key}:${String(attributes?.[key] || "").trim().toLowerCase()}`)
    .join("|");
}

function sortVariantsForSelection(a, b) {
  const aInStock = asNumber(a?.qtyAvailable, 0) > 0 ? 1 : 0;
  const bInStock = asNumber(b?.qtyAvailable, 0) > 0 ? 1 : 0;

  if (aInStock !== bInStock) {
    return bInStock - aInStock;
  }

  const aQty = asNumber(a?.qtyAvailable, 0);
  const bQty = asNumber(b?.qtyAvailable, 0);

  if (aQty !== bQty) {
    return bQty - aQty;
  }

  const aPrice = asNumber(a?.price, 0);
  const bPrice = asNumber(b?.price, 0);

  if (aPrice !== bPrice) {
    return aPrice - bPrice;
  }

  return String(a?.partNumber || "").localeCompare(String(b?.partNumber || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function dedupeVariants(variants = []) {
  const grouped = new Map();

  for (const variant of variants) {
    const specKey = buildSpecKey(variant.attributes || {});

    if (!grouped.has(specKey)) {
      grouped.set(specKey, []);
    }

    grouped.get(specKey).push(variant);
  }

  const deduped = [];

  for (const [, group] of grouped.entries()) {
    const sorted = [...group].sort(sortVariantsForSelection);
    const best = sorted[0];

    deduped.push({
      ...best,
      duplicateCount: group.length,
      groupedPartNumbers: sorted.map((item) => item.partNumber).filter(Boolean),
    });
  }

  return deduped;
}

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isLikelyAssemblyText(value = "") {
  const text = normalizeText(value);
  if (!text) return false;

  return (
    text.includes(" assy") ||
    text.includes("assembly") ||
    text.includes(" w /") ||
    text.includes(" w/") ||
    text.includes("with locknut") ||
    text.includes("locknut assy")
  );
}

function isBuilderReadyHexCapScrew(variant) {
  const attrs = variant?.attributes || {};

  const diameter = String(attrs.diameter || "").trim();
  const length = String(attrs.length || "").trim();
  const threadPitch = String(attrs.threadPitch || "").trim();
  const size = String(attrs.size || "").trim();
  const fastenerType = normalizeText(
    attrs.fastenerTypeCanonical || attrs.fastenerType || ""
  );

  const textToInspect = [
    variant?.name,
    variant?.description,
    attrs?.fishbowlDescription,
    variant?.partNumber,
  ]
    .filter(Boolean)
    .join(" ");

  if (isLikelyAssemblyText(textToInspect)) {
    return false;
  }

  if (fastenerType && fastenerType !== "hex cap screw") {
    return false;
  }

  if (!diameter) return false;
  if (!length) return false;
  if (!threadPitch && !size) return false;

  return true;
}

function shouldApplyBuilderReadyFilter(categoryId, subcategoryId) {
  return (
    normalizeText(categoryId) === "bolts" &&
    normalizeText(subcategoryId) === "hex cap screws"
  );
}

export async function getCatalogBuilderSubcategory(
  categoryId,
  subcategoryId,
  options = {}
) {
  const normalizedCategoryId = normalizeSlug(categoryId);
  const normalizedSubcategoryId = normalizeSlug(subcategoryId);
  const pricingContext = getPricingContext(options?.pricingContext || {});

  if (!normalizedCategoryId || !normalizedSubcategoryId) {
    throw new Error("categoryId and subcategoryId are required");
  }

  const enrichments = await ProductEnrichment.find({
    category: new RegExp(`^${escapeRegex(normalizedCategoryId)}$`, "i"),
    subcategory: new RegExp(`^${escapeRegex(normalizedSubcategoryId)}$`, "i"),
  }).lean();

  if (!enrichments.length) {
    return {
      categoryId: String(categoryId || ""),
      subcategoryId: String(subcategoryId || ""),
      name: toTitle(subcategoryId),
      description: "",
      image: "",
      attributes: {},
      families: [],
      variants: [],
      totals: {
        variantCount: 0,
        familyCount: 0,
        rawVariantCount: 0,
        omittedVariantCount: 0,
      },
    };
  }

  const productIds = enrichments.map((e) => e.productId);

  const products = await Product.find({
    _id: { $in: productIds },
  }).lean();

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const rawVariants = enrichments
    .map((enrichment) => {
      const product = productMap.get(String(enrichment.productId));
      if (!product) return null;

      const resolvedPricing = resolveProductPrice(product, pricingContext);
      const qtyAvailable = asNumber(product?.inventory?.qtyAvailable, 0);

      return {
        productId: product._id,
        enrichmentId: enrichment._id,
        slug: enrichment?.seo?.slug || "",
        sku: product.sku || "",
        internalPartNumber: product.internalPartNumber || "",
        partNumber:
          enrichment?.attributes?.fishbowlPartNum ||
          product?.fishbowl?.partNum ||
          product?.sku ||
          "",

        name: enrichment.title || enrichment.shortTitle || toTitle(subcategoryId),
        familyName: enrichment?.attributes?.familyTitle || toTitle(subcategoryId),
        shortDescription: enrichment.shortDescription || "",
        description: enrichment.description || "",
        image:
          enrichment.images?.find((img) => img.isPrimary)?.url ||
          enrichment.images?.[0]?.url ||
          "",

        attributes: {
          ...(enrichment.attributes || {}),
        },

        price: resolvedPricing.resolvedPrice,
        baseCatalogPrice: resolvedPricing.baseCatalogPrice,
        currency: resolvedPricing.currency || "USD",
        priceSource: resolvedPricing.source || "fishbowl",
        accountType: resolvedPricing.approvedType,
        priceLabel: resolvedPricing.label,

        qtyAvailable,
        qtyOnHand: asNumber(product?.inventory?.qtyOnHand, 0),
        qtyAllocated: asNumber(product?.inventory?.qtyAllocated, 0),
        qtyOnOrder: asNumber(product?.inventory?.qtyOnOrder, 0),
        inStock: qtyAvailable > 0,

        familyKey: enrichment?.attributes?.familyKey || "ungrouped",
        familySlug: enrichment?.attributes?.familySlug || "",
        familyTitle:
          enrichment?.attributes?.familyTitle ||
          enrichment.title ||
          enrichment.shortTitle ||
          toTitle(subcategoryId),
        familyAttributeOptions:
          enrichment?.attributes?.familyAttributeOptions || {},
      };
    })
    .filter(Boolean);

  const filteredVariants = shouldApplyBuilderReadyFilter(
    normalizedCategoryId,
    normalizedSubcategoryId
  )
    ? rawVariants.filter(isBuilderReadyHexCapScrew)
    : rawVariants;

  const workingVariants =
    filteredVariants.length > 0 ? filteredVariants : rawVariants;

  const omittedVariantCount = rawVariants.length - workingVariants.length;

  const familyKeys = [
    ...new Set(workingVariants.map((v) => v.familyKey).filter(Boolean)),
  ];

  const familyAssets = await CatalogFamilyAsset.find({
    category: normalizedCategoryId,
    subcategory: normalizedSubcategoryId,
    familyKey: { $in: familyKeys },
  }).lean();

  const familyAssetMap = new Map(
    familyAssets.map((asset) => [asset.familyKey, asset])
  );

  const familiesMap = new Map();

  for (const variant of workingVariants) {
    const familyKey = variant.familyKey || "ungrouped";
    const asset = familyAssetMap.get(familyKey);

    if (!familiesMap.has(familyKey)) {
      familiesMap.set(familyKey, {
        familyKey,
        familySlug: variant.familySlug || asset?.familySlug || "",
        familyTitle:
          variant.familyTitle ||
          asset?.familyTitle ||
          variant.familyName ||
          variant.name ||
          "",
        familyDescription: asset?.familyDescription || variant.description || "",
        familyAttributeOptions: variant.familyAttributeOptions || {},
        image: asset?.image?.url || variant.image || "",
        imageAlt: asset?.image?.alt || "",
        rawVariants: [],
      });
    }

    familiesMap.get(familyKey).rawVariants.push({
      ...variant,
      image: variant.image || asset?.image?.url || "",
    });
  }

  const families = Array.from(familiesMap.values()).map((family) => {
    const dedupedVariants = dedupeVariants(family.rawVariants);

    return {
      familyKey: family.familyKey,
      familySlug: family.familySlug,
      familyTitle: family.familyTitle,
      familyDescription: family.familyDescription,
      familyAttributeOptions:
        Object.keys(family.familyAttributeOptions || {}).length > 0
          ? family.familyAttributeOptions
          : collectAttributeOptions(dedupedVariants),
      image: family.image,
      imageAlt: family.imageAlt,
      variants: dedupedVariants,
    };
  });

  const flattenedVariants = families
    .flatMap((family) => family.variants || [])
    .sort(sortVariantsForSelection);

  const first = flattenedVariants[0];
  const firstFamilyWithImage = families.find((f) => f.image);

  return {
    categoryId: String(categoryId || ""),
    subcategoryId: String(subcategoryId || ""),
    name: toTitle(subcategoryId),
    description: first?.familyTitle
      ? `${first.familyTitle} options available in this category.`
      : "",
    image: firstFamilyWithImage?.image || "",
    attributes: collectAttributeOptions(flattenedVariants),
    families,
    variants: flattenedVariants,
    pricing: {
      accountType: pricingContext.approvedType,
      label: pricingContext.label,
      multiplier: pricingContext.multiplier,
    },
    totals: {
      variantCount: flattenedVariants.length,
      familyCount: families.length,
      rawVariantCount: rawVariants.length,
      omittedVariantCount,
    },
  };
}

export default getCatalogBuilderSubcategory;
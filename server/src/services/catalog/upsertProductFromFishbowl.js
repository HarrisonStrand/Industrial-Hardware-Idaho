import Product from "../../models/Product.js";
import parseFastenerAttributes from "../../utils/parseFastenerAttributes.js";

/**
 * Normalizes a possible value into a trimmed string.
 */
function asString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

/**
 * Normalizes a possible numeric value.
 */
function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Creates a simple stable JSON string for hashing/comparison later if needed.
 * For now this is just a placeholder helper.
 */
function makeSimpleHash(obj = {}) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "";
  }
}

/**
 * Maps raw Fishbowl-ish input into the Product schema shape.
 * This is intentionally flexible because your real Fishbowl payload shape
 * may differ once you connect to it.
 */
function mapFishbowlProduct(input = {}) {
  const fishbowlPartId = asString(input.partId || input.id);
  const fishbowlPartNum = asString(input.partNum || input.num || input.partNumber);
  const sku = asString(
    input.sku || input.internalPartNumber || fishbowlPartNum || fishbowlPartId
  );

  if (!sku) {
    throw new Error("Unable to determine sku for product");
  }

  if (!fishbowlPartId && !fishbowlPartNum) {
    throw new Error("Fishbowl product must include partId or partNum");
  }

  const parserSourceText = asString(
    input.description ||
      input.partDescription ||
      input.name ||
      input.partNum ||
      input.num ||
      ""
  );

  const parsed = parseFastenerAttributes(parserSourceText);

  const fishbowlBlock = {
    partId: fishbowlPartId,
    partNum: fishbowlPartNum,
    uom: asString(input.uom),
    status: asString(input.status),
    type: asString(input.type),
    description: asString(input.description),
    active:
      typeof input.active === "boolean"
        ? input.active
        : typeof input.isActive === "boolean"
        ? input.isActive
        : true,
    raw: {
      original: input.raw ?? input,
      parsedAttributes: parsed,
    },
    lastSyncedAt: new Date(),
  };

  const inventoryBlock = {
    qtyOnHand: asNumber(input.qtyOnHand, 0),
    qtyAvailable: asNumber(input.qtyAvailable, 0),
    qtyAllocated: asNumber(input.qtyAllocated, 0),
    qtyOnOrder: asNumber(input.qtyOnOrder, 0),
    lastSyncedAt: new Date(),
  };

  const pricingBlock = {
    cost:
      input.cost === null || input.cost === undefined
        ? null
        : asNumber(input.cost, 0),
    basePrice:
      input.basePrice === null || input.basePrice === undefined
        ? null
        : asNumber(input.basePrice, 0),
    salePrice:
      input.salePrice === null || input.salePrice === undefined
        ? null
        : asNumber(input.salePrice, 0),
    currency: asString(input.currency, "USD"),
    priceSource: asString(input.priceSource || "fishbowl"),
    lastSyncedAt: new Date(),
  };

  return {
    sku,
    internalPartNumber: asString(input.internalPartNumber || input.sku || ""),
    vendor: asString(input.vendor || ""),
    brand: asString(input.brand || ""),
    fishbowl: fishbowlBlock,
    inventory: inventoryBlock,
    pricing: pricingBlock,

    categoryHints:
      Array.isArray(input.categoryHints) && input.categoryHints.length > 0
        ? input.categoryHints
        : [parsed.category, parsed.subcategory].filter(Boolean),

    searchKeywords:
      Array.isArray(input.searchKeywords) && input.searchKeywords.length > 0
        ? input.searchKeywords
        : parsed.keywords,

    sourceHashes: {
      fishbowlHash: makeSimpleHash(fishbowlBlock),
      inventoryHash: makeSimpleHash(inventoryBlock),
      pricingHash: makeSimpleHash(pricingBlock),
    },
  };
}

/**
 * Upserts a Product from Fishbowl data.
 *
 * Lookup priority:
 * 1) fishbowl.partId
 * 2) fishbowl.partNum
 * 3) sku
 */
export async function upsertProductFromFishbowl(input = {}) {
  const mapped = mapFishbowlProduct(input);

  let existingProduct = null;

  if (mapped.fishbowl.partId) {
    existingProduct = await Product.findOne({
      "fishbowl.partId": mapped.fishbowl.partId,
    });
  }

  if (!existingProduct && mapped.fishbowl.partNum) {
    existingProduct = await Product.findOne({
      "fishbowl.partNum": mapped.fishbowl.partNum,
    });
  }

  if (!existingProduct && mapped.sku) {
    existingProduct = await Product.findOne({
      sku: mapped.sku,
    });
  }

  if (!existingProduct) {
    const created = await Product.create({
      sku: mapped.sku,
      internalPartNumber: mapped.internalPartNumber,
      fishbowl: mapped.fishbowl,

      vendor: mapped.vendor,
      brand: mapped.brand,

      inventory: mapped.inventory,
      pricing: mapped.pricing,

      isActive: true,
      isPublished: false,
      isCurated: false,
      catalogStatus: "draft",
      hasEnrichment: false,
      hasImages: false,
      needsReview: true,

      categoryHints: mapped.categoryHints,
      searchKeywords: mapped.searchKeywords,

      sourceHashes: mapped.sourceHashes,
    });

    return {
      action: "created",
      product: created,
    };
  }

  existingProduct.sku = mapped.sku || existingProduct.sku;
  existingProduct.internalPartNumber =
    mapped.internalPartNumber || existingProduct.internalPartNumber;

  existingProduct.fishbowl = {
    ...existingProduct.fishbowl.toObject?.(),
    ...mapped.fishbowl,
  };

  existingProduct.inventory = mapped.inventory;
  existingProduct.pricing = mapped.pricing;

  existingProduct.vendor = existingProduct.vendor || mapped.vendor;
  existingProduct.brand = existingProduct.brand || mapped.brand;

  if (
    Array.isArray(mapped.categoryHints) &&
    mapped.categoryHints.length > 0 &&
    (!existingProduct.categoryHints || existingProduct.categoryHints.length === 0)
  ) {
    existingProduct.categoryHints = mapped.categoryHints;
  }

  if (
    Array.isArray(mapped.searchKeywords) &&
    mapped.searchKeywords.length > 0 &&
    (!existingProduct.searchKeywords || existingProduct.searchKeywords.length === 0)
  ) {
    existingProduct.searchKeywords = mapped.searchKeywords;
  }

  existingProduct.sourceHashes = mapped.sourceHashes;

  await existingProduct.save();

  return {
    action: "updated",
    product: existingProduct,
  };
}

export default upsertProductFromFishbowl;
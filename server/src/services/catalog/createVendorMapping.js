import Product from "../../models/Product.js";
import VendorOffering from "../../models/VendorOffering.js";
import VendorMapping from "../../models/VendorMapping.js";

function asString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function createVendorMapping(input = {}) {
  const productId = asString(input.productId);
  const vendorName = asString(input.vendorName);
  const vendorPartNumber = asString(input.vendorPartNumber);

  if (!productId) {
    throw new Error("productId is required");
  }

  if (!vendorName) {
    throw new Error("vendorName is required");
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  let vendorOffering = null;

  if (input.vendorOfferingId) {
    vendorOffering = await VendorOffering.findById(input.vendorOfferingId);

    if (!vendorOffering) {
      throw new Error("VendorOffering not found");
    }

    if (String(vendorOffering.productId) !== String(product._id)) {
      throw new Error("VendorOffering does not belong to the supplied product");
    }
  }

  const existing = await VendorMapping.findOne({
    productId: product._id,
    vendorName,
    vendorPartNumber,
  });

  if (existing) {
    return {
      action: "exists",
      mapping: existing,
      product,
      vendorOffering,
    };
  }

  if (input.isPrimaryMapping === true) {
    await VendorMapping.updateMany(
      { productId: product._id, vendorName },
      { $set: { isPrimaryMapping: false } }
    );
  }

  const mapping = await VendorMapping.create({
    productId: product._id,
    vendorOfferingId: vendorOffering?._id || null,

    vendorName,
    manufacturerName: asString(input.manufacturerName || vendorName),

    internalPartNumber: asString(
      input.internalPartNumber || product.internalPartNumber
    ),
    websiteSku: asString(input.websiteSku || product.sku),

    fishbowlPartId: asString(input.fishbowlPartId || product?.fishbowl?.partId),
    fishbowlPartNum: asString(input.fishbowlPartNum || product?.fishbowl?.partNum),

    vendorPartNumber,
    vendorAltPartNumbers: Array.isArray(input.vendorAltPartNumbers)
      ? input.vendorAltPartNumbers
      : [],

    vendorCategory: asString(input.vendorCategory),
    vendorDescription: asString(input.vendorDescription),

    matchMethod: asString(input.matchMethod || "manual"),
    confidenceScore: asNumber(input.confidenceScore, 100),

    approved:
      typeof input.approved === "boolean" ? input.approved : false,

    needsReview:
      typeof input.needsReview === "boolean" ? input.needsReview : true,

    isPrimaryMapping:
      typeof input.isPrimaryMapping === "boolean"
        ? input.isPrimaryMapping
        : false,

    notes: asString(input.notes),
    feedData: input.feedData ?? null,
  });

  return {
    action: "created",
    mapping,
    product,
    vendorOffering,
  };
}

export default createVendorMapping;
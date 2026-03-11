import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import createProductEnrichmentFromProduct from "./createProductEnrichmentFromProduct.js";

function asString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeUrl(url = "") {
  return asString(url).trim();
}

export async function attachVendorImageToProduct(input = {}) {
  const productId = asString(input.productId);
  const imageUrl = normalizeUrl(input.imageUrl);
  const vendorName = asString(input.vendorName);
  const vendorPartNumber = asString(input.vendorPartNumber);

  if (!productId) {
    throw new Error("productId is required");
  }

  if (!imageUrl) {
    return {
      action: "skipped",
      reason: "No imageUrl provided",
      enrichment: null,
    };
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  let enrichment = await ProductEnrichment.findOne({ productId: product._id });

  if (!enrichment) {
    const created = await createProductEnrichmentFromProduct(product._id);
    enrichment = created.enrichment;
  }

  const existingImage = enrichment.images.find(
    (img) => normalizeUrl(img.url) === imageUrl
  );

  if (existingImage) {
    return {
      action: "exists",
      reason: "Image already attached",
      enrichment,
    };
  }

  const hasPrimary = enrichment.images.some((img) => img.isPrimary);

  enrichment.images.push({
    url: imageUrl,
    alt: enrichment.title || product.fishbowl?.description || product.sku || "",
    sortOrder: enrichment.images.length,
    source: "vendor",
    sourceVendor: vendorName,
    sourcePartNumber: vendorPartNumber,
    isPrimary: !hasPrimary && enrichment.images.length === 0,
    needsReview: true,
    checksum: "",
    width: null,
    height: null,
    backgroundRemoved: false,
    cleaned: false,
  });

  if (enrichment.imageStatus === "none") {
    enrichment.imageStatus = "matched";
  } else if (enrichment.imageStatus === "approved") {
    // leave approved alone
  } else {
    enrichment.imageStatus = "partial";
  }

  await enrichment.save();

  if (!product.hasImages) {
    product.hasImages = true;
    await product.save();
  }

  return {
    action: "attached",
    reason: "Vendor image attached to enrichment",
    enrichment,
  };
}

export default attachVendorImageToProduct;
import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function evaluateProductPublishReadiness(productId) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const product = await Product.findById(productId).lean();

  if (!product) {
    throw new Error("Product not found");
  }

  const enrichment = await ProductEnrichment.findOne({ productId }).lean();

  const checks = {
    productExists: !!product,
    isActive: !!product.isActive,
    isCurated: !!product.isCurated,
    hasEnrichment: !!product.hasEnrichment,
    enrichmentExists: !!enrichment,
    hasTitle: hasNonEmptyString(enrichment?.title),
    hasDescription: hasNonEmptyString(enrichment?.description),
    hasCategory: hasNonEmptyString(enrichment?.category),
    hasSubcategory: hasNonEmptyString(enrichment?.subcategory),
    hasImages: Array.isArray(enrichment?.images) && enrichment.images.length > 0,
    hasApprovedOrMatchedImage:
      Array.isArray(enrichment?.images) &&
      enrichment.images.some((img) => img?.url),
    contentApprovedOrGenerated:
      enrichment?.contentStatus === "approved" ||
      enrichment?.contentStatus === "ready-review" ||
      enrichment?.contentStatus === "auto-mapped" ||
      enrichment?.contentStatus === "partially-written",
    imageUsable:
      enrichment?.imageStatus === "approved" ||
      enrichment?.imageStatus === "matched" ||
      enrichment?.imageStatus === "partial",
    notArchived: product.catalogStatus !== "archived",
  };

  const failures = Object.entries(checks)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    product,
    enrichment,
    checks,
    isReady: failures.length === 0,
    failures,
  };
}

export default evaluateProductPublishReadiness;
import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "./evaluateProductPublishReadiness.js";

export async function markProductReadyForPublish(productId) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const readiness = await evaluateProductPublishReadiness(productId);

  if (!readiness.isReady) {
    return {
      action: "blocked",
      reason: "Product is not ready for publish",
      readiness,
    };
  }

  const product = await Product.findById(productId);
  const enrichment = await ProductEnrichment.findOne({ productId });

  if (!product || !enrichment) {
    throw new Error("Product or enrichment not found");
  }

  product.catalogStatus = "ready";
  product.needsReview = false;

  if (enrichment.contentStatus !== "approved") {
    enrichment.contentStatus = "ready-review";
  }

  if (enrichment.imageStatus === "matched" || enrichment.imageStatus === "partial") {
    // leave as-is
  }

  await product.save();
  await enrichment.save();

  return {
    action: "ready",
    product,
    enrichment,
    readiness,
  };
}

export default markProductReadyForPublish;
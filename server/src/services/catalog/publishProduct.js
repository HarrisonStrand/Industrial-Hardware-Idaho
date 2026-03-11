import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "./evaluateProductPublishReadiness.js";

export async function publishProduct(productId) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const readiness = await evaluateProductPublishReadiness(productId);

  if (!readiness.isReady) {
    return {
      action: "blocked",
      reason: "Product is not publishable",
      readiness,
    };
  }

  const product = await Product.findById(productId);
  const enrichment = await ProductEnrichment.findOne({ productId });

  if (!product || !enrichment) {
    throw new Error("Product or enrichment not found");
  }

  product.isPublished = true;
  product.catalogStatus = "published";
  product.needsReview = false;

  if (enrichment.contentStatus === "ready-review") {
    enrichment.contentStatus = "approved";
  }

  if (enrichment.imageStatus === "matched") {
    enrichment.imageStatus = "approved";
  }

  await product.save();
  await enrichment.save();

  return {
    action: "published",
    product,
    enrichment,
    readiness,
  };
}

export default publishProduct;
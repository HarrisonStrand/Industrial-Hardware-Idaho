import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "./evaluateProductPublishReadiness.js";

export async function publishProduct(productId, actor = null) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const readiness = await evaluateProductPublishReadiness(productId);

  const product = await Product.findById(productId);
  const enrichment = await ProductEnrichment.findOne({ productId });

  if (!product || !enrichment) {
    throw new Error("Product or enrichment not found");
  }

  product.review = {
    ...(product.review?.toObject?.() || product.review || {}),
    qualityScore: readiness.completenessScore,
    renderable: readiness.renderable,
    publishReady: readiness.publishReady,
    missingRequiredAttributes: readiness.missingRequiredAttributes,
    missingRecommendedAttributes: readiness.missingRecommendedAttributes,
    issues: readiness.issues,
    suggestedFamilyKey: readiness.suggestedFamilyKey,
  };

  enrichment.quality = {
    ...(enrichment.quality?.toObject?.() || enrichment.quality || {}),
    builderReady: readiness.renderable,
    renderable: readiness.renderable,
    publishReady: readiness.publishReady,
    completenessScore: readiness.completenessScore,
    missingRequiredAttributes: readiness.missingRequiredAttributes,
    missingRecommendedAttributes: readiness.missingRecommendedAttributes,
    issues: readiness.issues,
    suggestedFamilyKey: readiness.suggestedFamilyKey,
    suggestedFamilyConfidence: readiness.suggestedFamilyConfidence,
    similarFamilies: readiness.similarFamilies,
    lastEvaluatedAt: new Date(),
  };

  if (!readiness.isReady) {
    product.needsReview = true;
    product.review.status = "needs-review";

    await product.save();
    await enrichment.save();

    return {
      action: "blocked",
      reason: "Product is not publishable",
      readiness,
      product,
      enrichment,
    };
  }

  product.isPublished = true;
  product.catalogStatus = "published";
  product.needsReview = false;
  product.review.status = "published";
  product.review.publishedAt = new Date();
  product.review.publishedBy = actor || null;

  if (!product.review.approvedAt) {
    product.review.approvedAt = new Date();
    product.review.approvedBy = actor || null;
  }

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
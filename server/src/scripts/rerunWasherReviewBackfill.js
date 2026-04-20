// server/src/scripts/rerunWasherReviewBackfill.js
import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mapReviewStatusFromReadiness(readiness = {}, product = {}) {
  if (product?.isPublished) return "published";
  if (product?.review?.status === "approved") return "approved";
  if (readiness?.publishReady) return "ready";
  return "needs-review";
}

async function recomputeAndPersist(productId) {
  const product = await Product.findById(productId);
  const enrichment = await ProductEnrichment.findOne({ productId });

  if (!product || !enrichment) {
    return { status: "skipped", productId };
  }

  const readiness = await evaluateProductPublishReadiness(productId, {
    includeSimilarFamilies: false,
  });

  const nextStatus = mapReviewStatusFromReadiness(readiness, product);

  product.review = {
    ...(asObject(product.review?.toObject?.() || product.review)),
    status: nextStatus,
    issues: readiness.issues || [],
    missingRequiredAttributes: readiness.missingRequiredAttributes || [],
    missingRecommendedAttributes: readiness.missingRecommendedAttributes || [],
    renderable: !!readiness.renderable,
    publishReady: !!readiness.publishReady,
    qualityScore: Number(readiness.qualityScore || 0),
    suggestedFamilyKey: readiness.suggestedFamilyKey || "",
    reviewedAt: new Date(),
  };

  product.needsReview = nextStatus === "needs-review";
  product.catalogStatus = product.isPublished
    ? "published"
    : readiness.publishReady
    ? "ready"
    : "enriched";

  enrichment.quality = {
    ...(asObject(enrichment.quality?.toObject?.() || enrichment.quality)),
    builderReady: !!readiness.builderReady,
    renderable: !!readiness.renderable,
    publishReady: !!readiness.publishReady,
    completenessScore: Number(readiness.qualityScore || 0),
    missingRequiredAttributes: readiness.missingRequiredAttributes || [],
    missingRecommendedAttributes: readiness.missingRecommendedAttributes || [],
    issues: readiness.issues || [],
    similarFamilies: [],
    suggestedFamilyKey: readiness.suggestedFamilyKey || "",
    suggestedFamilyConfidence: Number(readiness.suggestedFamilyConfidence || 0),
    lastEvaluatedAt: new Date(),
  };

  await product.save();
  await enrichment.save();

  return {
    status: "ok",
    reviewStatus: nextStatus,
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const enrichments = await ProductEnrichment.find(
    {
      $or: [
        { category: "washers" },
        { subcategory: /washer/i },
        { "attributes.familyType": /washer/i },
        { title: /washer/i },
        { "attributes.fishbowlDescription": /washer/i },
      ],
    },
    { productId: 1 }
  ).lean();

  const productIds = [...new Set(enrichments.map((item) => String(item.productId)))];
  console.log(`Found ${productIds.length} washer-related products`);

  const summary = {
    total: productIds.length,
    ok: 0,
    failed: 0,
    ready: 0,
    needsReview: 0,
    approved: 0,
    published: 0,
  };

  let processed = 0;

  for (const productId of productIds) {
    try {
      const result = await recomputeAndPersist(productId);

      processed += 1;
      if (processed % 100 === 0) {
        console.log(`Processed ${processed}/${productIds.length}`);
      }

      if (result.status === "ok") {
        summary.ok += 1;
        if (result.reviewStatus === "ready") summary.ready += 1;
        else if (result.reviewStatus === "needs-review") summary.needsReview += 1;
        else if (result.reviewStatus === "approved") summary.approved += 1;
        else if (result.reviewStatus === "published") summary.published += 1;
      } else {
        summary.failed += 1;
      }
    } catch (err) {
      processed += 1;
      summary.failed += 1;
      console.error(`FAIL | ${productId}`, err.message);
    }
  }

  console.log("===== WASHER REVIEW SUMMARY =====");
  console.log(summary);

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Washer review rerun failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
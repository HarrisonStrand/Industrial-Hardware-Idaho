// server/src/scripts/backfillProductReviewState.js
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
  if (!product) {
    return {
      status: "skipped",
      productId,
      reason: "Product not found",
    };
  }

  const enrichment = await ProductEnrichment.findOne({ productId });
  if (!enrichment) {
    product.review = {
      ...(asObject(product.review?.toObject?.() || product.review)),
      status: "needs-review",
      renderable: false,
      publishReady: false,
      qualityScore: 0,
      missingRequiredAttributes: ["enrichment"],
      missingRecommendedAttributes: [],
      issues: [
        {
          code: "MISSING_ENRICHMENT",
          severity: "error",
          field: "enrichment",
          message: "Product does not have enrichment.",
        },
      ],
      suggestedFamilyKey: "",
      reviewedAt: new Date(),
    };

    product.needsReview = true;
    if (!product.isPublished) {
      product.catalogStatus = "draft";
    }

    await product.save();

    return {
      status: "missing-enrichment",
      productId: String(product._id),
      sku: product.sku,
      partNumber: product?.fishbowl?.partNum || "",
    };
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
  product.hasEnrichment = true;

  if (product.isPublished) {
    product.catalogStatus = "published";
  } else if (readiness.publishReady) {
    product.catalogStatus = "ready";
  } else {
    product.catalogStatus = "enriched";
  }

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
    productId: String(product._id),
    sku: product.sku,
    partNumber: product?.fishbowl?.partNum || "",
    reviewStatus: nextStatus,
    publishReady: !!readiness.publishReady,
    renderable: !!readiness.renderable,
    qualityScore: Number(readiness.qualityScore || 0),
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const products = await Product.find({}, { _id: 1, sku: 1, "fishbowl.partNum": 1 }).lean();

  console.log(`Found ${products.length} products to backfill`);

  const summary = {
    total: products.length,
    ok: 0,
    missingEnrichment: 0,
    skipped: 0,
    failed: 0,
    ready: 0,
    needsReview: 0,
    approved: 0,
    published: 0,
  };

  let processed = 0;

  for (const product of products) {
    try {
      const result = await recomputeAndPersist(product._id);

      processed += 1;
      if (processed % 100 === 0) {
        console.log(`Processed ${processed}/${products.length}`);
      }

      if (result.status === "ok") {
        summary.ok += 1;

        if (result.reviewStatus === "ready") summary.ready += 1;
        else if (result.reviewStatus === "needs-review") summary.needsReview += 1;
        else if (result.reviewStatus === "approved") summary.approved += 1;
        else if (result.reviewStatus === "published") summary.published += 1;
      } else if (result.status === "missing-enrichment") {
        summary.missingEnrichment += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (err) {
      processed += 1;
      summary.failed += 1;
      console.error(`FAIL | ${product?.fishbowl?.partNum || product.sku || product._id}`, err.message);
    }
  }

  console.log("\n===== BACKFILL SUMMARY =====");
  console.log(summary);

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Backfill failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
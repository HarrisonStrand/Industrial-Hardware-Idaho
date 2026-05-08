import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";
import publishProduct from "../services/catalog/publishProduct.js";

function hasNoIssues(issues = []) {
  return Array.isArray(issues) && issues.length === 0;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const candidates = await Product.find(
    {
      isPublished: false,
      isActive: true,
      "review.publishReady": true,
      "review.renderable": true,
      $or: [
        { "review.issues": { $exists: false } },
        { "review.issues": { $size: 0 } },
      ],
    },
    {
      _id: 1,
      sku: 1,
      "fishbowl.partNum": 1,
      "review.publishReady": 1,
      "review.renderable": 1,
      "review.issues": 1,
    },
  ).lean();

  console.log(`Found ${candidates.length} ready products with no saved issues`);

  const summary = {
    candidates: candidates.length,
    published: 0,
    skipped: 0,
    blocked: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    const productId = candidate._id;
    const partNumber = candidate?.fishbowl?.partNum || candidate?.sku || String(productId);

    try {
      const enrichment = await ProductEnrichment.findOne({ productId }).lean();
      if (!enrichment) {
        summary.skipped += 1;
        console.log(`SKIP no enrichment: ${partNumber}`);
        continue;
      }

      const readiness = await evaluateProductPublishReadiness(productId, {
        includeSimilarFamilies: false,
      });

      if (!readiness.publishReady || !readiness.renderable || !hasNoIssues(readiness.issues)) {
        summary.blocked += 1;
        console.log(
          `BLOCK ${partNumber} | publishReady=${readiness.publishReady} renderable=${readiness.renderable} issues=${Array.isArray(readiness.issues) ? readiness.issues.length : 0}`,
        );
        continue;
      }

      const result = await publishProduct(productId, "bulk-auto-publish-script");
      if (result?.action === "published") {
        summary.published += 1;
        console.log(`PUBLISHED ${partNumber}`);
      } else {
        summary.blocked += 1;
        console.log(`BLOCK ${partNumber} | action=${result?.action || "unknown"}`);
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`FAIL ${partNumber}:`, error.message);
    }
  }

  console.log("===== AUTO PUBLISH SUMMARY =====");
  console.log(summary);

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (error) => {
  console.error("❌ Auto publish failed:", error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

const BAD_PART_PATTERN = /(zz|void|delete)/i;
const TEST_PART_PATTERN = /^FB-/i;

function buildBadPartQuery() {
  return {
    $or: [
      { "fishbowl.partNum": BAD_PART_PATTERN },
      { sku: BAD_PART_PATTERN },
      { internalPartNumber: BAD_PART_PATTERN },
      { "fishbowl.partNum": TEST_PART_PATTERN },
      { sku: TEST_PART_PATTERN },
      { internalPartNumber: TEST_PART_PATTERN },
    ],
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const products = await Product.find(
    buildBadPartQuery(),
    {
      _id: 1,
      enrichmentId: 1,
      sku: 1,
      internalPartNumber: 1,
      "fishbowl.partNum": 1,
      "fishbowl.description": 1,
      isPublished: 1,
      catalogStatus: 1,
    }
  ).lean();

const safeProducts = products.filter((p) => !p.isPublished);
const productIds = safeProducts.map((p) => p._id);
const enrichmentIds = safeProducts.map((p) => p.enrichmentId).filter(Boolean);

  console.log(`Found ${products.length} products to delete`);

  if (!products.length) {
    await mongoose.disconnect();
    console.log("✅ Nothing to delete");
    return;
  }

  const publishedCount = products.filter((p) => p.isPublished).length;
  if (publishedCount > 0) {
    console.log(
      `⚠️ Warning: ${publishedCount} matching products are currently published`
    );
  }

  const enrichmentDeleteResult = await ProductEnrichment.deleteMany({
    $or: [
      { productId: { $in: productIds } },
      { _id: { $in: enrichmentIds } },
    ],
  });

  const productDeleteResult = await Product.deleteMany({
    _id: { $in: productIds },
  });

  console.log("===== DELETE SUMMARY =====");
  console.log({
    matchedProducts: products.length,
    deletedProducts: productDeleteResult.deletedCount || 0,
    deletedEnrichments: enrichmentDeleteResult.deletedCount || 0,
  });

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Delete failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
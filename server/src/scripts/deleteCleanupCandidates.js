import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

const BAD_PART_PATTERN = /(zz|void|delete)/i;

function clean(value = "") {
  return String(value || "").trim();
}

function startsWithStar(value = "") {
  return /^\*/.test(clean(value));
}

function shouldDeleteByIdentifiers(product) {
  const partNum = product?.fishbowl?.partNum || "";
  const sku = product?.sku || "";
  const internalPartNumber = product?.internalPartNumber || "";

  return (
    BAD_PART_PATTERN.test(partNum) ||
    BAD_PART_PATTERN.test(sku) ||
    BAD_PART_PATTERN.test(internalPartNumber) ||
    startsWithStar(partNum) ||
    startsWithStar(sku) ||
    startsWithStar(internalPartNumber)
  );
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const products = await Product.find(
    {
      $or: [
        { "fishbowl.partNum": BAD_PART_PATTERN },
        { sku: BAD_PART_PATTERN },
        { internalPartNumber: BAD_PART_PATTERN },
        { "fishbowl.partNum": /^\*/ },
        { sku: /^\*/ },
        { internalPartNumber: /^\*/ },
        { "fishbowl.description": /^\*/ },
      ],
    },
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
  const deleteByIdFields = safeProducts.filter(shouldDeleteByIdentifiers);

  // optional: include description-star products too
  const deleteByDescriptionOnly = safeProducts.filter(
    (p) =>
      !shouldDeleteByIdentifiers(p) &&
      startsWithStar(p?.fishbowl?.description || "")
  );

  const finalDeleteSet = new Map();

  for (const row of [...deleteByIdFields, ...deleteByDescriptionOnly]) {
    finalDeleteSet.set(String(row._id), row);
  }

  const finalDeleteRows = Array.from(finalDeleteSet.values());
  const productIds = finalDeleteRows.map((p) => p._id);
  const enrichmentIds = finalDeleteRows.map((p) => p.enrichmentId).filter(Boolean);

  console.log(`Matched ${products.length} cleanup candidates`);
  console.log(`Skipping ${products.filter((p) => p.isPublished).length} published products`);
  console.log(`Deleting ${finalDeleteRows.length} non-published products`);

  if (!finalDeleteRows.length) {
    await mongoose.disconnect();
    console.log("✅ Nothing to delete");
    return;
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
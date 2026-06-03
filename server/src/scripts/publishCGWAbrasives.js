import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { clean } from "./cgwAbrasiveFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const showSamples = args.has("--samples");

const TARGET_SUBCATEGORIES = [
  "cut-off wheels",
  "flap wheels",
  "fibre discs",
  "twist lock discs",
  "velcro discs",
  "grinding wheels",
  "shop rolls",
  "hand pads",
];

function hasBuilderRequirements(enrichment = {}) {
  const attrs = enrichment.attributes || {};
  return Boolean(
    enrichment.category === "abrasives" &&
      TARGET_SUBCATEGORIES.includes(enrichment.subcategory) &&
      attrs.familyType &&
      enrichment.title,
  );
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");
if (dryRun) console.log("🔎 Dry run only");

const enrichments = await ProductEnrichment.find({
  category: "abrasives",
  subcategory: { $in: TARGET_SUBCATEGORIES },
});

const productIds = enrichments.map((item) => item.productId);
const products = await Product.find({ _id: { $in: productIds } });
const productMap = new Map(products.map((item) => [String(item._id), item]));

const totals = {
  candidateEnrichments: enrichments.length,
  missingProduct: 0,
  inactiveProduct: 0,
  alreadyPublished: 0,
  missingBuilderRequirements: 0,
  wouldPublish: 0,
  published: 0,
};

const samples = {
  wouldPublish: [],
  published: [],
  alreadyPublished: [],
  missingBuilderRequirements: [],
  inactiveProduct: [],
};

function push(key, value, max = 50) {
  if (samples[key].length < max) samples[key].push(value);
}

for (const enrichment of enrichments) {
  const product = productMap.get(String(enrichment.productId));
  const attrs = enrichment.attributes || {};
  const sample = {
    partNumber: clean(product?.fishbowl?.partNum || product?.sku || attrs.fishbowlPartNum || ""),
    title: enrichment.title,
    subcategory: enrichment.subcategory,
    familyType: attrs.familyType || "",
    size: attrs.size || "",
    grit: attrs.grit || "",
    abrasiveMaterial: attrs.abrasiveMaterial || "",
    attachment: attrs.attachment || "",
    wasPublished: Boolean(product?.isPublished),
    catalogStatus: product?.catalogStatus || "",
    reviewStatus: product?.review?.status || "",
  };

  if (!product) {
    totals.missingProduct += 1;
    push("missingBuilderRequirements", sample);
    continue;
  }
  if (product.isActive === false) {
    totals.inactiveProduct += 1;
    push("inactiveProduct", sample);
    continue;
  }
  if (product.isPublished) {
    totals.alreadyPublished += 1;
    push("alreadyPublished", sample);
    continue;
  }
  if (!hasBuilderRequirements(enrichment)) {
    totals.missingBuilderRequirements += 1;
    push("missingBuilderRequirements", sample);
    continue;
  }

  if (dryRun) {
    totals.wouldPublish += 1;
    push("wouldPublish", sample);
    continue;
  }

  product.isPublished = true;
  product.catalogStatus = "published";
  product.needsReview = false;
  product.review = {
    ...(product.review?.toObject?.() || product.review || {}),
    status: "published",
    publishReady: true,
    renderable: true,
    qualityScore: Math.max(product.review?.qualityScore || 0, 88),
    publishedAt: new Date(),
    reviewedAt: product.review?.reviewedAt || new Date(),
    missingRequiredAttributes: [],
    issues: [],
  };

  enrichment.contentStatus = enrichment.contentStatus === "approved" ? enrichment.contentStatus : "auto-mapped";
  enrichment.quality = {
    ...(enrichment.quality?.toObject?.() || enrichment.quality || {}),
    builderReady: true,
    renderable: true,
    publishReady: true,
    completenessScore: Math.max(enrichment.quality?.completenessScore || 0, 88),
    missingRequiredAttributes: [],
    issues: [],
    lastEvaluatedAt: new Date(),
  };

  await product.save();
  await enrichment.save();

  totals.published += 1;
  push("published", sample);
}

console.log("\n===== PUBLISH CGW ABRASIVES SUMMARY =====");
console.log(JSON.stringify(totals, null, 2));
if (showSamples) {
  console.log("\n===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

await mongoose.disconnect();
console.log("✅ Done");

import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

const TARGET_FAMILY_TYPES = new Set([
  "hex cap screw",
  "heavy hex bolt",
  "structural bolt",
  "socket head cap screw",
  "button head cap screw",
  "flat head cap screw",
  "flange bolt",
  "carriage bolt",
]);

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
  return clean(value).toLowerCase();
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function isRawFishbowlLooking(value = "") {
  const text = clean(value);
  return (
    /^\w{2,6}\d/i.test(text) ||
    /^c\/s\b/i.test(text) ||
    /^shcs\b/i.test(text) ||
    /^bhcs\b/i.test(text) ||
    /^mms[bfh]/i.test(text) ||
    /^a325sb/i.test(text) ||
    /imported from fishbowl/i.test(text)
  );
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function pushSample(samples, key, row, max = 12) {
  if (!samples[key]) samples[key] = [];
  if (samples[key].length < max) samples[key].push(row);
}

async function main() {
  const samplesEnabled = hasFlag("samples");
  const onlyFamily = normalize(argValue("family", ""));

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const query = {
    category: /^bolts$/i,
    "attributes.familyType": { $in: Array.from(TARGET_FAMILY_TYPES) },
  };

  if (onlyFamily) {
    query["attributes.familyType"] = new RegExp(`^${onlyFamily}$`, "i");
  }

  const enrichments = await ProductEnrichment.find(query, {
    productId: 1,
    title: 1,
    shortTitle: 1,
    description: 1,
    shortDescription: 1,
    bulletPoints: 1,
    images: 1,
    imageStatus: 1,
    contentStatus: 1,
    seo: 1,
    category: 1,
    subcategory: 1,
    attributes: 1,
  }).lean();

  const productIds = enrichments.map((item) => item.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } }, {
    sku: 1,
    "fishbowl.partNum": 1,
    review: 1,
    isPublished: 1,
  }).lean();
  const productMap = new Map(products.map((item) => [String(item._id), item]));

  const totals = {
    matched: enrichments.length,
    missingTitle: 0,
    rawTitle: 0,
    missingDescription: 0,
    shortDescriptionMissing: 0,
    missingBullets: 0,
    missingSeoTitle: 0,
    missingSeoDescription: 0,
    missingPrimaryImage: 0,
    invalidImageSource: 0,
    invalidImageStatus: 0,
    readyProductsMissingContent: 0,
    publishedProductsMissingContent: 0,
  };

  const byFamily = {};
  const samples = {};

  for (const enrichment of enrichments) {
    const product = productMap.get(String(enrichment.productId));
    const attrs = enrichment.attributes || {};
    const familyType = normalize(attrs.familyType || "unknown");
    increment(byFamily, familyType || "unknown");

    const partNumber = product?.fishbowl?.partNum || product?.sku || attrs.fishbowlPartNum || "";
    const row = {
      partNumber,
      familyType,
      title: enrichment.title || "",
      reviewStatus: product?.review?.status || "",
      isPublished: !!product?.isPublished,
    };

    const hasPrimaryImage = Array.isArray(enrichment.images) && enrichment.images.some((img) => img?.isPrimary && img?.url);
    const badImageSource = Array.isArray(enrichment.images) && enrichment.images.some(
      (img) => img?.source && !["vendor", "manual", "generated", "website", "unknown"].includes(img.source),
    );
    const badImageStatus = enrichment.imageStatus && !["none", "matched", "partial", "needs-cleanup", "approved"].includes(enrichment.imageStatus);

    const missingContent =
      !clean(enrichment.title) ||
      isRawFishbowlLooking(enrichment.title) ||
      !clean(enrichment.description) ||
      !Array.isArray(enrichment.bulletPoints) ||
      enrichment.bulletPoints.length === 0 ||
      !hasPrimaryImage;

    if (!clean(enrichment.title)) {
      totals.missingTitle += 1;
      if (samplesEnabled) pushSample(samples, "missingTitle", row);
    }

    if (isRawFishbowlLooking(enrichment.title || "")) {
      totals.rawTitle += 1;
      if (samplesEnabled) pushSample(samples, "rawTitle", row);
    }

    if (!clean(enrichment.description)) {
      totals.missingDescription += 1;
      if (samplesEnabled) pushSample(samples, "missingDescription", row);
    }

    if (!clean(enrichment.shortDescription)) totals.shortDescriptionMissing += 1;
    if (!Array.isArray(enrichment.bulletPoints) || enrichment.bulletPoints.length === 0) totals.missingBullets += 1;
    if (!clean(enrichment?.seo?.metaTitle)) totals.missingSeoTitle += 1;
    if (!clean(enrichment?.seo?.metaDescription)) totals.missingSeoDescription += 1;

    if (!hasPrimaryImage) {
      totals.missingPrimaryImage += 1;
      if (samplesEnabled) pushSample(samples, "missingPrimaryImage", row);
    }

    if (badImageSource) totals.invalidImageSource += 1;
    if (badImageStatus) totals.invalidImageStatus += 1;

    if ((product?.review?.status === "ready" || product?.review?.publishReady) && missingContent) {
      totals.readyProductsMissingContent += 1;
      if (samplesEnabled) pushSample(samples, "readyProductsMissingContent", row);
    }

    if (product?.isPublished && missingContent) {
      totals.publishedProductsMissingContent += 1;
      if (samplesEnabled) pushSample(samples, "publishedProductsMissingContent", row);
    }
  }

  console.log("===== BOLT CONTENT AUDIT =====");
  console.log(JSON.stringify({ totals, byFamily, samples: samplesEnabled ? samples : undefined }, null, 2));

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Bolt content audit failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

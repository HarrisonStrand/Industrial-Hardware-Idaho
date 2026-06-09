import "../config/env.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { clean, detectFlangeBoltProduct } from "./flangeBoltFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const showSamples = args.has("--samples");
const summaryOnly = args.has("--summary-only") || args.has("--summary");
const onlyUnparseable = args.has("--only-unparseable") || args.has("--unparseable");
const onlyMissingRequired = args.has("--only-missing-required") || args.has("--missing-required");
const jsonOutArg = process.argv.slice(2).find((arg) => arg.startsWith("--json-out="));
const jsonOutPath = jsonOutArg ? jsonOutArg.split("=").slice(1).join("=") : "";

function buildCandidateQuery() {
  return {
    $or: [
      { "fishbowl.partNum": /^SSFB/i },
      { "fishbowl.partNum": /^FB/i },
      { "fishbowl.partNum": /^MMFB/i },
      { sku: /^SSFB/i },
      { sku: /^FB/i },
      { sku: /^MMFB/i },
      { internalPartNumber: /^SSFB/i },
      { internalPartNumber: /^FB/i },
      { internalPartNumber: /^MMFB/i },
      { "fishbowl.description": /\bflange\s+bolt\b|\bflange\s+head\s+bolt\b|\bDIN\s*6921\b/i },
      { "fishbowl.description": /\bauveco\b.*\bflange\b.*\bbolt\b/i },
    ],
  };
}

function inc(obj, key) {
  obj[key || "(blank)"] = (obj[key || "(blank)"] || 0) + 1;
}

function pushSample(samples, key, value, max = 100) {
  if (!samples[key]) samples[key] = [];
  if (samples[key].length < max) samples[key].push(value);
}

function hasRequired(parsed = {}) {
  return Boolean(parsed.category && parsed.subcategory && parsed.familyType && parsed.measurementSystem && parsed.diameter && parsed.length && parsed.threadPitch && parsed.materialFinish && parsed.grade);
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");
console.log("🔎 Auditing flange bolts");

const products = await Product.find(buildCandidateQuery(), {
  _id: 1,
  sku: 1,
  internalPartNumber: 1,
  brand: 1,
  vendor: 1,
  "fishbowl.partNum": 1,
  "fishbowl.description": 1,
  isPublished: 1,
  catalogStatus: 1,
  review: 1,
}).lean();

const productIds = products.map((item) => item._id);
const enrichments = await ProductEnrichment.find({ productId: { $in: productIds } }, {
  productId: 1,
  title: 1,
  category: 1,
  subcategory: 1,
  attributes: 1,
}).lean();
const enrichmentMap = new Map(enrichments.map((item) => [String(item.productId), item]));

const totals = {
  candidates: products.length,
  parseable: 0,
  unparseable: 0,
  missingEnrichment: 0,
  alreadyPublished: 0,
  wrongCategory: 0,
  wrongSubcategory: 0,
  wrongFamilyType: 0,
  missingRequired: 0,
  needsReview: 0,
  ready: 0,
};

const counts = {
  measurementSystem: {},
  diameter: {},
  length: {},
  threadSeries: {},
  threadPitch: {},
  materialFinish: {},
  grade: {},
  headStandard: {},
  reviewStatus: {},
};

const samples = {};
const focused = { unparseable: [], missingRequired: [] };

for (const product of products) {
  const enrichment = enrichmentMap.get(String(product._id));
  const attrs = enrichment?.attributes || {};
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  const reviewStatus = product?.review?.status || "needs-review";
  const parsed = detectFlangeBoltProduct(product);

  inc(counts.reviewStatus, reviewStatus);
  if (reviewStatus === "needs-review") totals.needsReview += 1;
  if (reviewStatus === "ready") totals.ready += 1;
  if (product?.isPublished) totals.alreadyPublished += 1;
  if (!enrichment) totals.missingEnrichment += 1;

  const sample = {
    partNumber,
    description,
    brand: product.brand || "",
    vendor: product.vendor || "",
    currentTitle: enrichment?.title || "",
    currentCategory: enrichment?.category || "",
    currentSubcategory: enrichment?.subcategory || "",
    currentFamilyType: attrs.familyType || attrs.fastenerType || "",
    reviewStatus,
    parsed,
  };

  if (!parsed) {
    totals.unparseable += 1;
    pushSample(samples, "unparseable", { partNumber, description, brand: product.brand || "", vendor: product.vendor || "" }, 250);
    focused.unparseable.push({ partNumber, description, brand: product.brand || "", vendor: product.vendor || "" });
    continue;
  }

  totals.parseable += 1;
  inc(counts.measurementSystem, parsed.measurementSystem);
  inc(counts.diameter, parsed.diameter);
  inc(counts.length, parsed.length);
  inc(counts.threadSeries, parsed.threadSeries);
  inc(counts.threadPitch, parsed.threadPitch);
  inc(counts.materialFinish, parsed.materialFinish);
  inc(counts.grade, parsed.grade);
  inc(counts.headStandard, parsed.headStandard);

  if (enrichment?.category && enrichment.category !== parsed.category) {
    totals.wrongCategory += 1;
    pushSample(samples, "wrongCategory", sample);
  }
  if (enrichment?.subcategory && enrichment.subcategory !== parsed.subcategory) {
    totals.wrongSubcategory += 1;
    pushSample(samples, "wrongSubcategory", sample);
  }
  if ((attrs.familyType || attrs.fastenerType) && (attrs.familyType || attrs.fastenerType) !== parsed.familyType) {
    totals.wrongFamilyType += 1;
    pushSample(samples, "wrongFamilyType", sample);
  }
  if (!hasRequired(parsed)) {
    totals.missingRequired += 1;
    pushSample(samples, "missingRequired", sample);
    focused.missingRequired.push(sample);
  }

  if (showSamples) pushSample(samples, "parseable", sample, 50);
}

let focusedOutput = null;
if (onlyUnparseable) focusedOutput = focused.unparseable;
if (onlyMissingRequired) focusedOutput = focused.missingRequired;

const output = { totals, counts, samples: summaryOnly ? undefined : samples, focused: focusedOutput || undefined };

console.log("\n===== FLANGE BOLT AUDIT SUMMARY =====");
console.log(JSON.stringify({ totals, counts }, null, 2));
if (!summaryOnly && showSamples) {
  console.log("\n===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

if (jsonOutPath) {
  const absolute = path.resolve(jsonOutPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, JSON.stringify(focusedOutput || output, null, 2));
  console.log(`\n📝 Wrote ${absolute}`);
}

await mongoose.disconnect();
console.log("✅ Done");

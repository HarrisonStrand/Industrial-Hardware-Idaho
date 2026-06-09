import "../config/env.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { buildDescription, clean, detectHangerBoltProduct } from "./hangerBoltFamilyUtils.js";

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
      { "fishbowl.partNum": /^SSHB\d/i },
      { "fishbowl.partNum": /^MMHB\d/i },
      { "fishbowl.partNum": /^HB[CF]?\d/i },
      { sku: /^SSHB\d/i },
      { sku: /^MMHB\d/i },
      { sku: /^HB[CF]?\d/i },
      { internalPartNumber: /^SSHB\d/i },
      { internalPartNumber: /^MMHB\d/i },
      { internalPartNumber: /^HB[CF]?\d/i },
      { "fishbowl.description": /\bhanger\s+bolt\b|\bhangerbolt\b|\bhanger\s+bolt\s+driv/i },
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
  const isDriver = parsed.productType === "hanger bolt driver" || parsed.familyType === "hanger bolt driver";
  return Boolean(
    parsed.category &&
      parsed.subcategory &&
      parsed.familyType &&
      parsed.measurementSystem &&
      parsed.diameter &&
      (isDriver || parsed.length) &&
      parsed.materialFinish,
  );
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");
console.log("🔎 Auditing hanger bolts");

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
  productType: {},
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
  const parsed = detectHangerBoltProduct(product);

  inc(counts.reviewStatus, reviewStatus);
  if (reviewStatus === "needs-review") totals.needsReview += 1;
  if (reviewStatus === "ready") totals.ready += 1;
  if (product?.isPublished) totals.alreadyPublished += 1;
  if (!enrichment) totals.missingEnrichment += 1;

  const generatedDescription = parsed ? buildDescription(parsed) : "";

  const sample = {
    partNumber,
    sourceDescription: description,
    description: generatedDescription || description,
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
    pushSample(samples, "unparseable", { partNumber, sourceDescription: description, description, brand: product.brand || "", vendor: product.vendor || "" }, 250);
    focused.unparseable.push({ partNumber, sourceDescription: description, description, brand: product.brand || "", vendor: product.vendor || "" });
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
  inc(counts.productType, parsed.productType || parsed.familyType);

  if (enrichment?.category && enrichment.category !== parsed.category) totals.wrongCategory += 1;
  if (enrichment?.subcategory && enrichment.subcategory !== parsed.subcategory) totals.wrongSubcategory += 1;
  if (attrs.familyType && attrs.familyType !== parsed.familyType) totals.wrongFamilyType += 1;

  if (!hasRequired(parsed)) {
    totals.missingRequired += 1;
    focused.missingRequired.push(sample);
    pushSample(samples, "missingRequired", sample, 100);
  } else {
    pushSample(samples, "ready", sample, 75);
  }
}

const output = { totals, counts, samples: summaryOnly ? undefined : samples };
console.log("\n===== HANGER BOLTS AUDIT SUMMARY =====");
console.log(JSON.stringify(output, null, 2));

if (jsonOutPath) {
  const payload = onlyUnparseable ? focused.unparseable : onlyMissingRequired ? focused.missingRequired : { totals, counts, samples, focused };
  fs.mkdirSync(path.dirname(jsonOutPath), { recursive: true });
  fs.writeFileSync(jsonOutPath, JSON.stringify(payload, null, 2));
  console.log(`\n📄 Wrote ${jsonOutPath}`);
}

if (showSamples && summaryOnly) {
  console.log("\n===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

await mongoose.disconnect();
console.log("✅ Done");

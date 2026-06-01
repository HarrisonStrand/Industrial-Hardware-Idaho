import "../config/env.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { clean, detectThreadedRodProduct, normalize } from "./threadedRodFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const showSamples = args.has("--samples");
const summaryOnly = args.has("--summary-only") || args.has("--summary");
const onlyUnparseable = args.has("--only-unparseable") || args.has("--unparseable");
const jsonOutArg = process.argv.slice(2).find((arg) => arg.startsWith("--json-out="));
const jsonOutPath = jsonOutArg ? jsonOutArg.split("=").slice(1).join("=") : "";

function buildCandidateQuery() {
  return {
    $or: [
      { "fishbowl.partNum": /^(?:ALU|BRS)?(?:SS)?AT[CF]\d/i },
      { sku: /^(?:ALU|BRS)?(?:SS)?AT[CF]\d/i },
      { internalPartNumber: /^(?:ALU|BRS)?(?:SS)?AT[CF]\d/i },
      { "fishbowl.partNum": /^(?:ALU|BRS)?ATB7[CF]\d/i },
      { sku: /^(?:ALU|BRS)?ATB7[CF]\d/i },
      { internalPartNumber: /^(?:ALU|BRS)?ATB7[CF]\d/i },

      { "fishbowl.partNum": /^MMAT[CF]?\d/i },
      { sku: /^MMAT[CF]?\d/i },
      { internalPartNumber: /^MMAT[CF]?\d/i },
      { "fishbowl.description": /threaded\s*rod|all\s*thread|thread\s*rod/i },
    ],
  };
}

function inc(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

function pushSample(samples, key, value, max = 50) {
  if (!samples[key]) samples[key] = [];
  if (samples[key].length < max) samples[key].push(value);
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const products = await Product.find(buildCandidateQuery(), {
  _id: 1,
  sku: 1,
  internalPartNumber: 1,
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
  missingDiameter: 0,
  missingLength: 0,
  missingThreadPitch: 0,
  missingGrade: 0,
  wrongMaterialFinish: 0,
  needsReview: 0,
  ready: 0,
};

const counts = {
  familyCode: {},
  threadSeries: {},
  threadType: {},
  grade: {},
  materialFinish: {},
  origin: {},
  reviewStatus: {},
};

const samples = {};

for (const product of products) {
  const parsed = detectThreadedRodProduct(product);
  const enrichment = enrichmentMap.get(String(product._id));
  const attrs = enrichment?.attributes || {};
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  const reviewStatus = product?.review?.status || "needs-review";

  inc(counts.reviewStatus, reviewStatus);
  if (reviewStatus === "needs-review") totals.needsReview += 1;
  if (reviewStatus === "ready") totals.ready += 1;
  if (product?.isPublished) totals.alreadyPublished += 1;

  const sample = {
    partNumber,
    description,
    currentTitle: enrichment?.title || "",
    currentCategory: enrichment?.category || "",
    currentSubcategory: enrichment?.subcategory || "",
    currentFamilyType: attrs.familyType || attrs.fastenerType || "",
    currentMaterialFinish: attrs.materialFinish || "",
    currentGrade: attrs.grade || "",
    currentDiameter: attrs.diameter || "",
    currentLength: attrs.length || "",
    reviewStatus,
    parsed,
  };

  if (!parsed) {
    totals.unparseable += 1;
    pushSample(samples, "unparseable", sample);
    continue;
  }

  totals.parseable += 1;
  inc(counts.familyCode, parsed.familyCode);
  inc(counts.threadSeries, parsed.threadSeries || "(blank)");
  inc(counts.threadType, parsed.threadType || "(blank)");
  inc(counts.grade, parsed.grade || "(blank)");
  inc(counts.materialFinish, parsed.materialFinish || "(blank)");
  inc(counts.origin, parsed.origin || "(blank)");

  if (!enrichment) {
    totals.missingEnrichment += 1;
    pushSample(samples, "missingEnrichment", sample);
    continue;
  }

  if (normalize(enrichment.category) !== parsed.category) {
    totals.wrongCategory += 1;
    pushSample(samples, "wrongCategory", sample);
  }
  if (normalize(enrichment.subcategory) !== parsed.subcategory) {
    totals.wrongSubcategory += 1;
    pushSample(samples, "wrongSubcategory", sample);
  }
  if (normalize(attrs.familyType || attrs.fastenerType || "") !== parsed.familyType) {
    totals.wrongFamilyType += 1;
    pushSample(samples, "wrongFamilyType", sample);
  }
  if (!parsed.diameter) totals.missingDiameter += 1;
  if (!parsed.length) totals.missingLength += 1;
  if (!parsed.threadPitch) totals.missingThreadPitch += 1;
  if (!parsed.grade) totals.missingGrade += 1;
  if (attrs.materialFinish && normalize(attrs.materialFinish) !== parsed.materialFinish) {
    totals.wrongMaterialFinish += 1;
    pushSample(samples, "wrongMaterialFinish", sample);
  }
}

const output = { totals, counts };
if (showSamples || onlyUnparseable) output.samples = onlyUnparseable ? { unparseable: samples.unparseable || [] } : samples;

console.log("\n===== THREADED ROD AUDIT SUMMARY =====");
console.log(JSON.stringify({ totals, counts }, null, 2));

if ((showSamples || onlyUnparseable) && !summaryOnly) {
  console.log("\n===== SAMPLES =====");
  console.log(JSON.stringify(output.samples || {}, null, 2));
}

if (jsonOutPath) {
  const resolved = path.resolve(process.cwd(), jsonOutPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(output, null, 2));
  console.log(`\n📝 Wrote JSON audit to ${resolved}`);
}

await mongoose.disconnect();
console.log("✅ Done");

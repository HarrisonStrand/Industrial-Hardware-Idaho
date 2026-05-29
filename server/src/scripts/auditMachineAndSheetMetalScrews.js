import "../config/env.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { clean, detectScrewProduct, normalize } from "./screwFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const showSamples = args.has("--samples");
const summaryOnly = args.has("--summary-only") || args.has("--summary");
const onlyIssues = args.has("--only-issues") || args.has("--issues");
const onlyMissingDrive = args.has("--only-missing-drive") || args.has("--missing-drive");
const jsonOutArg = process.argv.slice(2).find((arg) => arg.startsWith("--json-out="));
const jsonOutPath = jsonOutArg ? jsonOutArg.split("=").slice(1).join("=") : "";

function buildCandidateQuery() {
  return {
    $or: [
      { "fishbowl.partNum": /^(?:SS)?MS[PFOTBHR]\d/i },
      { sku: /^(?:SS)?MS[PFOTBHR]\d/i },
      { internalPartNumber: /^(?:SS)?MS[PFOTBHR]\d/i },
      { "fishbowl.partNum": /^(?:SMS[PFTH]|SSSM[PFTH])\d/i },
      { sku: /^(?:SMS[PFTH]|SSSM[PFTH])\d/i },
      { internalPartNumber: /^(?:SMS[PFTH]|SSSM[PFTH])\d/i },
      { "fishbowl.description": /machine screw|sheet metal screw|s\/m screw|s\.m\. screw/i },
    ],
  };
}

function inc(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

function pushSample(samples, key, value, max = 25) {
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
  imageStatus: 1,
  contentStatus: 1,
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
  missingDriveType: 0,
  missingGrade: 0,
  wrongGrade: 0,
  wrongMaterialFinish: 0,
  needsReview: 0,
  ready: 0,
};

const counts = {
  productKind: {},
  familyCode: {},
  headType: {},
  driveType: {},
  grade: {},
  materialFinish: {},
  reviewStatus: {},
};

const samples = {};

for (const product of products) {
  const parsed = detectScrewProduct(product);
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
    currentHeadType: attrs.headType || "",
    currentDriveType: attrs.driveType || attrs.drive_type || "",
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
  inc(counts.productKind, parsed.productKind);
  inc(counts.familyCode, parsed.familyCode);
  inc(counts.headType, parsed.headType || "(blank)");
  inc(counts.driveType, parsed.driveType || "(blank)");
  inc(counts.grade, parsed.grade || "(blank)");
  inc(counts.materialFinish, parsed.materialFinish || "(blank)");

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

  if (normalize(attrs.familyType || attrs.fastenerType) !== parsed.familyType) {
    totals.wrongFamilyType += 1;
    pushSample(samples, "wrongFamilyType", sample);
  }

  if (!clean(attrs.diameter)) totals.missingDiameter += 1;
  if (!clean(attrs.length)) totals.missingLength += 1;
  if (!clean(attrs.driveType || attrs.drive_type)) {
    totals.missingDriveType += 1;
    pushSample(samples, "missingDriveType", sample, 200);
  }

  if (!clean(attrs.grade)) {
    totals.missingGrade += 1;
    pushSample(samples, "missingGrade", sample, 100);
  } else if (normalize(attrs.grade) !== normalize(parsed.grade)) {
    totals.wrongGrade += 1;
    pushSample(samples, "wrongGrade", sample, 100);
  }

  if (normalize(attrs.materialFinish) !== normalize(parsed.materialFinish)) {
    totals.wrongMaterialFinish += 1;
    pushSample(samples, "wrongMaterialFinish", sample);
  }
}

const issueSamples = Object.fromEntries(
  Object.entries(samples).filter(([, items]) => Array.isArray(items) && items.length > 0)
);

const output = {
  totals,
  counts,
  ...(showSamples || onlyIssues ? { samples: issueSamples } : {}),
  ...(onlyMissingDrive ? { missingDriveTypeParts: samples.missingDriveType || [] } : {}),
};

if (jsonOutPath) {
  const absolutePath = path.resolve(process.cwd(), jsonOutPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(output, null, 2)}
`);
  console.log(`✅ Wrote audit JSON: ${absolutePath}`);
}

console.log("===== MACHINE / SHEET METAL SCREW AUDIT SUMMARY =====");
console.log(JSON.stringify({ totals, counts }, null, 2));

if (!summaryOnly && !jsonOutPath) {
  if (onlyMissingDrive) {
    console.log("===== MISSING DRIVE TYPE PARTS =====");
    console.log(JSON.stringify(samples.missingDriveType || [], null, 2));
  } else if (showSamples || onlyIssues) {
    console.log("===== ISSUE SAMPLES =====");
    console.log(JSON.stringify(issueSamples, null, 2));
  }
}

await mongoose.disconnect();
console.log("✅ Done");

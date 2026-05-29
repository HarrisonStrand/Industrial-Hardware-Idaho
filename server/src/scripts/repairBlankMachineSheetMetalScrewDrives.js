import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import {
  clean,
  detectScrewProduct,
  fallbackDriveFromFamilyOrHead,
  inferDriveFromDescription,
  inferDriveFromPartSuffix,
  normalizeHexDriveType,
} from "./screwFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const showSamples = args.has("--samples");

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

function resolveDrive({ product = {}, parsed = {}, attrs = {} }) {
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  const headType = parsed.headType || attrs.headType || attrs.head_type || "";
  const familyCode = parsed.familyCode || attrs.familyCode || "";

  const candidate =
    parsed.driveType ||
    inferDriveFromDescription(`${partNumber} ${description}`) ||
    inferDriveFromPartSuffix(partNumber) ||
    fallbackDriveFromFamilyOrHead(familyCode, headType);

  return normalizeHexDriveType(headType, candidate);
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");
if (dryRun) console.log("🔎 Dry run only");

const products = await Product.find(buildCandidateQuery(), {
  _id: 1,
  sku: 1,
  internalPartNumber: 1,
  "fishbowl.partNum": 1,
  "fishbowl.description": 1,
}).lean();

const enrichments = await ProductEnrichment.find(
  { productId: { $in: products.map((item) => item._id) } },
  { productId: 1, title: 1, attributes: 1 }
);
const enrichmentMap = new Map(enrichments.map((item) => [String(item.productId), item]));

const summary = {
  candidates: products.length,
  blankDriveBefore: 0,
  repaired: 0,
  stillBlank: 0,
  skippedNoEnrichment: 0,
  skippedNoResolvedDrive: 0,
};

const samples = {
  repaired: [],
  stillBlank: [],
};

for (const product of products) {
  const enrichment = enrichmentMap.get(String(product._id));
  if (!enrichment) {
    summary.skippedNoEnrichment += 1;
    continue;
  }

  const attrs = enrichment.attributes || {};
  const currentDrive = clean(attrs.driveType || attrs.drive_type || "");
  if (currentDrive) continue;

  summary.blankDriveBefore += 1;

  const parsed = detectScrewProduct(product) || {};
  const resolvedDrive = resolveDrive({ product, parsed, attrs });
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");

  const sample = {
    partNumber,
    description,
    title: enrichment.title || "",
    headType: parsed.headType || attrs.headType || attrs.head_type || "",
    familyCode: parsed.familyCode || attrs.familyCode || "",
    resolvedDrive,
  };

  if (!resolvedDrive) {
    summary.stillBlank += 1;
    summary.skippedNoResolvedDrive += 1;
    if (samples.stillBlank.length < 25) samples.stillBlank.push(sample);
    continue;
  }

  summary.repaired += 1;
  if (samples.repaired.length < 25) samples.repaired.push(sample);

  if (!dryRun) {
    enrichment.attributes = {
      ...(enrichment.attributes?.toObject?.() || enrichment.attributes || {}),
      driveType: resolvedDrive,
      drive_type: resolvedDrive,
    };
    await enrichment.save();
  }
}

console.log("===== BLANK SCREW DRIVE REPAIR SUMMARY =====");
console.log(JSON.stringify(summary, null, 2));

if (showSamples) {
  console.log("===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

await mongoose.disconnect();
console.log("✅ Done");

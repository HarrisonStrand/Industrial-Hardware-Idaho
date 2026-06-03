import "../config/env.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { clean, detectCGWAbrasiveProduct, isClearlyNotRequestedCGWAbrasive } from "./cgwAbrasiveFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const showSamples = args.has("--samples");
const summaryOnly = args.has("--summary-only") || args.has("--summary");
const onlyUnparseable = args.has("--only-unparseable") || args.has("--unparseable");
const onlyMissingSize = args.has("--only-missing-size");
const onlyMissingGrit = args.has("--only-missing-grit");
const onlyMissingAbrasiveMaterial = args.has("--only-missing-abrasive-material") || args.has("--only-missing-material");
const subcategoryArg = process.argv.slice(2).find((arg) => arg.startsWith("--subcategory="));
const subcategoryFilter = subcategoryArg ? subcategoryArg.split("=").slice(1).join("=").trim().toLowerCase() : "";
const jsonOutArg = process.argv.slice(2).find((arg) => arg.startsWith("--json-out="));
const jsonOutPath = jsonOutArg ? jsonOutArg.split("=").slice(1).join("=") : "";

function buildCandidateQuery() {
  return {
    $or: [
      { brand: /\bCGW\b|CAMEL/i },
      { vendor: /\bCGW\b|CAMEL/i },
      { "fishbowl.partNum": /^CGW/i },
      { sku: /^CGW/i },
      { internalPartNumber: /^CGW/i },
      { "fishbowl.description": /\bCGW\b|CAMEL\s+GRINDING|CAMEL\s+WHEEL/i },
      { "fishbowl.description": /cut\s*-?\s*off|cutoff|cutting\s+wheel|flap\b|fibre\s+disc|fiber\s+disc|twist\s*lock|quick\s*change|roloc|velcro|hook\s*(?:&|and)?\s*loop|grinding\s*w(?:heel|hl)|shop\s*roll|hand\s*pad|surface\s*conditioning\s*pad/i },
    ],
  };
}

function inc(obj, key) {
  obj[key || "(blank)"] = (obj[key || "(blank)"] || 0) + 1;
}

function pushSample(samples, key, value, max = 50) {
  if (!samples[key]) samples[key] = [];
  if (samples[key].length < max) samples[key].push(value);
}

function shouldRequireGrit(parsed = {}) {
  // Cut-off wheels and most grinding wheels often do not expose grit in the Fishbowl description;
  // for those, size + family is enough for this first builder pass.
  if (["cut-off-wheel", "grinding-wheel"].includes(parsed.productKind)) return false;
  // Buffing discs and holders/adapters can be valid twist-lock accessories without grit.
  if (/\bbuff\b/i.test(parsed.familyTitleBase || "")) return false;
  return ["flap-wheel", "fibre-disc", "twist-lock-disc", "velcro-disc", "shop-roll", "hand-pad"].includes(parsed.productKind);
}

function shouldRequireAbrasiveMaterial(parsed = {}) {
  // Keep material as a parsed facet when the description gives it, but do not treat it as required.
  // CGW descriptions often omit material for otherwise valid abrasive items.
  return false;
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

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
  skippedExcluded: 0,
  missingEnrichment: 0,
  alreadyPublished: 0,
  wrongCategory: 0,
  wrongSubcategory: 0,
  wrongFamilyType: 0,
  missingSize: 0,
  missingGrit: 0,
  missingAbrasiveMaterial: 0,
  needsReview: 0,
  ready: 0,
};

const counts = {
  subcategory: {},
  familyType: {},
  grit: {},
  abrasiveMaterial: {},
  attachment: {},
  wheelType: {},
  reviewStatus: {},
};

const samples = {};
const focused = {
  unparseable: [],
  missingSize: [],
  missingGrit: [],
  missingAbrasiveMaterial: [],
};

function matchesSubcategory(parsed) {
  if (!subcategoryFilter) return true;
  return String(parsed?.subcategory || "").toLowerCase() === subcategoryFilter;
}

function pushFocused(key, value, max = 500) {
  if (!focused[key]) focused[key] = [];
  if (focused[key].length < max) focused[key].push(value);
}

for (const product of products) {
  const enrichment = enrichmentMap.get(String(product._id));
  const attrs = enrichment?.attributes || {};
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  const reviewStatus = product?.review?.status || "needs-review";

  if (isClearlyNotRequestedCGWAbrasive({ part: partNumber, description })) {
    totals.skippedExcluded += 1;
    pushSample(samples, "skippedExcluded", { partNumber, description, brand: product.brand || "", vendor: product.vendor || "" }, 100);
    continue;
  }

  const parsed = detectCGWAbrasiveProduct(product);

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
    currentSize: attrs.size || "",
    currentGrit: attrs.grit || "",
    currentAbrasiveMaterial: attrs.abrasiveMaterial || "",
    reviewStatus,
    parsed,
  };

  if (!parsed) {
    totals.unparseable += 1;
    pushSample(samples, "unparseable", { partNumber, description, brand: product.brand || "", vendor: product.vendor || "" }, 250);
    pushFocused("unparseable", { partNumber, description, brand: product.brand || "", vendor: product.vendor || "" });
    continue;
  }

  totals.parseable += 1;
  inc(counts.subcategory, parsed.subcategory);
  inc(counts.familyType, parsed.familyType);
  inc(counts.grit, parsed.grit || "(blank)");
  inc(counts.abrasiveMaterial, parsed.abrasiveMaterial || "(blank)");
  inc(counts.attachment, parsed.attachment || "(blank)");
  inc(counts.wheelType, parsed.wheelType || "(blank)");

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
  if (!parsed.size && !parsed.diameter) {
    totals.missingSize += 1;
    pushSample(samples, "missingSize", sample);
    if (matchesSubcategory(parsed)) pushFocused("missingSize", sample);
  }
  if (shouldRequireGrit(parsed) && !parsed.grit) {
    totals.missingGrit += 1;
    pushSample(samples, "missingGrit", sample);
    if (matchesSubcategory(parsed)) pushFocused("missingGrit", sample);
  }
  if (shouldRequireAbrasiveMaterial(parsed) && !parsed.abrasiveMaterial) {
    totals.missingAbrasiveMaterial += 1;
    pushSample(samples, "missingAbrasiveMaterial", sample);
    if (matchesSubcategory(parsed)) pushFocused("missingAbrasiveMaterial", sample);
  }

  if (showSamples) pushSample(samples, "parseable", sample, 50);
}

let focusedOutput = null;
if (onlyUnparseable) focusedOutput = focused.unparseable;
if (onlyMissingSize) focusedOutput = focused.missingSize;
if (onlyMissingGrit) focusedOutput = focused.missingGrit;
if (onlyMissingAbrasiveMaterial) focusedOutput = focused.missingAbrasiveMaterial;

const output = {
  totals,
  counts,
  ...(focusedOutput ? { focused: focusedOutput } : {}),
  ...(summaryOnly ? {} : { samples }),
};

console.log("\n===== CGW ABRASIVES AUDIT SUMMARY =====");
console.log(JSON.stringify({ totals, counts }, null, 2));

if (onlyUnparseable) {
  console.log("\n===== CGW ABRASIVES UNPARSEABLE =====");
  console.log(JSON.stringify(focused.unparseable || [], null, 2));
} else if (onlyMissingSize) {
  console.log("\n===== CGW ABRASIVES MISSING SIZE =====");
  console.log(JSON.stringify(focused.missingSize || [], null, 2));
} else if (onlyMissingGrit) {
  console.log("\n===== CGW ABRASIVES MISSING GRIT =====");
  console.log(JSON.stringify(focused.missingGrit || [], null, 2));
} else if (onlyMissingAbrasiveMaterial) {
  console.log("\n===== CGW ABRASIVES MISSING ABRASIVE MATERIAL =====");
  console.log(JSON.stringify(focused.missingAbrasiveMaterial || [], null, 2));
} else if (showSamples && !summaryOnly) {
  console.log("\n===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

if (jsonOutPath) {
  const resolved = path.resolve(jsonOutPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(output, null, 2));
  console.log(`\n📝 Wrote JSON audit to ${resolved}`);
}

await mongoose.disconnect();
console.log("✅ Done");

import "../config/env.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { clean, normalize, suggestTaxonomy, needsTaxonomyChange, matchesFamilyFilter } from "./taxonomySuggestionUtils.js";

const args = new Set(process.argv.slice(2));
const summaryOnly = args.has("--summary-only") || args.has("--summary");
const onlyProposed = args.has("--only-proposed");
const onlyChanges = args.has("--only-changes");
const showSamples = args.has("--samples");
const familyArg = process.argv.slice(2).find((arg) => arg.startsWith("--family="));
const familyFilter = familyArg ? normalize(familyArg.split("=").slice(1).join("=")) : "";
const limitArg = process.argv.slice(2).find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=").slice(1).join("=")) || 0 : 0;
const jsonOutArg = process.argv.slice(2).find((arg) => arg.startsWith("--json-out="));
const jsonOutPath = jsonOutArg ? jsonOutArg.split("=").slice(1).join("=") : "";

function inc(obj, key) {
  const label = clean(key) || "(blank)";
  obj[label] = (obj[label] || 0) + 1;
}

function pushSample(samples, key, value, max = 75) {
  if (!samples[key]) samples[key] = [];
  if (samples[key].length < max) samples[key].push(value);
}

function familyMatches(proposed) {
  return matchesFamilyFilter(proposed, familyFilter);
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const productQuery = {
  isActive: { $ne: false },
  $or: [
    { isPublished: true },
    { hasEnrichment: true },
    { catalogStatus: { $in: ["mapped", "enriched", "ready", "published"] } },
    { categoryHints: { $exists: true, $ne: [] } },
    { "fishbowl.description": /drill|driver|bit|nut setter|hanger bolt driver|hole saw|arbor|tap|die|paint|silicone|caulk|sealant|brake clean|crc|anti[- ]?seize|cutting fluid|tapping fluid|drilling fluid|adhesive|threadlocker|lubricant|penetrant/i },
  ],
};

const products = await Product.find(productQuery, {
  _id: 1,
  sku: 1,
  internalPartNumber: 1,
  brand: 1,
  vendor: 1,
  categoryHints: 1,
  isPublished: 1,
  catalogStatus: 1,
  "fishbowl.partNum": 1,
  "fishbowl.description": 1,
}).limit(limit || 0).lean();

const productIds = products.map((product) => product._id);
const enrichments = await ProductEnrichment.find({ productId: { $in: productIds } }, {
  productId: 1,
  title: 1,
  description: 1,
  category: 1,
  subcategory: 1,
  attributes: 1,
  websiteBrand: 1,
  websiteVendor: 1,
}).lean();

const enrichmentByProductId = new Map(enrichments.map((enrichment) => [String(enrichment.productId), enrichment]));

const totals = {
  scanned: products.length,
  withEnrichment: enrichments.length,
  proposed: 0,
  proposedChanges: 0,
};

const counts = {
  currentCategory: {},
  currentSubcategory: {},
  proposedCategory: {},
  proposedSubcategory: {},
  proposedReason: {},
  changePair: {},
};

const samples = {};
const rows = [];

for (const product of products) {
  const enrichment = enrichmentByProductId.get(String(product._id)) || {};
  const current = {
    category: clean(enrichment.category || product.categoryHints?.[0] || ""),
    subcategory: clean(enrichment.subcategory || product.categoryHints?.[1] || ""),
  };
  const proposed = suggestTaxonomy(product, enrichment);
  const hasProposal = Boolean(proposed);
  const isChange = needsTaxonomyChange(current, proposed);

  inc(counts.currentCategory, current.category);
  inc(counts.currentSubcategory, current.subcategory);

  if (hasProposal && familyMatches(proposed)) {
    totals.proposed += 1;
    inc(counts.proposedCategory, proposed.category);
    inc(counts.proposedSubcategory, proposed.subcategory);
    inc(counts.proposedReason, proposed.reason);

    if (isChange) {
      totals.proposedChanges += 1;
      inc(counts.changePair, `${current.category || "(blank)"} / ${current.subcategory || "(blank)"} -> ${proposed.category} / ${proposed.subcategory}`);
    }
  }

  if ((!hasProposal && onlyProposed) || (!isChange && onlyChanges) || (hasProposal && !familyMatches(proposed))) continue;

  const row = {
    partNumber: clean(product.fishbowl?.partNum || product.sku || product.internalPartNumber),
    description: clean(product.fishbowl?.description),
    title: clean(enrichment.title),
    currentCategory: current.category,
    currentSubcategory: current.subcategory,
    proposedCategory: proposed?.category || "",
    proposedSubcategory: proposed?.subcategory || "",
    reason: proposed?.reason || "",
    confidence: proposed?.confidence || 0,
    wouldChange: isChange,
    isPublished: Boolean(product.isPublished),
    catalogStatus: product.catalogStatus || "",
  };

  rows.push(row);
  if (hasProposal) pushSample(samples, isChange ? "proposedChanges" : "proposedAlreadyAligned", row);
}

const output = { totals, counts, samples: showSamples || !summaryOnly ? samples : undefined, rows: summaryOnly && !jsonOutPath ? undefined : rows };

console.log(JSON.stringify(output, null, 2));

if (jsonOutPath) {
  const absolute = path.resolve(jsonOutPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, JSON.stringify({ totals, counts, samples, rows }, null, 2));
  console.log(`\n📝 Wrote ${rows.length} rows to ${absolute}`);
}

await mongoose.disconnect();

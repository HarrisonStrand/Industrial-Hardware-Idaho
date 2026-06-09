import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { clean, normalize, suggestTaxonomy, needsTaxonomyChange, matchesFamilyFilter } from "./taxonomySuggestionUtils.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--apply");
const showSamples = args.has("--samples");
const familyArg = process.argv.slice(2).find((arg) => arg.startsWith("--family="));
const familyFilter = familyArg ? normalize(familyArg.split("=").slice(1).join("=")) : "";
const includeChemicals = args.has("--include-chemicals");

function familyMatches(proposed) {
  return matchesFamilyFilter(proposed, familyFilter);
}

function isSafeToApply(proposed = {}) {
  const category = normalize(proposed.category);
  if (category === "bits & drivers") return true;
  if (category === "chemicals, paints & sealants") return includeChemicals;
  return false;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function sampleRow(product, enrichment, proposed) {
  return {
    partNumber: clean(product.fishbowl?.partNum || product.sku || product.internalPartNumber),
    description: clean(product.fishbowl?.description),
    title: clean(enrichment.title),
    before: {
      category: clean(enrichment.category),
      subcategory: clean(enrichment.subcategory),
      categoryHints: product.categoryHints || [],
    },
    after: {
      category: proposed.category,
      subcategory: proposed.subcategory,
    },
    reason: proposed.reason,
  };
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");
console.log(dryRun ? "🔎 Dry run only. Use --apply to write changes." : "⚠️ APPLY MODE: taxonomy changes will be written.");

const products = await Product.find({
  isActive: { $ne: false },
  $or: [
    { hasEnrichment: true },
    { isPublished: true },
    { categoryHints: { $exists: true, $ne: [] } },
    { "fishbowl.description": /drill|driver|bit|nut setter|hanger bolt driver|hole saw|arbor|tap|die|paint|silicone|caulk|sealant|brake clean|crc|anti[- ]?seize|cutting fluid|tapping fluid|drilling fluid|adhesive|threadlocker|lubricant|penetrant/i },
  ],
}, {
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
}).lean();

const productIds = products.map((product) => product._id);
const enrichments = await ProductEnrichment.find({ productId: { $in: productIds } }).lean();
const enrichmentByProductId = new Map(enrichments.map((enrichment) => [String(enrichment.productId), enrichment]));

const totals = {
  scanned: products.length,
  wouldUpdate: 0,
  updated: 0,
  skippedNoEnrichment: 0,
  skippedNoProposal: 0,
  skippedAlreadyAligned: 0,
  skippedFamilyFilter: 0,
  skippedUnsafeChemicalUnlessIncluded: 0,
};
const samples = [];

for (const product of products) {
  const enrichment = enrichmentByProductId.get(String(product._id));
  if (!enrichment) {
    totals.skippedNoEnrichment += 1;
    continue;
  }

  const proposed = suggestTaxonomy(product, enrichment);
  if (!proposed) {
    totals.skippedNoProposal += 1;
    continue;
  }
  if (!familyMatches(proposed)) {
    totals.skippedFamilyFilter += 1;
    continue;
  }
  if (!isSafeToApply(proposed)) {
    totals.skippedUnsafeChemicalUnlessIncluded += 1;
    continue;
  }

  const current = { category: enrichment.category, subcategory: enrichment.subcategory };
  if (!needsTaxonomyChange(current, proposed)) {
    totals.skippedAlreadyAligned += 1;
    continue;
  }

  totals.wouldUpdate += 1;
  if (showSamples && samples.length < 75) samples.push(sampleRow(product, enrichment, proposed));

  if (!dryRun) {
    const nextAttributes = {
      ...(enrichment.attributes || {}),
      categoryCanonical: proposed.category,
      subcategoryCanonical: proposed.subcategory,
    };

    await ProductEnrichment.updateOne(
      { _id: enrichment._id },
      {
        $set: {
          category: proposed.category,
          subcategory: proposed.subcategory,
          attributes: nextAttributes,
        },
      }
    );

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          categoryHints: uniqueStrings([proposed.category, proposed.subcategory, ...(product.categoryHints || [])]),
        },
      }
    );

    totals.updated += 1;
  }
}

console.log(JSON.stringify({ totals, samples: showSamples ? samples : undefined }, null, 2));
await mongoose.disconnect();

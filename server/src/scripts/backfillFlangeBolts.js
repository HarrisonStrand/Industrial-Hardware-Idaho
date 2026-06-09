import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import {
  attributesFromParsed,
  buildDescription,
  buildSeoSlug,
  buildTags,
  clean,
  detectFlangeBoltProduct,
  uniqueStrings,
} from "./flangeBoltFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const showSamples = args.has("--samples");
const markReady = args.has("--mark-ready");

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

function hasRequired(parsed = {}) {
  return Boolean(parsed.category && parsed.subcategory && parsed.familyType && parsed.measurementSystem && parsed.diameter && parsed.length && parsed.threadPitch && parsed.materialFinish && parsed.grade);
}

function buildReviewPatch(parsed = {}, product = {}) {
  const ready = hasRequired(parsed);
  return {
    ...(product.review?.toObject?.() || product.review || {}),
    status: ready ? "ready" : "needs-review",
    publishReady: ready,
    renderable: ready,
    qualityScore: ready ? 90 : 50,
    missingRequiredAttributes: ready ? [] : ["parsed flange bolt attributes"],
    missingRecommendedAttributes: [],
    issues: ready ? [] : [
      {
        code: "FLANGE_BOLT_PARSE_INCOMPLETE",
        severity: "warning",
        field: "attributes",
        message: "Flange bolt attributes could not be fully parsed from the part number or description.",
      },
    ],
    reviewedAt: new Date(),
  };
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");
if (dryRun) console.log("🔎 Dry run only");

const products = await Product.find(buildCandidateQuery());

const totals = {
  candidates: products.length,
  parseable: 0,
  unparseable: 0,
  createdEnrichment: 0,
  updatedEnrichment: 0,
  updatedProductReview: 0,
};

const samples = { updated: [], unparseable: [] };

for (const product of products) {
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  const parsed = detectFlangeBoltProduct(product);

  if (!parsed) {
    totals.unparseable += 1;
    if (samples.unparseable.length < 100) samples.unparseable.push({ partNumber, description });
    continue;
  }

  totals.parseable += 1;
  let enrichment = await ProductEnrichment.findOne({ productId: product._id });
  const isNew = !enrichment;
  if (!enrichment) enrichment = new ProductEnrichment({ productId: product._id });

  const attrs = attributesFromParsed(parsed, product, enrichment.attributes || {});
  const title = parsed.title || enrichment.title || description || partNumber;
  const seoSlug = buildSeoSlug(parsed, partNumber);

  enrichment.title = title;
  enrichment.shortTitle = parsed.shortTitle || title;
  enrichment.description = enrichment.overrideFlags?.lockDescription ? enrichment.description : buildDescription(parsed);
  enrichment.shortDescription = parsed.shortTitle || title;
  enrichment.bulletPoints = parsed.bulletPoints || [];
  enrichment.websiteBrand = parsed.headStandard === "Auveco" ? "Auveco" : enrichment.websiteBrand || "";
  enrichment.websiteVendor = parsed.headStandard === "Auveco" ? "Auveco" : enrichment.websiteVendor || "";
  enrichment.category = parsed.category;
  enrichment.subcategory = parsed.subcategory;
  enrichment.tags = uniqueStrings([...(enrichment.tags || []), ...buildTags(parsed)]);
  enrichment.attributes = attrs;
  enrichment.seo = {
    ...(enrichment.seo?.toObject?.() || enrichment.seo || {}),
    slug: enrichment.seo?.slug || seoSlug,
    metaTitle: enrichment.seo?.metaTitle || `${title} | Industrial Hardware Idaho`,
    metaDescription: enrichment.seo?.metaDescription || buildDescription(parsed).slice(0, 155),
    keywords: uniqueStrings([...(enrichment.seo?.keywords || []), ...buildTags(parsed)]),
  };
  enrichment.contentStatus = "auto-mapped";
  enrichment.quality = {
    ...(enrichment.quality?.toObject?.() || enrichment.quality || {}),
    builderReady: hasRequired(parsed),
    renderable: hasRequired(parsed),
    publishReady: hasRequired(parsed),
    completenessScore: hasRequired(parsed) ? 90 : 50,
    missingRequiredAttributes: hasRequired(parsed) ? [] : ["parsed flange bolt attributes"],
    missingRecommendedAttributes: [],
    issues: hasRequired(parsed) ? [] : [
      {
        code: "FLANGE_BOLT_PARSE_INCOMPLETE",
        severity: "warning",
        field: "attributes",
        message: "Flange bolt attributes could not be fully parsed from the part number or description.",
      },
    ],
    lastEvaluatedAt: new Date(),
  };

  if (showSamples && samples.updated.length < 75) {
    samples.updated.push({
      partNumber,
      description,
      title,
      category: parsed.category,
      subcategory: parsed.subcategory,
      measurementSystem: parsed.measurementSystem,
      diameter: parsed.diameter,
      length: parsed.length,
      threadPitch: parsed.threadPitch,
      threadSeries: parsed.threadSeries,
      materialFinish: parsed.materialFinish,
      grade: parsed.grade,
      headStandard: parsed.headStandard,
      wasPublished: product.isPublished,
    });
  }

  if (dryRun) {
    if (isNew) totals.createdEnrichment += 1;
    else totals.updatedEnrichment += 1;
    if (markReady) totals.updatedProductReview += 1;
    continue;
  }

  await enrichment.save();
  if (isNew) totals.createdEnrichment += 1;
  else totals.updatedEnrichment += 1;

  product.hasEnrichment = true;
  product.enrichmentId = enrichment._id;
  product.categoryHints = uniqueStrings([...(product.categoryHints || []), parsed.category, parsed.subcategory, parsed.familyType]);
  product.searchKeywords = uniqueStrings([...(product.searchKeywords || []), partNumber, description, parsed.subcategory, parsed.familyType, parsed.diameter, parsed.length, parsed.threadPitch, parsed.grade, parsed.materialFinish]);
  if (markReady) {
    product.review = buildReviewPatch(parsed, product);
    product.catalogStatus = hasRequired(parsed) ? "ready" : product.catalogStatus;
    product.needsReview = !hasRequired(parsed);
    totals.updatedProductReview += 1;
  }
  await product.save();
}

console.log("\n===== BACKFILL FLANGE BOLTS SUMMARY =====");
console.log(JSON.stringify(totals, null, 2));
if (showSamples) {
  console.log("\n===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

await mongoose.disconnect();
console.log("✅ Done");

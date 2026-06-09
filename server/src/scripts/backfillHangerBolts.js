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
  detectHangerBoltProduct,
  uniqueStrings,
} from "./hangerBoltFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const showSamples = args.has("--samples");
const markReady = args.has("--mark-ready");
const forceDescription = args.has("--force-description");
const preserveLockedDescription = args.has("--preserve-locked-description");

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

function buildReviewPatch(parsed = {}, product = {}) {
  const ready = hasRequired(parsed);
  return {
    ...(product.review?.toObject?.() || product.review || {}),
    status: ready ? "ready" : "needs-review",
    publishReady: ready,
    renderable: ready,
    qualityScore: ready ? 90 : 50,
    missingRequiredAttributes: ready ? [] : ["parsed hanger bolt attributes"],
    missingRecommendedAttributes: [],
    issues: ready ? [] : [
      {
        code: "HANGER_BOLT_PARSE_INCOMPLETE",
        severity: "warning",
        field: "attributes",
        message: "Hanger bolt attributes could not be fully parsed from the part number or description.",
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
  const parsed = detectHangerBoltProduct(product);

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
  const generatedDescription = buildDescription(parsed);
  const shouldOverwriteDescription = forceDescription || !preserveLockedDescription || !enrichment.overrideFlags?.lockDescription;
  enrichment.description = shouldOverwriteDescription ? generatedDescription : enrichment.description;
  enrichment.shortDescription = shouldOverwriteDescription ? generatedDescription : (parsed.shortTitle || title);
  enrichment.bulletPoints = parsed.bulletPoints || [];
  enrichment.category = parsed.category;
  enrichment.subcategory = parsed.subcategory;
  enrichment.tags = uniqueStrings([...(enrichment.tags || []), ...buildTags(parsed)]);
  enrichment.attributes = attrs;
  enrichment.seo = {
    ...(enrichment.seo?.toObject?.() || enrichment.seo || {}),
    slug: enrichment.seo?.slug || seoSlug,
    metaTitle: enrichment.seo?.metaTitle || `${title} | Industrial Hardware Idaho`,
    metaDescription: shouldOverwriteDescription ? generatedDescription.slice(0, 155) : (enrichment.seo?.metaDescription || generatedDescription.slice(0, 155)),
    keywords: uniqueStrings([...(enrichment.seo?.keywords || []), ...buildTags(parsed)]),
  };
  enrichment.contentStatus = "auto-mapped";
  enrichment.quality = {
    ...(enrichment.quality?.toObject?.() || enrichment.quality || {}),
    builderReady: hasRequired(parsed),
    renderable: hasRequired(parsed),
    publishReady: hasRequired(parsed),
    completenessScore: hasRequired(parsed) ? 90 : 50,
    missingRequiredAttributes: hasRequired(parsed) ? [] : ["parsed hanger bolt attributes"],
    missingRecommendedAttributes: [],
    issues: hasRequired(parsed) ? [] : [
      {
        code: "HANGER_BOLT_PARSE_INCOMPLETE",
        severity: "warning",
        field: "attributes",
        message: "Hanger bolt attributes could not be fully parsed from the part number or description.",
      },
    ],
    lastEvaluatedAt: new Date(),
  };

  if (showSamples && samples.updated.length < 75) {
    samples.updated.push({
      partNumber,
      sourceDescription: description,
      description: generatedDescription,
      title,
      category: parsed.category,
      subcategory: parsed.subcategory,
      measurementSystem: parsed.measurementSystem,
      diameter: parsed.diameter,
      length: parsed.length,
      threadPitch: parsed.threadPitch,
      threadSeries: parsed.threadSeries,
      materialFinish: parsed.materialFinish,
      productType: parsed.productType || parsed.familyType,
      grade: parsed.grade,
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

console.log("\n===== BACKFILL HANGER BOLTS SUMMARY =====");
console.log(JSON.stringify(totals, null, 2));
if (showSamples) {
  console.log("\n===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

await mongoose.disconnect();
console.log("✅ Done");

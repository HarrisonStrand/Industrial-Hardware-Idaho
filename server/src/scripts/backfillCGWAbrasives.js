import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import {
  buildBulletPoints,
  buildDescription,
  buildSeoSlug,
  buildTags,
  clean,
  detectCGWAbrasiveProduct,
  isClearlyNotRequestedCGWAbrasive,
  uniqueStrings,
} from "./cgwAbrasiveFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const showSamples = args.has("--samples");
const markReady = args.has("--mark-ready");

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

function hasRequired(parsed = {}) {
  return Boolean(parsed.category && parsed.subcategory && parsed.familyType && parsed.title);
}

function buildAttributes(parsed = {}, product = {}, existingAttrs = {}) {
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");

  return {
    ...existingAttrs,
    size: parsed.size || "",
    diameter: parsed.diameter || "",
    width: parsed.width || "",
    thickness: parsed.thickness || "",
    arbor: parsed.arbor || "",
    length: parsed.length || "",
    grit: parsed.grit || "",
    abrasiveMaterial: parsed.abrasiveMaterial || "",
    abrasive_material: parsed.abrasiveMaterial || "",
    material: parsed.material || "",
    finish: parsed.finish || "",
    displayMaterial: parsed.abrasiveMaterial || parsed.material || "",
    displayFinish: parsed.finish || parsed.abrasiveMaterial || parsed.material || "",
    materialFinish: parsed.materialFinish || "",
    grade: parsed.grade || "",
    attachment: parsed.attachment || "",
    wheelType: parsed.wheelType || "",
    wheel_type: parsed.wheelType || "",
    shape: parsed.shape || "",
    fastenerType: parsed.fastenerType || parsed.familyType || "",
    fastenerTypeCanonical: parsed.fastenerType || parsed.familyType || "",
    familyType: parsed.familyType || "",
    familyTitleBase: parsed.familyTitleBase || "",
    categoryCanonical: parsed.category || "",
    subcategoryCanonical: parsed.subcategory || "",
    productKind: parsed.productKind || "abrasive",
    measurementSystem: parsed.measurementSystem || "imperial",
    fishbowlPartNum: partNumber,
    fishbowlDescription: description,
    sku: product?.sku || "",
    internalPartNumber: product?.internalPartNumber || "",
  };
}

function buildReviewPatch(parsed = {}, product = {}) {
  const ready = hasRequired(parsed);
  return {
    ...(product.review?.toObject?.() || product.review || {}),
    status: ready ? "ready" : "needs-review",
    publishReady: ready,
    renderable: ready,
    qualityScore: ready ? 88 : 50,
    missingRequiredAttributes: ready ? [] : ["parsed CGW abrasive family"],
    missingRecommendedAttributes: [],
    issues: ready ? [] : [
      {
        code: "CGW_ABRASIVE_PARSE_INCOMPLETE",
        severity: "warning",
        field: "attributes",
        message: "CGW abrasive attributes could not be fully parsed from the product description.",
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
  skippedExcluded: 0,
  createdEnrichment: 0,
  updatedEnrichment: 0,
  updatedProductReview: 0,
  unchanged: 0,
};

const samples = { updated: [], unparseable: [] };

for (const product of products) {
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");

  if (isClearlyNotRequestedCGWAbrasive({ part: partNumber, description })) {
    totals.skippedExcluded += 1;
    continue;
  }

  const parsed = detectCGWAbrasiveProduct(product);

  if (!parsed) {
    totals.unparseable += 1;
    if (samples.unparseable.length < 100) samples.unparseable.push({ partNumber, description });
    continue;
  }

  totals.parseable += 1;
  let enrichment = await ProductEnrichment.findOne({ productId: product._id });
  const isNew = !enrichment;
  if (!enrichment) enrichment = new ProductEnrichment({ productId: product._id });

  const attrs = buildAttributes(parsed, product, enrichment.attributes || {});
  const title = parsed.title || enrichment.title || description || partNumber;
  const seoSlug = buildSeoSlug(parsed, partNumber);

  enrichment.title = title;
  enrichment.shortTitle = parsed.shortTitle || title;
  enrichment.description = enrichment.overrideFlags?.lockDescription ? enrichment.description : buildDescription(parsed);
  enrichment.shortDescription = `${parsed.familyTitleBase || "CGW Abrasive"}${parsed.size ? ` - ${parsed.size}` : ""}${parsed.grit ? ` - ${parsed.grit} grit` : ""}`;
  enrichment.bulletPoints = buildBulletPoints(parsed);
  enrichment.websiteBrand = "CGW";
  enrichment.websiteVendor = "CGW";
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
    completenessScore: hasRequired(parsed) ? 88 : 50,
    missingRequiredAttributes: hasRequired(parsed) ? [] : ["parsed CGW abrasive family"],
    missingRecommendedAttributes: [],
    issues: hasRequired(parsed) ? [] : [
      {
        code: "CGW_ABRASIVE_PARSE_INCOMPLETE",
        severity: "warning",
        field: "attributes",
        message: "CGW abrasive attributes could not be fully parsed from the product description.",
      },
    ],
    lastEvaluatedAt: new Date(),
  };

  const productReviewPatch = buildReviewPatch(parsed, product);

  if (showSamples && samples.updated.length < 75) {
    samples.updated.push({
      partNumber,
      description,
      title,
      category: parsed.category,
      subcategory: parsed.subcategory,
      familyType: parsed.familyType,
      size: parsed.size,
      grit: parsed.grit,
      abrasiveMaterial: parsed.abrasiveMaterial,
      attachment: parsed.attachment,
      wheelType: parsed.wheelType,
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
  product.searchKeywords = uniqueStrings([...(product.searchKeywords || []), partNumber, description, "CGW", parsed.subcategory, parsed.familyType, parsed.grit, parsed.abrasiveMaterial]);
  if (markReady) {
    product.review = productReviewPatch;
    product.catalogStatus = hasRequired(parsed) ? "ready" : product.catalogStatus;
    product.needsReview = !hasRequired(parsed);
    totals.updatedProductReview += 1;
  }
  await product.save();
}

console.log("\n===== BACKFILL CGW ABRASIVES SUMMARY =====");
console.log(JSON.stringify(totals, null, 2));
if (showSamples) {
  console.log("\n===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

await mongoose.disconnect();
console.log("✅ Done");

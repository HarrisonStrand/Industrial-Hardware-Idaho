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
  detectThreadedRodProduct,
  slugify,
  uniqueStrings,
} from "./threadedRodFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const showSamples = args.has("--samples");
const markReady = args.has("--mark-ready");

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

function hasRequired(parsed = {}) {
  return Boolean(
    parsed.category &&
      parsed.subcategory &&
      parsed.familyType &&
      parsed.diameter &&
      parsed.threadPitch &&
      parsed.length &&
      parsed.material &&
      parsed.materialFinish &&
      parsed.grade,
  );
}

function buildAttributes(parsed = {}, product = {}, existingAttrs = {}) {
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");

  return {
    ...existingAttrs,
    size: parsed.size || "",
    diameter: parsed.diameter || "",
    length: parsed.length || "",
    lengthUnit: parsed.lengthUnit || "ft",
    length_unit: parsed.lengthUnit || "ft",
    measurementSystem: parsed.measurementSystem || "imperial",
    threadPitch: parsed.threadPitch || "",
    threadSeries: parsed.threadSeries || "",
    thread_series: parsed.threadSeries || "",
    threadType: parsed.threadType || parsed.threadSeries || "",
    thread_type: parsed.threadType || parsed.threadSeries || "",
    threadDirection: parsed.threadDirection || "",
    thread_direction: parsed.threadDirection || "",
    material: parsed.material || "",
    finish: parsed.finish || "",
    displayMaterial: parsed.material || "",
    displayFinish: parsed.finish || parsed.material || "",
    materialFinish: parsed.materialFinish || "",
    grade: parsed.grade || "",
    origin: parsed.origin || "",
    countryOfOrigin: parsed.origin || "",
    country_of_origin: parsed.origin || "",
    fastenerType: parsed.fastenerType || parsed.familyType || "",
    fastenerTypeCanonical: parsed.fastenerType || parsed.familyType || "",
    familyType: parsed.familyType || "",
    familyTitleBase: "Threaded Rod",
    categoryCanonical: parsed.category || "",
    subcategoryCanonical: parsed.subcategory || "",
    productKind: parsed.productKind || "threaded-rod",
    familyCode: parsed.familyCode || "",
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
    qualityScore: ready ? 92 : 55,
    missingRequiredAttributes: ready ? [] : ["parsed threaded rod attributes"],
    missingRecommendedAttributes: [],
    issues: ready ? [] : [
      {
        code: "THREADED_ROD_PARSE_INCOMPLETE",
        severity: "warning",
        field: "attributes",
        message: "Threaded rod attributes could not be fully parsed.",
      },
    ],
    reviewedAt: new Date(),
  };
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");
if (dryRun) console.log("🔎 Dry run only");
if (markReady) console.log("⚠️ --mark-ready enabled: complete parsed threaded rod will be moved to Ready / No Review Needed");

const products = await Product.find(buildCandidateQuery()).lean();
const productIds = products.map((item) => item._id);
const enrichments = await ProductEnrichment.find({ productId: { $in: productIds } });
const enrichmentMap = new Map(enrichments.map((item) => [String(item.productId), item]));

const summary = {
  candidates: products.length,
  parseable: 0,
  unparseable: 0,
  createdEnrichments: 0,
  updatedEnrichments: 0,
  markedReady: 0,
  unchanged: 0,
};

const samples = { updated: [], created: [], unparseable: [] };

for (const product of products) {
  const parsed = detectThreadedRodProduct(product);
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");

  if (!parsed) {
    summary.unparseable += 1;
    if (samples.unparseable.length < 30) {
      samples.unparseable.push({ partNumber, description: product?.fishbowl?.description || "" });
    }
    continue;
  }

  summary.parseable += 1;
  let enrichment = enrichmentMap.get(String(product._id));
  const isNew = !enrichment;
  if (!enrichment) enrichment = new ProductEnrichment({ productId: product._id });

  const description = buildDescription(parsed, product);
  const shortDescription = `${parsed.shortTitle}${partNumber ? ` (${partNumber})` : ""}`;
  const slug = enrichment?.seo?.slug || buildSeoSlug(parsed, product);
  const nextAttrs = buildAttributes(parsed, product, enrichment.attributes || {});

  const next = {
    title: parsed.title,
    shortTitle: parsed.shortTitle,
    description,
    shortDescription,
    bulletPoints: buildBulletPoints(parsed),
    category: parsed.category,
    subcategory: parsed.subcategory,
    tags: buildTags(parsed, product),
    attributes: nextAttrs,
    contentStatus: "auto-mapped",
    seo: {
      ...(enrichment.seo?.toObject?.() || enrichment.seo || {}),
      slug,
      metaTitle: parsed.title,
      metaDescription: description.slice(0, 155),
      keywords: uniqueStrings([
        "threaded rod",
        "all thread",
        parsed.threadSeries,
        parsed.material,
        parsed.finish,
        parsed.grade,
      ]),
    },
  };

  const before = JSON.stringify({
    title: enrichment.title || "",
    category: enrichment.category || "",
    subcategory: enrichment.subcategory || "",
    attributes: enrichment.attributes || {},
  });
  const after = JSON.stringify({
    title: next.title,
    category: next.category,
    subcategory: next.subcategory,
    attributes: next.attributes,
  });

  const changed = before !== after || isNew;
  if (!changed) {
    summary.unchanged += 1;
    continue;
  }

  if (isNew) summary.createdEnrichments += 1;
  else summary.updatedEnrichments += 1;

  const sample = {
    partNumber,
    description: product?.fishbowl?.description || "",
    title: parsed.title,
    category: parsed.category,
    subcategory: parsed.subcategory,
    measurementSystem: parsed.measurementSystem,
    diameter: parsed.diameter,
    threadPitch: parsed.threadPitch,
    threadSeries: parsed.threadSeries,
    threadType: parsed.threadType,
    threadDirection: parsed.threadDirection || "",
    length: parsed.length,
    materialFinish: parsed.materialFinish,
    grade: parsed.grade,
    origin: parsed.origin || "",
  };
  const sampleKey = isNew ? "created" : "updated";
  if (samples[sampleKey].length < 40) samples[sampleKey].push(sample);

  if (dryRun) continue;

  Object.assign(enrichment, next);
  await enrichment.save();

  await Product.updateOne(
    { _id: product._id },
    {
      $set: {
        hasEnrichment: true,
        needsReview: !hasRequired(parsed),
        catalogStatus: hasRequired(parsed) ? "ready" : "enriched",
        ...(markReady ? { review: buildReviewPatch(parsed, product) } : {}),
      },
    },
  );

  if (markReady && hasRequired(parsed)) summary.markedReady += 1;
}

console.log("\n===== THREADED ROD BACKFILL SUMMARY =====");
console.log(JSON.stringify(summary, null, 2));
if (showSamples) {
  console.log("\n===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

await mongoose.disconnect();
console.log("✅ Done");

import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import {
  buildBulletPoints,
  buildDescription,
  buildFamilyFields,
  buildSeoSlug,
  clean,
  detectScrewProduct,
  slugify,
  toTitle,
  uniqueStrings,
} from "./screwFamilyUtils.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const showSamples = args.has("--samples");
const markReady = args.has("--mark-ready");

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

function hasRequired(parsed = {}) {
  return Boolean(
    parsed.category &&
      parsed.subcategory &&
      parsed.familyType &&
      parsed.headType &&
      parsed.diameter &&
      parsed.length &&
      parsed.material &&
      parsed.materialFinish
  );
}

function buildAttributes(parsed = {}, product = {}, existingAttrs = {}) {
  const familyFields = buildFamilyFields(parsed);
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");

  return {
    ...existingAttrs,
    size: parsed.size || parsed.diameter || "",
    diameter: parsed.diameter || "",
    length: parsed.length || "",
    measurementSystem: parsed.measurementSystem || "imperial",
    threadPitch: parsed.threadPitch || "",
    threadSeries: parsed.threadSeries || "",
    thread_series: parsed.threadSeries || "",
    threadType: parsed.threadType || "",
    thread_type: parsed.threadType || "",
    material: parsed.material || "",
    finish: parsed.finish || "",
    displayMaterial: parsed.material || "",
    displayFinish: parsed.finish || parsed.material || "",
    materialFinish: parsed.materialFinish || "",
    grade: parsed.grade || "",
    headType: parsed.headType || "",
    head_type: parsed.headType || "",
    headDetail: parsed.headDetail || "",
    head_detail: parsed.headDetail || "",
    undercut: parsed.headDetail === "undercut",
    driveType: parsed.driveType || "",
    drive_type: parsed.driveType || "",
    fastenerType: parsed.fastenerType || parsed.familyType || "",
    fastenerTypeCanonical: parsed.fastenerType || parsed.familyType || "",
    familyType: parsed.familyType || "",
    categoryCanonical: parsed.category || "",
    subcategoryCanonical: parsed.subcategory || "",
    productKind: parsed.productKind || "",
    familyCode: parsed.familyCode || "",
    fishbowlPartNum: partNumber,
    fishbowlDescription: description,
    sku: product?.sku || "",
    internalPartNumber: product?.internalPartNumber || "",
    ...familyFields,
  };
}

function buildTags(parsed = {}, product = {}) {
  return uniqueStrings([
    "screws",
    slugify(parsed.subcategory),
    slugify(parsed.familyType),
    parsed.headType ? `${slugify(parsed.headType)}-head` : "",
    parsed.driveType ? `${slugify(parsed.driveType)}-drive` : "",
    parsed.material ? slugify(parsed.material) : "",
    parsed.finish ? slugify(parsed.finish) : "",
    ...(Array.isArray(product?.searchKeywords) ? product.searchKeywords.map(slugify) : []),
  ]);
}

function buildReviewPatch(parsed = {}, product = {}) {
  const ready = hasRequired(parsed);
  return {
    ...(product.review?.toObject?.() || product.review || {}),
    status: ready ? "ready" : "needs-review",
    publishReady: ready,
    renderable: ready,
    qualityScore: ready ? 92 : 55,
    missingRequiredAttributes: ready ? [] : ["parsed screw attributes"],
    missingRecommendedAttributes: parsed.driveType ? [] : ["driveType"],
    issues: ready ? [] : [
      {
        code: "SCREW_PARSE_INCOMPLETE",
        severity: "warning",
        field: "attributes",
        message: "Machine/sheet metal screw attributes could not be fully parsed.",
      },
    ],
    reviewedAt: new Date(),
  };
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");
if (dryRun) console.log("🔎 Dry run only");
if (markReady) console.log("⚠️ --mark-ready enabled: complete parsed screws will be moved to Ready / No Review Needed");

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

const samples = {
  updated: [],
  created: [],
  unparseable: [],
};

for (const product of products) {
  const parsed = detectScrewProduct(product);
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");

  if (!parsed) {
    summary.unparseable += 1;
    if (samples.unparseable.length < 30) {
      samples.unparseable.push({
        partNumber,
        description: product?.fishbowl?.description || "",
      });
    }
    continue;
  }

  summary.parseable += 1;

  let enrichment = enrichmentMap.get(String(product._id));
  const isNew = !enrichment;
  if (!enrichment) {
    enrichment = new ProductEnrichment({ productId: product._id });
  }

  const existingAttrs = enrichment.attributes || {};
  const nextAttrs = buildAttributes(parsed, product, existingAttrs);
  const description = buildDescription(parsed, product);
  const shortDescription = `${parsed.shortTitle}${partNumber ? ` (${partNumber})` : ""}`;
  const slug = enrichment?.seo?.slug || buildSeoSlug(parsed, product);

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
        parsed.familyType,
        parsed.subcategory,
        parsed.headType,
        parsed.driveType,
        parsed.material,
        parsed.finish,
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

  if (before === after && !isNew) {
    summary.unchanged += 1;
    continue;
  }

  if (isNew) summary.createdEnrichments += 1;
  else summary.updatedEnrichments += 1;

  const sample = {
    partNumber,
    description: product?.fishbowl?.description || "",
    before: {
      title: enrichment.title || "",
      category: enrichment.category || "",
      subcategory: enrichment.subcategory || "",
      familyType: enrichment.attributes?.familyType || "",
      materialFinish: enrichment.attributes?.materialFinish || "",
    },
    after: {
      title: next.title,
      category: next.category,
      subcategory: next.subcategory,
      familyType: next.attributes.familyType,
      headType: next.attributes.headType,
      driveType: next.attributes.driveType,
      headDetail: next.attributes.headDetail,
      diameter: next.attributes.diameter,
      threadPitch: next.attributes.threadPitch,
      length: next.attributes.length,
      materialFinish: next.attributes.materialFinish,
    },
  };

  if (isNew && samples.created.length < 25) samples.created.push(sample);
  if (!isNew && samples.updated.length < 25) samples.updated.push(sample);

  if (!dryRun) {
    Object.assign(enrichment, next);
    await enrichment.save();

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          hasEnrichment: true,
          enrichmentId: enrichment._id,
          categoryHints: uniqueStrings([...(product.categoryHints || []), parsed.category, parsed.subcategory, parsed.familyType]),
          searchKeywords: uniqueStrings([...(product.searchKeywords || []), parsed.familyType, parsed.subcategory, parsed.headType, parsed.driveType]),
        },
      }
    );

    if (markReady) {
      const review = buildReviewPatch(parsed, product);
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            review,
            needsReview: review.status === "needs-review",
            catalogStatus: review.publishReady ? "ready" : "enriched",
          },
        }
      );
      if (review.publishReady) summary.markedReady += 1;
    }
  }
}

console.log("===== MACHINE / SHEET METAL SCREW BACKFILL SUMMARY =====");
console.log(JSON.stringify(summary, null, 2));

if (showSamples) {
  console.log("===== SAMPLES =====");
  console.log(JSON.stringify(samples, null, 2));
}

await mongoose.disconnect();
console.log("✅ Done");

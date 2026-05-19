import "../config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_DIR = path.resolve(
  __dirname,
  "../../data/productContentTemplates",
);

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, fileName), "utf8"));
}

const contentTemplates = readJson("boltContentTemplates.json");
const applicationProfiles = readJson("boltApplicationProfiles.json");
const imageProfiles = readJson("boltImageProfiles.json");

const TARGET_FAMILY_TYPES = new Set([
  "hex cap screw",
  "heavy hex bolt",
  "structural bolt",
  "socket head cap screw",
  "button head cap screw",
  "flat head cap screw",
  "flange bolt",
  "carriage bolt",
]);

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
  return clean(value).toLowerCase();
}

function displayCase(value = "") {
  const raw = clean(value);
  if (!raw) return "";

  const upperKeep = new Set(["A307", "A325", "USS", "SAE", "F436"]);

  return raw
    .split(/\s+/)
    .map((word) => {
      const cleaned = word.replace(/[^a-z0-9/-]/gi, "");
      if (upperKeep.has(cleaned.toUpperCase())) return cleaned.toUpperCase();
      if (/^m\d/i.test(cleaned)) return cleaned.toUpperCase();
      if (/^\d+(?:\/\d+)?$/.test(cleaned)) return cleaned;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\bSs\b/g, "SS");
}

function formatMeasurementSystem(value = "") {
  const normalized = normalize(value);
  if (normalized === "imperial") return "standard";
  if (normalized === "metric") return "metric";
  return normalized || "catalog";
}

function formatGradePrefix(attrs = {}) {
  const grade = clean(attrs.grade || "");
  const familyType = normalize(attrs.familyType || attrs.fastenerTypeCanonical || "");

  if (!grade || familyType === "structural bolt") return "";
  if (/^grade\s+/i.test(grade)) return `${displayCase(grade)} `;
  if (/^a\d+/i.test(grade)) return `${grade.toUpperCase()} `;
  if (/^(304|316)$/.test(grade)) return `${grade} `;
  return `${displayCase(grade)} `;
}

function formatMaterialFinish(value = "") {
  const normalized = normalize(value);
  if (!normalized) return "";

  const map = {
    "steel / zinc": "Steel / Zinc",
    "steel / galvanized": "Steel / Galvanized",
    "steel / plain": "Steel / Plain",
    "steel / black oxide": "Steel / Black Oxide",
    "stainless steel": "Stainless Steel",
    aluminum: "Aluminum",
    brass: "Brass",
  };

  return map[normalized] || displayCase(value);
}

function getMaterialFinishKey(attrs = {}) {
  const materialFinish = clean(attrs.materialFinish || "");
  if (materialFinish) return normalize(materialFinish);

  const material = clean(attrs.material || "");
  const finish = clean(attrs.finish || "");
  if (material && finish) return normalize(`${material} / ${finish}`);
  return normalize(material || finish || "");
}

function formatLength(value = "", measurementSystem = "") {
  const length = clean(value);
  if (!length) return "";
  const system = normalize(measurementSystem);
  if (system === "metric") {
    if (/mm$/i.test(length)) return length.toLowerCase();
    return `${length}mm`;
  }
  return length.replace(/\s+/g, "-");
}

function normalizeDiameterForTitle(value = "") {
  return clean(value).replace(/^#/, "").replace(/\s+/g, "-");
}

function buildDiameterThread(attrs = {}) {
  const measurementSystem = normalize(attrs.measurementSystem || "");
  const diameter = normalizeDiameterForTitle(attrs.diameter || "");
  const threadPitch = clean(attrs.threadPitch || "");

  if (!diameter) return "";

  if (measurementSystem === "metric") {
    return threadPitch ? `${diameter.toUpperCase()} - ${threadPitch}` : diameter.toUpperCase();
  }

  if (/^\d+-\d+(?:\.\d+)?$/.test(diameter)) return diameter;
  return threadPitch ? `${diameter}-${threadPitch}` : diameter;
}

function formatThreadSentence(attrs = {}) {
  const series = normalize(attrs.threadSeries || attrs.thread_series || "");
  const pitch = clean(attrs.threadPitch || "");
  const coverage = normalize(attrs.threadCoverage || attrs.thread_coverage || "");

  const parts = [];
  if (series && pitch) parts.push(`This item uses ${series} thread pitch ${pitch}.`);
  else if (pitch) parts.push(`This item uses thread pitch ${pitch}.`);

  const coverageSentence = applicationProfiles.threadCoverageSentences?.[coverage];
  if (coverageSentence) parts.push(coverageSentence);

  return parts.join(" ");
}

function formatOriginSentence(attrs = {}) {
  const origin = normalize(attrs.origin || "");
  return applicationProfiles.originSentences?.[origin] || "";
}

function getApplicationSentence(template = {}) {
  const key = template.applicationProfile || "";
  return applicationProfiles.applicationProfiles?.[key]?.sentence || "";
}

function getMaterialSentence(attrs = {}) {
  const key = getMaterialFinishKey(attrs);
  return applicationProfiles.materialSentences?.[key] || "";
}

function formatCoverageSuffix(attrs = {}) {
  const coverage = normalize(attrs.threadCoverage || attrs.thread_coverage || "");
  if (coverage === "full") return " - Fully Threaded";
  return "";
}

function formatOriginSuffix(attrs = {}) {
  const origin = normalize(attrs.origin || "");
  if (origin === "domestic") return " - Domestic";
  return "";
}

function formatFinishSuffix(attrs = {}) {
  const finish = normalize(attrs.finish || "");
  if (!finish || finish === "plain") return "";
  return ` - ${displayCase(finish)}`;
}

function formatHeadProfileSuffix(attrs = {}) {
  const profile = normalize(attrs.headProfile || attrs.head_profile || "");
  if (profile === "low head") return " - Low Head";
  return "";
}

function replaceTokens(pattern = "", tokens = {}) {
  return clean(
    String(pattern || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
      return tokens[key] ?? "";
    }),
  )
    .replace(/\s+-\s+-\s+/g, " - ")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function slugSafe(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function truncate(value = "", max = 160) {
  const text = clean(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function lookupImageMap(map = {}, candidateKeys = []) {
  if (!map || typeof map !== "object") return "";

  for (const key of candidateKeys.filter(Boolean)) {
    if (map[key]) return map[key];
  }

  const normalizedLookup = new Map(
    Object.entries(map).map(([key, value]) => [normalize(key), value]),
  );

  for (const key of candidateKeys.filter(Boolean)) {
    const normalizedKey = normalize(key);
    if (normalizedLookup.has(normalizedKey)) {
      return normalizedLookup.get(normalizedKey);
    }
  }

  return "";
}

function resolveImageUrl(familyType = "", attrs = {}) {
  const profile = imageProfiles.imageProfiles?.[familyType];
  if (!profile) return "";

  const materialFinish = getMaterialFinishKey(attrs);
  const material = normalize(attrs.material || "");
  const finish = normalize(attrs.finish || "");
  const grade = clean(attrs.grade || "");
  const gradeUpper = grade.toUpperCase();
  const gradeNormalized = normalize(grade);

  const materialFinishKeys = [
    materialFinish,
    material,
    finish,
    material && finish ? `${material} / ${finish}` : "",
    material === "steel" && finish ? `steel / ${finish}` : "",
  ].filter(Boolean);

  const materialGradeKeys = [];
  for (const key of materialFinishKeys) {
    materialGradeKeys.push(`${key}|${grade}`);
    materialGradeKeys.push(`${key}|${gradeUpper}`);
    materialGradeKeys.push(`${key}|${gradeNormalized}`);
  }

  const materialGradeMatch = lookupImageMap(
    profile.byMaterialFinishAndGrade,
    materialGradeKeys,
  );
  if (materialGradeMatch) return materialGradeMatch;

  // Material / finish should win before grade fallback. Otherwise a Grade 8
  // aluminum, brass, nylon, or chrome item can accidentally receive the generic
  // Grade 8 yellow-zinc image just because grade is checked first.
  const materialFinishMatch = lookupImageMap(
    profile.byMaterialFinish,
    materialFinishKeys,
  );
  if (materialFinishMatch) return materialFinishMatch;

  const gradeMatch = lookupImageMap(
    profile.byGrade,
    [grade, gradeUpper, gradeNormalized],
  );
  if (gradeMatch) return gradeMatch;

  return profile.default || "";
}

function getTemplateForFamily(familyType = "") {
  return contentTemplates.families?.[familyType] || null;
}

function buildContent({ product = {}, enrichment = {} }) {
  const attrs = enrichment.attributes || {};
  const familyType = normalize(
    attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "",
  );
  const template = getTemplateForFamily(familyType);
  if (!template) return null;

  const diameterThread = buildDiameterThread(attrs);
  const length = formatLength(attrs.length || "", attrs.measurementSystem || "");
  const materialFinishLabel = formatMaterialFinish(getMaterialFinishKey(attrs));

  const tokens = {
    gradePrefix: formatGradePrefix(attrs),
    materialFinishLabel,
    diameterThread,
    length,
    coverageSuffix: formatCoverageSuffix(attrs),
    originSuffix: formatOriginSuffix(attrs),
    finishSuffix: formatFinishSuffix(attrs),
    headProfileSuffix: formatHeadProfileSuffix(attrs),
    measurementSystemLabel: formatMeasurementSystem(attrs.measurementSystem || ""),
    materialSentence: getMaterialSentence(attrs),
    threadSentence: formatThreadSentence(attrs),
    originSentence: formatOriginSentence(attrs),
    applicationSentence: getApplicationSentence(template),
  };

  const title = replaceTokens(template.titlePattern, tokens);
  const shortTitle = replaceTokens(template.shortTitlePattern, tokens) || title;
  const description = replaceTokens(template.descriptionTemplate, {
    ...tokens,
    productName: title,
  });

  const partNumber = clean(
    attrs.fishbowlPartNum || product?.fishbowl?.partNum || product?.sku || "",
  );

  const bulletPoints = [
    diameterThread ? `Size: ${diameterThread} x ${length}` : "",
    materialFinishLabel ? `Material / Finish: ${materialFinishLabel}` : "",
    attrs.grade ? `Grade: ${clean(attrs.grade).toUpperCase().replace(/^GRADE\s+/i, "Grade ")}` : "",
    attrs.threadCoverage ? `Thread Coverage: ${displayCase(attrs.threadCoverage)}` : "",
    attrs.origin && normalize(attrs.origin) !== "standard" ? `Origin: ${displayCase(attrs.origin)}` : "",
    partNumber ? `Part Number: ${partNumber}` : "",
  ].filter(Boolean);

  const metaTitle = truncate(title, 60);
  const metaDescription = truncate(description, 155);
  const imageUrl = resolveImageUrl(familyType, attrs);
  const slug = enrichment?.seo?.slug || slugSafe(`${title}-${partNumber}`);

  return {
    familyType,
    title,
    shortTitle,
    shortDescription: partNumber ? `${shortTitle} (${partNumber})` : shortTitle,
    description,
    bulletPoints,
    seo: {
      ...(enrichment.seo?.toObject?.() || enrichment.seo || {}),
      slug,
      metaTitle,
      metaDescription,
      keywords: [
        "bolts",
        familyType,
        attrs.grade,
        getMaterialFinishKey(attrs),
        attrs.measurementSystem,
        partNumber,
      ]
        .filter(Boolean)
        .map(slugSafe),
    },
    imageUrl,
  };
}

function shouldSkipLocked(enrichment = {}, field = "") {
  const flags = enrichment.overrideFlags || {};
  if (field === "title") return !!flags.lockTitle;
  if (field === "description") return !!flags.lockDescription;
  if (field === "images") return !!flags.lockImages;
  return false;
}

function isRawFishbowlLooking(value = "") {
  const text = clean(value);
  return (
    /^\w{2,6}\d/i.test(text) ||
    /^c\/s\b/i.test(text) ||
    /^shcs\b/i.test(text) ||
    /^bhcs\b/i.test(text) ||
    /^mms[bfh]/i.test(text) ||
    /^a325sb/i.test(text)
  );
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const samples = hasFlag("samples");
  const skipImages = hasFlag("skip-images");
  const onlyFamily = normalize(argValue("family", ""));
  const limit = Number(argValue("limit", "0")) || 0;

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const enrichmentQuery = {
    category: /^bolts$/i,
    "attributes.familyType": { $in: Array.from(TARGET_FAMILY_TYPES) },
  };

  if (onlyFamily) {
    enrichmentQuery["attributes.familyType"] = new RegExp(`^${onlyFamily}$`, "i");
  }

  let query = ProductEnrichment.find(enrichmentQuery).sort({ updatedAt: -1 });
  if (limit > 0) query = query.limit(limit);
  const enrichments = await query;

  const productIds = enrichments.map((item) => item.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((item) => [String(item._id), item]));

  const summary = {
    matched: enrichments.length,
    eligible: 0,
    skippedNoTemplate: 0,
    skippedLockedContent: 0,
    updated: 0,
    wouldUpdate: 0,
    imagesAssigned: 0,
    rawTitleBefore: 0,
    byFamily: {},
  };

  const sampleRows = [];

  for (const enrichment of enrichments) {
    const product = productMap.get(String(enrichment.productId));
    const content = buildContent({ product, enrichment });

    if (!content) {
      summary.skippedNoTemplate += 1;
      continue;
    }

    summary.eligible += 1;
    summary.byFamily[content.familyType] = (summary.byFamily[content.familyType] || 0) + 1;

    if (isRawFishbowlLooking(enrichment.title || "")) {
      summary.rawTitleBefore += 1;
    }

    const before = {
      title: enrichment.title || "",
      shortTitle: enrichment.shortTitle || "",
      description: enrichment.description || "",
      image: enrichment.images?.find((img) => img.isPrimary)?.url || enrichment.images?.[0]?.url || "",
    };

    const lockedTitle = shouldSkipLocked(enrichment, "title");
    const lockedDescription = shouldSkipLocked(enrichment, "description");
    const lockedImages = shouldSkipLocked(enrichment, "images");

    if (lockedTitle && lockedDescription && (skipImages || lockedImages)) {
      summary.skippedLockedContent += 1;
      continue;
    }

    const nextImages = Array.isArray(enrichment.images) ? [...enrichment.images] : [];
    if (!skipImages && !lockedImages && content.imageUrl) {
      const existingIndex = nextImages.findIndex((img) => img?.url === content.imageUrl);
      if (existingIndex >= 0) {
        nextImages[existingIndex] = {
          ...nextImages[existingIndex],
          isPrimary: true,
          sortOrder: 0,
          alt: `${content.title} product image`,
          source: nextImages[existingIndex].source || "generated",
          needsReview: false,
        };
      } else {
        nextImages.unshift({
          url: content.imageUrl,
          alt: `${content.title} product image`,
          sortOrder: 0,
          source: "generated",
          sourceVendor: "IHI",
          sourcePartNumber:
            content?.seo?.keywords?.find((keyword) => keyword) ||
            product?.fishbowl?.partNum ||
            product?.sku ||
            "",
          isPrimary: true,
          needsReview: false,
          backgroundRemoved: true,
          cleaned: true,
        });
      }

      for (let i = 0; i < nextImages.length; i += 1) {
        nextImages[i] = {
          ...nextImages[i],
          isPrimary: i === 0,
          sortOrder: i,
          source: ["vendor", "manual", "generated", "website", "unknown"].includes(
            nextImages[i]?.source,
          )
            ? nextImages[i].source
            : "generated",
        };
      }
    }

    const after = {
      title: lockedTitle ? before.title : content.title,
      shortTitle: lockedTitle ? before.shortTitle : content.shortTitle,
      description: lockedDescription ? before.description : content.description,
      image: nextImages?.[0]?.url || before.image,
    };

    const changed =
      before.title !== after.title ||
      before.shortTitle !== after.shortTitle ||
      before.description !== after.description ||
      before.image !== after.image;

    if (!changed) continue;

    if (samples && sampleRows.length < 20) {
      sampleRows.push({
        partNumber: product?.fishbowl?.partNum || product?.sku || enrichment?.attributes?.fishbowlPartNum || "",
        familyType: content.familyType,
        before,
        after,
      });
    }

    if (dryRun) {
      summary.wouldUpdate += 1;
      if (before.image !== after.image) summary.imagesAssigned += 1;
      continue;
    }

    if (!lockedTitle) {
      enrichment.title = content.title;
      enrichment.shortTitle = content.shortTitle;
      enrichment.shortDescription = content.shortDescription;
    }

    if (!lockedDescription) {
      enrichment.description = content.description;
      enrichment.bulletPoints = content.bulletPoints;
      enrichment.seo = content.seo;
      enrichment.contentStatus = "ready-review";
    }

    if (!skipImages && !lockedImages && content.imageUrl) {
      enrichment.images = nextImages;
      enrichment.imageStatus = "matched";
      summary.imagesAssigned += 1;
    }

    await enrichment.save();
    summary.updated += 1;
  }

  console.log("===== BOLT CONTENT TEMPLATE SUMMARY =====");
  console.log(JSON.stringify(summary, null, 2));

  if (samples) {
    console.log("===== SAMPLES =====");
    console.log(JSON.stringify(sampleRows, null, 2));
  }

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Bolt content template pass failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

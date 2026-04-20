// server/src/services/catalog/evaluateProductPublishReadiness.js
import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
  return clean(value).toLowerCase();
}

function isLikelyAssemblyText(value = "") {
  const text = normalize(value);
  if (!text) return false;

  return (
    text.includes(" assy") ||
    text.includes("assembly") ||
    text.includes(" w /") ||
    text.includes(" w/") ||
    text.includes("with locknut") ||
    text.includes("locknut assy")
  );
}

function pushIssue(issues, { code, severity = "warning", field = "", message = "" }) {
  issues.push({
    code,
    severity,
    field,
    message,
  });
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))];
}

function canonicalFamilyKeyFromAttributes(enrichment) {
  const attrs = enrichment?.attributes || {};

  const category = normalize(enrichment?.category || attrs.categoryCanonical || "");
  const subcategory = normalize(enrichment?.subcategory || attrs.subcategoryCanonical || "");
  const fastenerType = normalize(attrs.fastenerTypeCanonical || attrs.fastenerType || "");
  const finish = normalize(attrs.finish || "");
  const grade = normalize(attrs.grade || "");
  const material = normalize(attrs.material || "");
  const measurementSystem = normalize(attrs.measurementSystem || "");

  return [
    category,
    subcategory,
    fastenerType,
    finish,
    grade,
    material,
    measurementSystem,
  ]
    .filter(Boolean)
    .join("|");
}

function compareAttributesScore(sourceAttrs = {}, candidateAttrs = {}) {
  const comparedKeys = [
    "categoryCanonical",
    "subcategoryCanonical",
    "fastenerTypeCanonical",
    "fastenerType",
    "finish",
    "grade",
    "material",
    "measurementSystem",
  ];

  let score = 0;
  const reasons = [];

  for (const key of comparedKeys) {
    const a = normalize(sourceAttrs[key] || "");
    const b = normalize(candidateAttrs[key] || "");
    if (!a || !b) continue;

    if (a === b) {
      score += 1;
      reasons.push(`Matched ${key}`);
    }
  }

  return { score, reasons };
}

async function findSimilarFamilyCandidates(enrichment) {
  const attrs = enrichment?.attributes || {};
  const category = clean(enrichment?.category || "");
  const subcategory = clean(enrichment?.subcategory || "");

  if (!category || !subcategory) {
    return [];
  }

  const candidates = await ProductEnrichment.find({
    productId: { $ne: enrichment.productId },
    category,
    subcategory,
    "attributes.familyKey": { $exists: true, $ne: "" },
  })
    .select({
      productId: 1,
      title: 1,
      category: 1,
      subcategory: 1,
      attributes: 1,
    })
    .limit(200)
    .lean();

  const byFamilyKey = new Map();

  for (const candidate of candidates) {
    const familyKey = clean(candidate?.attributes?.familyKey || "");
    if (!familyKey) continue;

    const { score, reasons } = compareAttributesScore(attrs, candidate.attributes || {});
    if (score <= 0) continue;

    const existing = byFamilyKey.get(familyKey);
    if (!existing || existing.score < score) {
      byFamilyKey.set(familyKey, {
        familyKey,
        familyTitle: candidate?.attributes?.familyTitle || candidate?.title || "",
        score,
        confidence: Math.min(1, score / 6),
        reason: reasons.join(", "),
        reasons,
      });
    }
  }

  return Array.from(byFamilyKey.values())
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, 5);
}

function computeQualityScore({
  missingRequiredAttributes = [],
  missingRecommendedAttributes = [],
  hasTitle,
  hasSlug,
  hasCategory,
  hasSubcategory,
  hasDescription,
  issues = [],
}) {
  let score = 100;

  const errorCount = issues.filter((issue) => issue?.severity === "error").length;
  const warningCount = issues.filter((issue) => issue?.severity === "warning").length;

  score -= errorCount * 15;
  score -= warningCount * 4;
  score -= missingRequiredAttributes.length * 12;
  score -= missingRecommendedAttributes.length * 4;

  if (!hasTitle) score -= 12;
  if (!hasSlug) score -= 8;
  if (!hasCategory) score -= 8;
  if (!hasSubcategory) score -= 8;
  if (!hasDescription) score -= 6;

  return Math.max(0, Math.min(100, score));
}

export async function evaluateProductPublishReadiness(productId, options = {}) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const includeSimilarFamilies = options.includeSimilarFamilies !== false;

  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new Error("Product not found");
  }

  const enrichment = await ProductEnrichment.findOne({ productId }).lean();

  const issues = [];
  const missingRequiredAttributes = [];
  const missingRecommendedAttributes = [];

  if (!enrichment) {
    pushIssue(issues, {
      code: "MISSING_ENRICHMENT",
      severity: "error",
      field: "enrichment",
      message: "Product does not have enrichment.",
    });

    return {
      isReady: false,
      renderable: false,
      builderReady: false,
      publishReady: false,
      status: "needs-review",
      qualityScore: 0,
      completenessScore: 0,
      missingRequiredAttributes: ["enrichment"],
      missingRecommendedAttributes: [],
      issues,
      suggestedFamilyKey: "",
      suggestedFamilyConfidence: 0,
      similarFamilyCandidates: [],
    };
  }

  const attrs = enrichment.attributes || {};
  const category = clean(enrichment.category || "");
  const subcategory = clean(enrichment.subcategory || "");
  const title = clean(enrichment.title || enrichment.shortTitle || "");
  const slug = clean(enrichment?.seo?.slug || "");
  const description = clean(enrichment.description || enrichment.shortDescription || "");
  const partNumber = clean(
    attrs.fishbowlPartNum || product?.fishbowl?.partNum || product?.sku || ""
  );

  if (!title) {
    pushIssue(issues, {
      code: "MISSING_TITLE",
      severity: "error",
      field: "title",
      message: "Product title is missing.",
    });
  }

  if (!slug) {
    pushIssue(issues, {
      code: "MISSING_SLUG",
      severity: "error",
      field: "seo.slug",
      message: "SEO slug is missing.",
    });
  }

  if (!category) {
    pushIssue(issues, {
      code: "MISSING_CATEGORY",
      severity: "error",
      field: "category",
      message: "Category is missing.",
    });
  }

  if (!subcategory) {
    pushIssue(issues, {
      code: "MISSING_SUBCATEGORY",
      severity: "error",
      field: "subcategory",
      message: "Subcategory is missing.",
    });
  }

  if (!partNumber) {
    pushIssue(issues, {
      code: "MISSING_PART_NUMBER",
      severity: "error",
      field: "fishbowl.partNum",
      message: "Fishbowl part number is missing.",
    });
  }

  const fastenerType = clean(attrs.fastenerTypeCanonical || attrs.fastenerType || "");
  const diameter = clean(attrs.diameter || "");
  const threadPitch = clean(attrs.threadPitch || "");
  const length = clean(attrs.length || "");
  const measurementSystem = clean(attrs.measurementSystem || "");
  const finish = clean(attrs.finish || "");
  const grade = clean(attrs.grade || "");
  const material = clean(attrs.material || "");
  const size = clean(attrs.size || "");

  const textToInspect = [
    title,
    description,
    product?.fishbowl?.description || "",
    partNumber,
  ]
    .filter(Boolean)
    .join(" ");

  if (isLikelyAssemblyText(textToInspect)) {
    pushIssue(issues, {
      code: "LIKELY_ASSEMBLY",
      severity: "error",
      field: "description",
      message: "This appears to be an assembly-style item and is not safe for builder rendering.",
    });
  }

  const isHexCapScrew =
    normalize(category) === "bolts" &&
    normalize(subcategory) === "hex cap screws";

  if (isHexCapScrew) {
    if (!diameter) missingRequiredAttributes.push("diameter");
    if (!length) missingRequiredAttributes.push("length");
    if (!threadPitch && !size) missingRequiredAttributes.push("threadPitch");
    if (!fastenerType) missingRequiredAttributes.push("fastenerType");

    if (!measurementSystem) missingRecommendedAttributes.push("measurementSystem");
    if (!finish) missingRecommendedAttributes.push("finish");
    if (!grade) missingRecommendedAttributes.push("grade");
    if (!material) missingRecommendedAttributes.push("material");

    if (fastenerType && normalize(fastenerType) !== "hex cap screw") {
      pushIssue(issues, {
        code: "FASTENER_TYPE_MISMATCH",
        severity: "error",
        field: "attributes.fastenerTypeCanonical",
        message: "Fastener type does not match hex cap screw builder rules.",
      });
    }
  } else {
    if (!fastenerType) missingRecommendedAttributes.push("fastenerType");
    if (!measurementSystem) missingRecommendedAttributes.push("measurementSystem");
  }

  for (const field of missingRequiredAttributes) {
    pushIssue(issues, {
      code: "MISSING_REQUIRED_ATTRIBUTE",
      severity: "error",
      field: `attributes.${field}`,
      message: `Missing required attribute: ${field}`,
    });
  }

  for (const field of missingRecommendedAttributes) {
    pushIssue(issues, {
      code: "MISSING_RECOMMENDED_ATTRIBUTE",
      severity: "warning",
      field: `attributes.${field}`,
      message: `Missing recommended attribute: ${field}`,
    });
  }

  const renderable =
    issues.every((issue) => issue.severity !== "error") &&
    Boolean(title) &&
    Boolean(slug) &&
    Boolean(category) &&
    Boolean(subcategory);

  const builderReady = renderable;

  const publishReady =
    builderReady &&
    missingRequiredAttributes.length === 0 &&
    product.isActive === true &&
    !!enrichment;

  const similarFamilyCandidates = includeSimilarFamilies
    ? await findSimilarFamilyCandidates(enrichment)
    : [];

  const topCandidate = similarFamilyCandidates[0] || null;

  const suggestedFamilyKey =
    clean(attrs.familyKey || "") ||
    topCandidate?.familyKey ||
    canonicalFamilyKeyFromAttributes(enrichment);

  const suggestedFamilyConfidence = topCandidate?.confidence || 0;

  if (!clean(attrs.familyKey || "") && topCandidate) {
    pushIssue(issues, {
      code: "SIMILAR_FAMILY_FOUND",
      severity: "info",
      field: "attributes.familyKey",
      message: `Found similar family candidate: ${topCandidate.familyTitle || topCandidate.familyKey}`,
    });
  }

  const qualityScore = computeQualityScore({
    missingRequiredAttributes,
    missingRecommendedAttributes,
    hasTitle: !!title,
    hasSlug: !!slug,
    hasCategory: !!category,
    hasSubcategory: !!subcategory,
    hasDescription: !!description,
    issues,
  });

  let status = "needs-review";
  if (publishReady) status = "ready";

  return {
    isReady: publishReady,
    renderable,
    builderReady,
    publishReady,
    status,
    qualityScore,
    completenessScore: qualityScore,
    missingRequiredAttributes: uniq(missingRequiredAttributes),
    missingRecommendedAttributes: uniq(missingRecommendedAttributes),
    issues,
    suggestedFamilyKey,
    suggestedFamilyConfidence,
    similarFamilyCandidates,
  };
}

export default evaluateProductPublishReadiness;
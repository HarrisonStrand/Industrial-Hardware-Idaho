import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import SyncRun from "../models/SyncRun.js";
import createProductEnrichmentFromProduct from "../services/catalog/createProductEnrichmentFromProduct.js";
import normalizeWebsiteTaxonomy from "../utils/normalizeWebsiteTaxonomy.js";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean).map((v) => clean(v)))];
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (clean(value)) return clean(value);
  }
  return "";
}

function getParsed(product) {
  return product?.fishbowl?.raw?.parsedAttributes || {};
}

function getNormalizedTaxonomy(product) {
  const parsed = getParsed(product);

  return normalizeWebsiteTaxonomy({
    category: firstNonEmpty(parsed.category, product?.categoryHints?.[0]),
    subcategory: firstNonEmpty(parsed.subcategory, product?.categoryHints?.[1]),
    fastenerType: parsed.fastenerType || "",
  });
}

function buildFamilyKey(product) {
  const parsed = getParsed(product);
  const normalized = getNormalizedTaxonomy(product);

  const category = clean(normalized.category);
  const subcategory = clean(normalized.subcategory);
  const fastenerType = clean(parsed.fastenerType);
  const material = clean(parsed.material);
  const finish = clean(parsed.finish);
  const grade = clean(parsed.grade);
  const measurementSystem = clean(parsed.measurementSystem);

  const hasIdentity = category && (subcategory || fastenerType);
  const hasDifferentiator = material || finish || grade || measurementSystem;

  if (!hasIdentity || !hasDifferentiator) {
    return "";
  }

  return [
    category,
    subcategory,
    fastenerType,
    material,
    finish,
    grade,
    measurementSystem,
  ]
    .map(clean)
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

function buildFamilyTitle(group = []) {
  const sample = group[0] || {};
  const parsed = getParsed(sample);

  const parts = [parsed.finish, parsed.material, parsed.grade, parsed.fastenerType]
    .map(clean)
    .filter(Boolean);

  return parts.join(" ") || sample?.fishbowl?.description || sample?.sku || "Catalog Family";
}

function buildFamilyShortTitle(group = []) {
  const sample = group[0] || {};
  const parsed = getParsed(sample);

  const parts = [parsed.finish, parsed.fastenerType].map(clean).filter(Boolean);

  return parts.join(" ") || buildFamilyTitle(group);
}

function buildFamilyDescription(group = []) {
  const sample = group[0] || {};
  const normalized = getNormalizedTaxonomy(sample);
  const count = group.length;

  const bits = [
    buildFamilyTitle(group),
    "catalog family",
    normalized.category ? `in ${normalized.category}` : "",
    normalized.subcategory ? `under ${normalized.subcategory}` : "",
    count ? `with ${count} variant${count === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return clean(bits.join(" "));
}

function buildFamilyTags(group = []) {
  const tags = [];

  for (const product of group) {
    const parsed = getParsed(product);
    const normalized = getNormalizedTaxonomy(product);

    tags.push(
      normalized.category,
      normalized.subcategory,
      parsed.fastenerType,
      parsed.material,
      parsed.finish,
      parsed.grade,
      ...(Array.isArray(product?.searchKeywords) ? product.searchKeywords : [])
    );
  }

  return uniq(tags).map(slugify);
}

function buildFamilyAttributes(group = []) {
  const optionMap = {
    size: new Set(),
    diameter: new Set(),
    threadPitch: new Set(),
    length: new Set(),
    measurementSystem: new Set(),
    material: new Set(),
    finish: new Set(),
    grade: new Set(),
    fastenerType: new Set(),
  };

  for (const product of group) {
    const parsed = getParsed(product);

    for (const key of Object.keys(optionMap)) {
      const value = clean(parsed[key]);
      if (value) optionMap[key].add(value);
    }
  }

  const options = {};
  for (const [key, set] of Object.entries(optionMap)) {
    options[key] = [...set];
  }

  return options;
}

function buildVariantAttributes(product) {
  const parsed = getParsed(product);

  return {
    size: clean(parsed.size),
    diameter: clean(parsed.diameter),
    threadPitch: clean(parsed.threadPitch),
    length: clean(parsed.length),
    measurementSystem: clean(parsed.measurementSystem),
    material: clean(parsed.material),
    finish: clean(parsed.finish),
    grade: clean(parsed.grade),
    fastenerType: clean(parsed.fastenerType),
    fishbowlPartNum: clean(product?.fishbowl?.partNum),
    sku: clean(product?.sku),
    internalPartNumber: clean(product?.internalPartNumber),
  };
}

function buildFamilyMeta(group = []) {
  const sample = group[0] || {};
  const normalized = getNormalizedTaxonomy(sample);

  return {
    familyKey: buildFamilyKey(sample),
    familySlug: slugify(buildFamilyTitle(group)),
    familyTitle: buildFamilyTitle(group),
    familyShortTitle: buildFamilyShortTitle(group),
    familyDescription: buildFamilyDescription(group),
    category: normalized.category,
    subcategory: normalized.subcategory,
    familyTags: buildFamilyTags(group),
    familyAttributeOptions: buildFamilyAttributes(group),
  };
}

async function ensureEnrichment(product) {
  let enrichment = await ProductEnrichment.findOne({ productId: product._id });
  if (enrichment) return enrichment;

  const created = await createProductEnrichmentFromProduct(product._id);
  return created.enrichment;
}

async function applyFamilyToGroup(group = []) {
  if (!group.length) {
    return { updated: 0, skipped: 0, familyKey: "", products: [] };
  }

  const family = buildFamilyMeta(group);
  let updated = 0;
  let skipped = 0;

  for (const product of group) {
    const enrichment = await ensureEnrichment(product);
    const variantAttributes = buildVariantAttributes(product);

    enrichment.category = family.category || enrichment.category;
    enrichment.subcategory = family.subcategory || enrichment.subcategory;

    enrichment.title = family.familyTitle || enrichment.title;
    enrichment.shortTitle = family.familyShortTitle || enrichment.shortTitle;
    enrichment.shortDescription =
      enrichment.shortDescription ||
      `${family.familyTitle}${product?.fishbowl?.partNum ? ` (${product.fishbowl.partNum})` : ""}`;

    enrichment.description = family.familyDescription || enrichment.description;

    enrichment.websiteBrand = product.brand || enrichment.websiteBrand || "";
    enrichment.websiteVendor = product.vendor || enrichment.websiteVendor || "";

    enrichment.tags = uniq([
      ...(Array.isArray(enrichment.tags) ? enrichment.tags : []),
      ...family.familyTags,
    ]);

    enrichment.attributes = {
      ...(enrichment.attributes || {}),
      ...variantAttributes,
      familyKey: family.familyKey,
      familySlug: family.familySlug,
      familyTitle: family.familyTitle,
      familyAttributeOptions: family.familyAttributeOptions,
    };

    enrichment.seo = {
      ...(enrichment.seo || {}),
      slug:
        enrichment.seo?.slug ||
        slugify(`${family.familyTitle} ${product?.fishbowl?.partNum || product?.sku || ""}`),
      metaTitle: enrichment.seo?.metaTitle || family.familyTitle,
      metaDescription: enrichment.seo?.metaDescription || family.familyDescription,
      keywords: uniq([
        ...(Array.isArray(enrichment.seo?.keywords) ? enrichment.seo.keywords : []),
        ...family.familyTags,
      ]),
      canonicalUrl: enrichment.seo?.canonicalUrl || "",
    };

    if (enrichment.contentStatus === "empty") {
      enrichment.contentStatus = "auto-mapped";
    }

    await enrichment.save();

    if (!product.hasEnrichment) {
      product.hasEnrichment = true;
    }

    if (product.catalogStatus === "draft" || product.catalogStatus === "mapped") {
      product.catalogStatus = "enriched";
    }

    await product.save();

    updated += 1;
  }

  return {
    updated,
    skipped,
    familyKey: family.familyKey,
    familyTitle: family.familyTitle,
    category: family.category,
    subcategory: family.subcategory,
    products: group.map((p) => ({
      productId: p._id,
      sku: p.sku,
      fishbowlPartNum: p?.fishbowl?.partNum || "",
    })),
  };
}

export async function buildProductFamilies({
  productIds = [],
  category = "",
  subcategory = "",
  limit = 0,
  dryRun = false,
} = {}) {
  const query = {};

  if (Array.isArray(productIds) && productIds.length > 0) {
    query._id = { $in: productIds };
  }

  const products = await Product.find(query);

  let filtered = products.filter((product) => {
    const normalized = getNormalizedTaxonomy(product);

    if (category && clean(category).toLowerCase() !== clean(normalized.category).toLowerCase()) {
      return false;
    }

    if (
      subcategory &&
      clean(subcategory).toLowerCase() !== clean(normalized.subcategory).toLowerCase()
    ) {
      return false;
    }

    return true;
  });

  if (limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  const grouped = new Map();

  for (const product of filtered) {
    const familyKey = buildFamilyKey(product);
    if (!familyKey) continue;

    if (!grouped.has(familyKey)) grouped.set(familyKey, []);
    grouped.get(familyKey).push(product);
  }

  const syncRun = await SyncRun.create({
    jobType: "product-enrichment-pass",
    status: "running",
    startedAt: new Date(),
    stats: {
      found: filtered.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    errors: [],
    notes: dryRun ? "Dry run family generation pass" : "Family generation pass",
  });

  try {
    const results = [];

    for (const [familyKey, group] of grouped.entries()) {
      try {
        if (dryRun) {
          const familyMeta = buildFamilyMeta(group);

          results.push({
            status: "dry-run",
            familyKey,
            familyTitle: familyMeta.familyTitle,
            category: familyMeta.category,
            subcategory: familyMeta.subcategory,
            count: group.length,
            products: group.map((p) => ({
              productId: p._id,
              sku: p.sku,
              fishbowlPartNum: p?.fishbowl?.partNum || "",
            })),
          });

          syncRun.stats.skipped += group.length;
          continue;
        }

        const result = await applyFamilyToGroup(group);
        syncRun.stats.updated += result.updated;

        results.push({
          status: "updated",
          ...result,
          count: group.length,
        });
      } catch (error) {
        syncRun.stats.failed += group.length;
        syncRun.errors.push({
          key: familyKey,
          message: error.message,
          payload: group.map((p) => ({
            productId: p._id,
            sku: p.sku,
            fishbowlPartNum: p?.fishbowl?.partNum || "",
          })),
        });
      }
    }

    syncRun.status = syncRun.stats.failed > 0 ? "partial" : "success";
    syncRun.finishedAt = new Date();
    await syncRun.save();

    return {
      syncRun,
      results,
      familyCount: grouped.size,
    };
  } catch (error) {
    syncRun.status = "failed";
    syncRun.finishedAt = new Date();
    syncRun.errors.push({
      key: "build-product-families",
      message: error.message,
      payload: null,
    });
    await syncRun.save();
    throw error;
  }
}

export default buildProductFamilies;
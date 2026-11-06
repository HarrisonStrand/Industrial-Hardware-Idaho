import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import VendorOffering from "../../models/VendorOffering.js";
import { getCatalogPageFilters } from "./catalogLayoutDefaults.js";
import { catalogNamePattern } from "./getCatalogBuilderSubcategory.js";
import { buildReviewerInfo, findPreviewRows, isDraftPreview } from "./draftPreview.js";
import { isListedForImage } from "./productImageVisibility.js";

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Same tolerant match as the range-list pages: the page id "hole-saws-cutters" finds the
// stored name "hole saws & cutters", and "blades-wheels-bits" finds "blades, wheels & bits".
function catalogValueRegex(value = "") {
  return new RegExp(catalogNamePattern(value), "i");
}

function clean(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value = "") {
  return clean(value).toLowerCase();
}

function firstAttribute(attributes = {}, keys = []) {
  for (const key of keys) {
    const value = clean(attributes?.[key] || "");
    if (value) return value;
  }
  return "";
}

function getProductType(enrichment = {}) {
  return firstAttribute(enrichment?.attributes || {}, [
    "productType",
    "familyType",
    "fastenerTypeCanonical",
    "fastenerType",
    "washerType",
  ]);
}

function getMaterialFinish(enrichment = {}) {
  const attrs = enrichment?.attributes || {};
  const direct = firstAttribute(attrs, [
    "materialFinish",
    "displayMaterial",
    "displayFinish",
  ]);

  if (direct) return direct;

  return [clean(attrs.material), clean(attrs.finish)].filter(Boolean).join(" / ");
}

function getFacetValues(enrichment = {}) {
  const attrs = enrichment?.attributes || {};

  return {
    productType: getProductType(enrichment),
    grade: clean(attrs.grade || ""),
    materialFinish: getMaterialFinish(enrichment),
    measurementSystem: clean(attrs.measurementSystem || ""),
  };
}

function matchesFacet(enrichment, key, selectedValue) {
  if (!selectedValue) return true;
  const values = getFacetValues(enrichment);
  return normalize(values[key]) === normalize(selectedValue);
}

function sortedUnique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function buildFacets(enrichments = []) {
  const values = enrichments.map(getFacetValues);

  return {
    productTypes: sortedUnique(values.map((item) => item.productType)),
    grades: sortedUnique(values.map((item) => item.grade)),
    materialFinishes: sortedUnique(values.map((item) => item.materialFinish)),
    measurementSystems: sortedUnique(
      values.map((item) => item.measurementSystem)
    ),
  };
}

// "1-1/8" -> 1.125, "3/16" -> 0.1875, "10mm" -> inches. NaN when it is not a size.
export function parseSizeValue(value = "") {
  const raw = clean(value).toLowerCase().replace(/["\u201d]|\s*in\.?$/g, "");
  const mm = raw.match(/^(\d+(?:\.\d+)?)\s*mm$/);
  if (mm) return Number(mm[1]) / 25.4;
  const mixed = raw.match(/^(?:(\d+)[-\s])?(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1] || 0) + Number(mixed[2]) / Number(mixed[3]);
  }
  return /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}

function sortFilterValues(values = [], sort = "") {
  const unique = sortedUnique(values);
  if (sort !== "size") return unique;

  return unique.sort((a, b) => {
    const sizeA = parseSizeValue(a);
    const sizeB = parseSizeValue(b);
    if (Number.isNaN(sizeA) || Number.isNaN(sizeB)) {
      if (Number.isNaN(sizeA) !== Number.isNaN(sizeB)) return Number.isNaN(sizeA) ? 1 : -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    }
    return sizeA - sizeB;
  });
}

function getAttributeValue(enrichment = {}, key = "") {
  const value = enrichment?.attributes?.[key];
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [clean(value)].filter(Boolean);
}

// Each page filter lists the values found on the page; a choice keeps rows holding that value.
export function buildAttributeFacets(enrichments = [], pageFilters = []) {
  return pageFilters
    .map((filter) => ({
      ...filter,
      values: sortFilterValues(
        enrichments.flatMap((enrichment) => getAttributeValue(enrichment, filter.key)),
        filter.sort
      ),
    }))
    .filter((facet) => facet.values.length > 0);
}

export function matchesAttributeFilters(enrichment = {}, pageFilters = [], selected = {}) {
  return pageFilters.every((filter) => {
    const wanted = normalize(selected?.[filter.key]);
    if (!wanted) return true;
    return getAttributeValue(enrichment, filter.key).some((value) => normalize(value) === wanted);
  });
}

const EMPTY_FACETS = {
  productTypes: [],
  grades: [],
  materialFinishes: [],
  measurementSystems: [],
};

// Draft preview: same order as the live query (merchandising.sortOrder, title, newest first), on the overlaid rows.
function comparePreviewRows(a, b) {
  return (
    Number(a?.merchandising?.sortOrder || 0) - Number(b?.merchandising?.sortOrder || 0) ||
    String(a?.title || "").localeCompare(String(b?.title || "")) ||
    new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
  );
}

// Draft preview only: the rows a shopper would see once every staged draft is promoted.
async function findPreviewCatalogRows(enrichmentQuery) {
  const { enrichments, productMap } = await findPreviewRows({
    ProductEnrichment,
    Product,
    query: enrichmentQuery,
    productCommon: { isActive: true },
    productPublished: { isPublished: true, catalogStatus: "published" },
  });
  return { publicEnrichments: enrichments.sort(comparePreviewRows), productMap };
}

export async function getPublishedCatalog(filters = {}) {
  const {
    category,
    subcategory,
    search,
    productType,
    grade,
    materialFinish,
    measurementSystem,
    attributeFilters = {},
    limit = 24,
    skip = 0,
  } = filters;
  const pageFilters =
    category && subcategory ? getCatalogPageFilters(category, subcategory) : [];

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 24));
  const safeSkip = Math.max(0, Number(skip) || 0);

  const productQuery = {
    isPublished: true,
    isActive: true,
    catalogStatus: "published",
  };

  const enrichmentQuery = {};

  if (category) {
    enrichmentQuery.category = catalogValueRegex(category);
  }

  if (subcategory) {
    enrichmentQuery.subcategory = catalogValueRegex(subcategory);
  }

  if (search && search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), "i");
    enrichmentQuery.$or = [
      { title: regex },
      { shortTitle: regex },
      { description: regex },
      { shortDescription: regex },
      { tags: regex },
      { "seo.keywords": regex },
      { "attributes.fishbowlPartNum": regex },
      { "attributes.sku": regex },
    ];
  }

  const preview = isDraftPreview();
  let productMap;
  let publicEnrichments;

  if (preview) {
    ({ publicEnrichments, productMap } = await findPreviewCatalogRows(enrichmentQuery));
    if (!publicEnrichments.length) {
      return {
        items: [],
        total: 0,
        limit: safeLimit,
        skip: safeSkip,
        page: 1,
        totalPages: 0,
        facets: { ...EMPTY_FACETS },
        attributeFacets: [],
      };
    }
  } else {
    // Fetch matching enrichment records first, then apply the public Product
    // visibility rule before pagination. This prevents pages from appearing
    // partially empty when an enrichment belongs to an unpublished product.
    const candidateEnrichments = await ProductEnrichment.find(enrichmentQuery)
      .sort({ "merchandising.sortOrder": 1, title: 1, createdAt: -1 })
      .lean();

    if (!candidateEnrichments.length) {
      return {
        items: [],
        total: 0,
        limit: safeLimit,
        skip: safeSkip,
        page: 1,
        totalPages: 0,
        facets: {
          productTypes: [],
          grades: [],
          materialFinishes: [],
          measurementSystems: [],
        },
        attributeFacets: [],
      };
    }

    const candidateProductIds = candidateEnrichments.map((item) => item.productId);

    const publishedProducts = await Product.find({
      ...productQuery,
      _id: { $in: candidateProductIds },
    }).lean();

    productMap = new Map(
      publishedProducts.map((product) => [String(product._id), product])
    );

    publicEnrichments = candidateEnrichments.filter((enrichment) =>
      productMap.has(String(enrichment.productId))
    );
  }

  publicEnrichments = publicEnrichments.filter(isListedForImage);

  // Facets are calculated before the selected facet filters are applied so
  // customers can switch between every available type in the subcategory.
  const facets = buildFacets(publicEnrichments);
  const attributeFacets = buildAttributeFacets(publicEnrichments, pageFilters);

  const filteredEnrichments = publicEnrichments.filter((enrichment) => {
    return (
      matchesFacet(enrichment, "productType", productType) &&
      matchesFacet(enrichment, "grade", grade) &&
      matchesFacet(enrichment, "materialFinish", materialFinish) &&
      matchesFacet(enrichment, "measurementSystem", measurementSystem) &&
      matchesAttributeFilters(enrichment, pageFilters, attributeFilters)
    );
  });

  const total = filteredEnrichments.length;
  const pageEnrichments = filteredEnrichments.slice(
    safeSkip,
    safeSkip + safeLimit
  );
  const pageProductIds = pageEnrichments.map((item) => item.productId);

  const offerings = pageProductIds.length
    ? await VendorOffering.find({
        productId: { $in: pageProductIds },
        isActive: true,
        approvalStatus: "approved",
      }).lean()
    : [];

  const offeringsByProductId = new Map();

  for (const offering of offerings) {
    const key = String(offering.productId);
    if (!offeringsByProductId.has(key)) {
      offeringsByProductId.set(key, []);
    }
    offeringsByProductId.get(key).push(offering);
  }

  const items = pageEnrichments
    .map((enrichment) => {
      const product = productMap.get(String(enrichment.productId));
      if (!product) return null;

      const productOfferings =
        offeringsByProductId.get(String(enrichment.productId)) || [];

      const preferredOffering =
        productOfferings.find((offering) => offering.isPreferred) ||
        productOfferings[0] ||
        null;

      const facetValues = getFacetValues(enrichment);

      return {
        productId: product._id,
        enrichmentId: enrichment._id,
        sku: product.sku,
        internalPartNumber: product.internalPartNumber,
        slug: enrichment?.seo?.slug || "",
        title: enrichment.title,
        shortTitle: enrichment.shortTitle,
        shortDescription: enrichment.shortDescription,
        category: enrichment.category,
        subcategory: enrichment.subcategory,
        tags: enrichment.tags || [],
        image:
          enrichment.images?.find((image) => image.isPrimary)?.url ||
          enrichment.images?.[0]?.url ||
          "",
        price:
          preferredOffering?.pricing?.price ??
          product?.pricing?.basePrice ??
          null,
        currency:
          preferredOffering?.pricing?.currency ||
          product?.pricing?.currency ||
          "USD",
        vendorName: preferredOffering?.vendorName || "",
        inStock: (preferredOffering?.inventory?.qtyAvailable || 0) > 0,
        qtyAvailable: preferredOffering?.inventory?.qtyAvailable || 0,
        productType: facetValues.productType,
        grade: facetValues.grade,
        materialFinish: facetValues.materialFinish,
        measurementSystem: facetValues.measurementSystem,
        ...(preview ? { preview: buildReviewerInfo(product, enrichment) } : {}),
      };
    })
    .filter(Boolean);

  return {
    items,
    total,
    limit: safeLimit,
    skip: safeSkip,
    page: total ? Math.floor(safeSkip / safeLimit) + 1 : 1,
    totalPages: total ? Math.ceil(total / safeLimit) : 0,
    facets,
    attributeFacets,
  };
}

export default getPublishedCatalog;

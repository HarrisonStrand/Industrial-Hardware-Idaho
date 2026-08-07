import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import VendorOffering from "../../models/VendorOffering.js";

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function catalogValueRegex(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "bits drivers" || normalized === "bits and drivers") {
    return /^bits\s*(?:(?:&|and)\s*)?drivers$/i;
  }

  return new RegExp(`^${escapeRegex(normalized)}$`, "i");
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

export async function getPublishedCatalog(filters = {}) {
  const {
    category,
    subcategory,
    search,
    productType,
    grade,
    materialFinish,
    measurementSystem,
    limit = 24,
    skip = 0,
  } = filters;

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
    };
  }

  const candidateProductIds = candidateEnrichments.map((item) => item.productId);

  const publishedProducts = await Product.find({
    ...productQuery,
    _id: { $in: candidateProductIds },
  }).lean();

  const productMap = new Map(
    publishedProducts.map((product) => [String(product._id), product])
  );

  const publicEnrichments = candidateEnrichments.filter((enrichment) =>
    productMap.has(String(enrichment.productId))
  );

  // Facets are calculated before the selected facet filters are applied so
  // customers can switch between every available type in the subcategory.
  const facets = buildFacets(publicEnrichments);

  const filteredEnrichments = publicEnrichments.filter((enrichment) => {
    return (
      matchesFacet(enrichment, "productType", productType) &&
      matchesFacet(enrichment, "grade", grade) &&
      matchesFacet(enrichment, "materialFinish", materialFinish) &&
      matchesFacet(enrichment, "measurementSystem", measurementSystem)
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
  };
}

export default getPublishedCatalog;

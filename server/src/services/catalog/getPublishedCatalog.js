import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import VendorOffering from "../../models/VendorOffering.js";

export async function getPublishedCatalog(filters = {}) {
  const {
    category,
    subcategory,
    search,
    limit = 50,
    skip = 0,
  } = filters;

  const productQuery = {
    isPublished: true,
    isActive: true,
    catalogStatus: "published",
  };

  const enrichmentQuery = {};

  if (category) {
    enrichmentQuery.category = category;
  }

  if (subcategory) {
    enrichmentQuery.subcategory = subcategory;
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    enrichmentQuery.$or = [
      { title: regex },
      { shortTitle: regex },
      { description: regex },
      { tags: regex },
      { "seo.keywords": regex },
    ];
  }

  const enrichments = await ProductEnrichment.find(enrichmentQuery)
    .sort({ "merchandising.sortOrder": 1, createdAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();

  if (!enrichments.length) {
    return {
      items: [],
      total: 0,
    };
  }

  const productIds = enrichments.map((e) => e.productId);

  const products = await Product.find({
    ...productQuery,
    _id: { $in: productIds },
  }).lean();

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const publishedProductIds = products.map((p) => p._id);

  const offerings = await VendorOffering.find({
    productId: { $in: publishedProductIds },
    isActive: true,
    approvalStatus: "approved",
  }).lean();

  const offeringsByProductId = new Map();

  for (const offering of offerings) {
    const key = String(offering.productId);
    if (!offeringsByProductId.has(key)) {
      offeringsByProductId.set(key, []);
    }
    offeringsByProductId.get(key).push(offering);
  }

  const items = enrichments
    .map((enrichment) => {
      const product = productMap.get(String(enrichment.productId));
      if (!product) return null;

      const productOfferings =
        offeringsByProductId.get(String(enrichment.productId)) || [];

      const preferredOffering =
        productOfferings.find((o) => o.isPreferred) || productOfferings[0] || null;

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
          enrichment.images?.find((img) => img.isPrimary)?.url ||
          enrichment.images?.[0]?.url ||
          "",
        price: preferredOffering?.pricing?.price ?? product?.pricing?.basePrice ?? null,
        currency:
          preferredOffering?.pricing?.currency ||
          product?.pricing?.currency ||
          "USD",
        vendorName: preferredOffering?.vendorName || "",
        inStock:
          (preferredOffering?.inventory?.qtyAvailable || 0) > 0,
        qtyAvailable: preferredOffering?.inventory?.qtyAvailable || 0,
      };
    })
    .filter(Boolean);

  return {
    items,
    total: items.length,
  };
}

export default getPublishedCatalog;
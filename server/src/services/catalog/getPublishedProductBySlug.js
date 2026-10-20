import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import VendorOffering from "../../models/VendorOffering.js";

export async function getPublishedProductBySlug(slug) {
  if (!slug) {
    throw new Error("slug is required");
  }

  // Find all enrichments with this slug in case older test data created duplicates
  const enrichments = await ProductEnrichment.find({
    "seo.slug": slug,
  }).lean();

  if (!enrichments.length) {
    return null;
  }

  const productIds = enrichments.map((e) => e.productId);

  const products = await Product.find({
    _id: { $in: productIds },
    isPublished: true,
    isActive: true,
    catalogStatus: "published",
  }).lean();

  if (!products.length) {
    return null;
  }

  // Pick the published product and its matching enrichment
  const product = products[0];
  const enrichment =
    enrichments.find(
      (e) => String(e.productId) === String(product._id)
    ) || null;

  if (!enrichment) {
    return null;
  }

  const offerings = await VendorOffering.find({
    productId: product._id,
    isActive: true,
    approvalStatus: "approved",
  })
    .sort({ isPreferred: -1, leadTimeDays: 1, "pricing.cost": 1 })
    .lean();

  const preferredOffering =
    offerings.find((o) => o.isPreferred) || offerings[0] || null;

  return {
    productId: product._id,
    enrichmentId: enrichment._id,

    sku: product.sku,
    internalPartNumber: product.internalPartNumber,

    slug: enrichment?.seo?.slug || "",
    title: enrichment.title,
    shortTitle: enrichment.shortTitle,
    description: enrichment.description,
    shortDescription: enrichment.shortDescription,
    bulletPoints: enrichment.bulletPoints || [],

    category: enrichment.category,
    subcategory: enrichment.subcategory,
    tags: enrichment.tags || [],
    attributes: enrichment.attributes || {},

    images: enrichment.images || [],

    // Downloadable PDFs (spec sheet, SDS, catalog page, instructions, warranty) the product has.
    // Only the fields a shopper needs; a document without a URL is left out.
    documents: (enrichment.documents || [])
      .filter((doc) => doc && doc.url)
      .map((doc) => ({ type: doc.type || "", title: doc.title || "", url: doc.url })),

    // Specifications: the maker's stated facts and the minimum properties of the part's grade from its
    // published standard. Each keeps its basis and reference so the page can say where a value comes from.
    specs: (enrichment.specs || [])
      .filter((spec) => spec && spec.name && spec.value)
      .map((spec) => ({
        group: spec.group || "",
        name: spec.name,
        value: spec.value,
        unit: spec.unit || "",
        basis: spec.basis || "",
        reference: spec.reference || "",
        sourceUrl: spec.sourceUrl || "",
      })),

    seo: enrichment.seo || {},

    pricing: {
      basePrice: product?.pricing?.basePrice ?? null,
      preferredVendorPrice: preferredOffering?.pricing?.price ?? null,
      currency:
        preferredOffering?.pricing?.currency ||
        product?.pricing?.currency ||
        "USD",
    },

    inventory: {
      qtyAvailable: product?.inventory?.qtyAvailable ?? 0,
      qtyOnHand: product?.inventory?.qtyOnHand ?? 0,
      qtyAllocated: product?.inventory?.qtyAllocated ?? 0,
      qtyOnOrder: product?.inventory?.qtyOnOrder ?? 0,
    },

    preferredVendor: preferredOffering
      ? {
          vendorOfferingId: preferredOffering._id,
          vendorName: preferredOffering.vendorName,
          brandName: preferredOffering.brandName,
          vendorPartNumber: preferredOffering.vendorPartNumber,
          qtyAvailable: preferredOffering?.inventory?.qtyAvailable ?? 0,
          leadTimeDays: preferredOffering?.leadTimeDays ?? null,
          price: preferredOffering?.pricing?.price ?? null,
          currency: preferredOffering?.pricing?.currency ?? "USD",
          isSelectableByCustomer: !!preferredOffering.isSelectableByCustomer,
        }
      : null,

    vendorOptions: offerings.map((offering) => ({
      vendorOfferingId: offering._id,
      vendorName: offering.vendorName,
      brandName: offering.brandName,
      vendorPartNumber: offering.vendorPartNumber,
      qtyAvailable: offering?.inventory?.qtyAvailable ?? 0,
      qtyOnHand: offering?.inventory?.qtyOnHand ?? 0,
      leadTimeDays: offering?.leadTimeDays ?? null,
      price: offering?.pricing?.price ?? null,
      currency: offering?.pricing?.currency ?? "USD",
      isPreferred: !!offering.isPreferred,
      isSelectableByCustomer: !!offering.isSelectableByCustomer,
    })),
  };
}

export default getPublishedProductBySlug;
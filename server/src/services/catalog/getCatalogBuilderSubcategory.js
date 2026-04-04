import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import VendorOffering from "../../models/VendorOffering.js";

function toTitle(value = "") {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, " ");
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectAttributeOptions(variants = []) {
  const map = new Map();

  for (const variant of variants) {
    const attrs = variant.attributes || {};

    for (const [key, value] of Object.entries(attrs)) {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        ["fishbowlPartNum", "sku", "internalPartNumber"].includes(key)
      ) {
        continue;
      }

      if (!map.has(key)) map.set(key, new Set());

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null && item !== "") {
            map.get(key).add(String(item));
          }
        }
      } else {
        map.get(key).add(String(value));
      }
    }
  }

  const result = {};
  for (const [key, values] of map.entries()) {
    result[key] = Array.from(values);
  }

  return result;
}

function groupVariantsByFamily(variants = []) {
  const families = new Map();

  for (const variant of variants) {
    const attrs = variant.attributes || {};
    const familyKey = attrs.familyKey || "ungrouped";

    if (!families.has(familyKey)) {
      families.set(familyKey, {
        familyKey,
        familySlug: attrs.familySlug || "",
        familyTitle: attrs.familyTitle || variant.name || "Product Family",
        familyDescription: variant.description || "",
        familyAttributeOptions: attrs.familyAttributeOptions || {},
        image: variant.image || "",
        variants: [],
      });
    }

    families.get(familyKey).variants.push(variant);
  }

  return Array.from(families.values()).sort((a, b) =>
    String(a.familyTitle || "").localeCompare(String(b.familyTitle || ""))
  );
}

export async function getCatalogBuilderSubcategory(categoryId, subcategoryId) {
  const normalizedCategoryId = normalizeSlug(categoryId);
  const normalizedSubcategoryId = normalizeSlug(subcategoryId);

  if (!normalizedCategoryId || !normalizedSubcategoryId) {
    throw new Error("categoryId and subcategoryId are required");
  }

  console.log("==== CATALOG BUILDER DEBUG START ====");
  console.log("raw params:", { categoryId, subcategoryId });
  console.log("normalized params:", {
    normalizedCategoryId,
    normalizedSubcategoryId,
  });

  const enrichments = await ProductEnrichment.find({
    category: new RegExp(`^${escapeRegex(normalizedCategoryId)}$`, "i"),
    subcategory: new RegExp(`^${escapeRegex(normalizedSubcategoryId)}$`, "i"),
  }).lean();

  console.log("matching enrichments:", enrichments.length);
  console.log(
    "enrichment sample:",
    enrichments.map((e) => ({
      id: e._id,
      productId: e.productId,
      category: e.category,
      subcategory: e.subcategory,
      title: e.title,
      attributes: e.attributes,
    }))
  );

  if (!enrichments.length) {
    console.log("No matching enrichments found for builder query.");
    console.log("==== CATALOG BUILDER DEBUG END ====");

    return {
      categoryId: String(categoryId || ""),
      subcategoryId: String(subcategoryId || ""),
      name: toTitle(subcategoryId),
      description: "",
      image: "",
      attributes: {},
      families: [],
      variants: [],
    };
  }

  const productIds = enrichments.map((e) => e.productId);

  const products = await Product.find({
    _id: { $in: productIds },
  }).lean();

  console.log("matched products:", products.length);
  console.log(
    "product sample:",
    products.map((p) => ({
      id: p._id,
      sku: p.sku,
      internalPartNumber: p.internalPartNumber,
      isPublished: p.isPublished,
      isActive: p.isActive,
      catalogStatus: p.catalogStatus,
      fishbowlPartNum: p?.fishbowl?.partNum,
    }))
  );

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const matchedProductIds = products.map((p) => p._id);

  const offerings = await VendorOffering.find({
    productId: { $in: matchedProductIds },
  }).lean();

  console.log("matched offerings:", offerings.length);
  console.log(
    "offering sample:",
    offerings.map((o) => ({
      id: o._id,
      productId: o.productId,
      vendorName: o.vendorName,
      vendorPartNumber: o.vendorPartNumber,
      isActive: o.isActive,
      approvalStatus: o.approvalStatus,
      isPreferred: o.isPreferred,
      price: o?.pricing?.price,
      qtyAvailable: o?.inventory?.qtyAvailable,
    }))
  );

  const offeringsByProductId = new Map();

  for (const offering of offerings) {
    const key = String(offering.productId);
    if (!offeringsByProductId.has(key)) offeringsByProductId.set(key, []);
    offeringsByProductId.get(key).push(offering);
  }

  const variants = enrichments
    .map((enrichment) => {
      const product = productMap.get(String(enrichment.productId));
      if (!product) {
        console.log("Skipping enrichment with no matching product:", {
          enrichmentId: enrichment._id,
          enrichmentProductId: enrichment.productId,
        });
        return null;
      }

      const productOfferings =
        offeringsByProductId.get(String(enrichment.productId)) || [];

      const preferredOffering =
        productOfferings.find((o) => o.isPreferred) || productOfferings[0] || null;

      return {
        productId: product._id,
        enrichmentId: enrichment._id,
        slug: enrichment?.seo?.slug || "",
        sku: product.sku || "",
        internalPartNumber: product.internalPartNumber || "",
        partNumber:
          enrichment?.attributes?.fishbowlPartNum ||
          product?.fishbowl?.partNum ||
          product?.sku ||
          "",
        name: enrichment.title || product.name || toTitle(subcategoryId),
        shortDescription: enrichment.shortDescription || "",
        description: enrichment.description || "",
        image:
          enrichment.images?.find((img) => img.isPrimary)?.url ||
          enrichment.images?.[0]?.url ||
          "",
        attributes: {
          ...(enrichment.attributes || {}),
        },
        price: preferredOffering?.pricing?.price ?? product?.pricing?.basePrice ?? 0,
        vendorOfferingId: preferredOffering?._id || null,
        vendorName: preferredOffering?.vendorName || "",
        vendorPartNumber: preferredOffering?.vendorPartNumber || "",
        qtyAvailable: preferredOffering?.inventory?.qtyAvailable ?? 0,
        inStock: (preferredOffering?.inventory?.qtyAvailable ?? 0) > 0,
      };
    })
    .filter(Boolean);

  console.log("final variants built:", variants.length);
  console.log(
    "variant sample:",
    variants.map((v) => ({
      productId: v.productId,
      enrichmentId: v.enrichmentId,
      partNumber: v.partNumber,
      name: v.name,
      attributes: v.attributes,
      vendorOfferingId: v.vendorOfferingId,
      vendorName: v.vendorName,
      price: v.price,
      inStock: v.inStock,
    }))
  );

  const families = groupVariantsByFamily(variants);
  const first = variants[0];

  const result = {
    categoryId: String(categoryId || ""),
    subcategoryId: String(subcategoryId || ""),
    name: toTitle(subcategoryId),
    description: first?.description || "",
    image: first?.image || "",
    attributes: collectAttributeOptions(variants),
    families,
    variants,
  };

  console.log("family count:", families.length);
  console.log(
    "family sample:",
    families.map((f) => ({
      familyKey: f.familyKey,
      familySlug: f.familySlug,
      familyTitle: f.familyTitle,
      variantCount: f.variants.length,
    }))
  );

  console.log("final attribute keys:", Object.keys(result.attributes || {}));
  console.log("==== CATALOG BUILDER DEBUG END ====");

  return result;
}

export default getCatalogBuilderSubcategory;
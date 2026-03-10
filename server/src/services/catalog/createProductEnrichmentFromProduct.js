import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))];
}

function slugify(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildTitle({ parsed = {}, fallbackDescription = "", fallbackPartNum = "" }) {
  const parts = [
    parsed.size,
    parsed.length ? `x ${parsed.length}` : "",
    parsed.finish,
    parsed.material,
    parsed.grade,
    parsed.fastenerType,
  ].filter(Boolean);

  const generated = cleanText(parts.join(" "));

  if (generated) return generated;
  if (fallbackDescription) return cleanText(fallbackDescription);
  if (fallbackPartNum) return cleanText(fallbackPartNum);
  return "Untitled Product";
}

function buildShortTitle({ parsed = {}, fallbackDescription = "", fallbackPartNum = "" }) {
  const parts = [
    parsed.size,
    parsed.finish,
    parsed.fastenerType,
  ].filter(Boolean);

  const generated = cleanText(parts.join(" "));

  if (generated) return generated;
  if (fallbackDescription) return cleanText(fallbackDescription);
  if (fallbackPartNum) return cleanText(fallbackPartNum);
  return "Untitled Product";
}

function buildShortDescription({ title = "", product = null }) {
  const partNum = product?.fishbowl?.partNum || product?.sku || "";
  return cleanText(
    `${title}${partNum ? ` (${partNum})` : ""}`.trim()
  );
}

function buildDescription({ title = "", parsed = {}, product = null }) {
  const lines = [];

  if (title) {
    lines.push(`${title} is a catalog item imported from Fishbowl and prepared for ecommerce enrichment.`);
  }

  const specBits = [
    parsed.size ? `Size: ${parsed.size}` : "",
    parsed.length ? `Length: ${parsed.length}` : "",
    parsed.material ? `Material: ${parsed.material}` : "",
    parsed.finish ? `Finish: ${parsed.finish}` : "",
    parsed.grade ? `Grade: ${parsed.grade}` : "",
    parsed.fastenerType ? `Type: ${parsed.fastenerType}` : "",
  ].filter(Boolean);

  if (specBits.length > 0) {
    lines.push(`Detected specs include ${specBits.join(", ")}.`);
  }

  if (product?.fishbowl?.partNum) {
    lines.push(`Fishbowl part number: ${product.fishbowl.partNum}.`);
  }

  return cleanText(lines.join(" "));
}

function buildBulletPoints(parsed = {}) {
  return [
    parsed.size ? `Size: ${parsed.size}` : "",
    parsed.diameter ? `Diameter: ${parsed.diameter}` : "",
    parsed.threadPitch ? `Thread Pitch: ${parsed.threadPitch}` : "",
    parsed.length ? `Length: ${parsed.length}` : "",
    parsed.material ? `Material: ${parsed.material}` : "",
    parsed.finish ? `Finish: ${parsed.finish}` : "",
    parsed.grade ? `Grade: ${parsed.grade}` : "",
    parsed.fastenerType ? `Type: ${parsed.fastenerType}` : "",
    parsed.measurementSystem ? `Measurement System: ${parsed.measurementSystem}` : "",
  ].filter(Boolean);
}

function buildTags({ parsed = {}, product = null }) {
  return uniqueStrings([
    parsed.category ? slugify(parsed.category) : "",
    parsed.subcategory ? slugify(parsed.subcategory) : "",
    parsed.fastenerType ? slugify(parsed.fastenerType) : "",
    parsed.finish ? slugify(parsed.finish) : "",
    parsed.material ? slugify(parsed.material) : "",
    parsed.grade ? slugify(parsed.grade) : "",
    ...(Array.isArray(product?.searchKeywords) ? product.searchKeywords.map(slugify) : []),
  ]);
}

function buildAttributes(parsed = {}, product = null) {
  return {
    size: parsed.size || "",
    diameter: parsed.diameter || "",
    threadPitch: parsed.threadPitch || "",
    length: parsed.length || "",
    measurementSystem: parsed.measurementSystem || "",
    material: parsed.material || "",
    finish: parsed.finish || "",
    grade: parsed.grade || "",
    fastenerType: parsed.fastenerType || "",
    fishbowlPartNum: product?.fishbowl?.partNum || "",
    sku: product?.sku || "",
    internalPartNumber: product?.internalPartNumber || "",
  };
}

function buildSeo({ title = "", parsed = {}, product = null }) {
  const slugBase =
    title ||
    product?.fishbowl?.description ||
    product?.fishbowl?.partNum ||
    product?.sku ||
    "product";

  const slug = slugify(slugBase);

  const metaTitle = cleanText(title || product?.fishbowl?.description || product?.sku || "Product");

  const metaDescription = cleanText(
    [
      title || "",
      parsed.finish || "",
      parsed.material || "",
      parsed.fastenerType || "",
    ]
      .filter(Boolean)
      .join(" ")
  );

  return {
    slug,
    metaTitle,
    metaDescription: metaDescription || metaTitle,
    keywords: uniqueStrings([
      ...(parsed.keywords || []),
      ...(Array.isArray(product?.searchKeywords) ? product.searchKeywords : []),
    ]),
    canonicalUrl: "",
  };
}

export async function createProductEnrichmentFromProduct(productId) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  const existing = await ProductEnrichment.findOne({ productId: product._id });

  if (existing) {
    return {
      action: "exists",
      product,
      enrichment: existing,
    };
  }

  const parsed =
    product?.fishbowl?.raw?.parsedAttributes ||
    {};

  const fallbackDescription = cleanText(product?.fishbowl?.description || "");
  const fallbackPartNum = cleanText(product?.fishbowl?.partNum || product?.sku || "");

  const title = buildTitle({
    parsed,
    fallbackDescription,
    fallbackPartNum,
  });

  const shortTitle = buildShortTitle({
    parsed,
    fallbackDescription,
    fallbackPartNum,
  });

  const shortDescription = buildShortDescription({
    title,
    product,
  });

  const description = buildDescription({
    title,
    parsed,
    product,
  });

  const bulletPoints = buildBulletPoints(parsed);

  const category = parsed.category || product.categoryHints?.[0] || "";
  const subcategory = parsed.subcategory || product.categoryHints?.[1] || "";

  const tags = buildTags({ parsed, product });
  const attributes = buildAttributes(parsed, product);
  const seo = buildSeo({ title, parsed, product });

  const enrichment = await ProductEnrichment.create({
    productId: product._id,
    title,
    shortTitle,
    description,
    shortDescription,
    bulletPoints,
    websiteBrand: product.brand || "",
    websiteVendor: product.vendor || "",
    category,
    subcategory,
    tags,
    attributes,
    images: [],
    seo,
    merchandising: {
      badge: "",
      featured: false,
      sortOrder: 0,
      collectionTags: [],
    },
    contentStatus: "auto-mapped",
    imageStatus: "none",
    overrideFlags: {
      lockTitle: false,
      lockDescription: false,
      lockImages: false,
      lockCategory: false,
    },
    notes: "Auto-generated from Product import data and parsed attributes.",
  });

  product.enrichmentId = enrichment._id;
  product.hasEnrichment = true;

  if (product.catalogStatus === "draft" || product.catalogStatus === "mapped") {
    product.catalogStatus = "enriched";
  }

  await product.save();

  return {
    action: "created",
    product,
    enrichment,
  };
}

export default createProductEnrichmentFromProduct;
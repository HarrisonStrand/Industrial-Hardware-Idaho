import Product from "../models/Product.js";
import { resolveProductPrice, getPricingContext } from "./resolveProductPrice.js";

function toObjectIdString(value) {
  if (!value) return null;
  try {
    return String(value);
  } catch {
    return null;
  }
}

function toPositiveNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function buildDetail(raw = {}) {
  if (raw.detail) return String(raw.detail);
  if (raw.shortDescription) return String(raw.shortDescription);
  if (raw?.metadata?.shortDescription) return String(raw.metadata.shortDescription);

  const attrs = raw.attributes || {};
  return [
    attrs?.diameter && attrs?.length ? `${attrs.diameter} × ${attrs.length}` : "",
    attrs?.thread || attrs?.threadPitch || "",
    attrs?.grade || "",
    attrs?.finish || "",
  ]
    .filter(Boolean)
    .join(" • ");
}

function normalizeOne(raw = {}) {
  const qty = Math.max(1, Math.round(toPositiveNumber(raw.qty ?? raw.quantity, 1)));
  const unitPrice = toPositiveNumber(raw.unitPrice ?? raw.price, 0);

  return {
    productId: toObjectIdString(raw.productId),
    partNumber: String(raw.partNumber || raw.sku || "").trim(),
    sku: String(raw.sku || raw.partNumber || "").trim(),
    name: String(raw.name || raw.partNumber || raw.sku || "Product").trim(),
    detail: buildDetail(raw),
    qty,
    unitPrice,
    lineTotal: Number((qty * unitPrice).toFixed(2)),
    category: String(raw.category || raw?.metadata?.category || "").trim(),
    subcategory: String(raw.subcategory || raw?.metadata?.subcategory || "").trim(),
    shortDescription: String(
      raw.shortDescription || raw?.metadata?.shortDescription || ""
    ).trim(),
    groupedPartNumbers: Array.isArray(raw.groupedPartNumbers)
      ? raw.groupedPartNumbers.map(String)
      : Array.isArray(raw?.metadata?.groupedPartNumbers)
      ? raw.metadata.groupedPartNumbers.map(String)
      : [],
    duplicateCount: Math.max(
      1,
      Math.round(
        toPositiveNumber(raw.duplicateCount ?? raw?.metadata?.duplicateCount, 1)
      )
    ),
    attributes:
      raw.attributes && typeof raw.attributes === "object" && !Array.isArray(raw.attributes)
        ? raw.attributes
        : {},
  };
}

export async function normalizeOrderItems(
  items = [],
  {
    pricingContext = {},
    repriceFromProducts = true,
  } = {}
) {
  if (!Array.isArray(items)) return [];

  const normalized = items
    .map(normalizeOne)
    .filter((item) => item.partNumber || item.sku || item.productId);

  if (!normalized.length) return [];

  if (!repriceFromProducts) {
    return normalized.map((item) => ({
      ...item,
      lineTotal: Number((item.qty * item.unitPrice).toFixed(2)),
    }));
  }

  const productIds = normalized.map((item) => item.productId).filter(Boolean);
  const partNumbers = normalized.map((item) => item.partNumber).filter(Boolean);
  const skus = normalized.map((item) => item.sku).filter(Boolean);

  const orClauses = [];
  if (productIds.length) orClauses.push({ _id: { $in: productIds } });
  if (partNumbers.length) orClauses.push({ "fishbowl.partNum": { $in: partNumbers } });
  if (skus.length) orClauses.push({ sku: { $in: skus } });

  const products = orClauses.length
    ? await Product.find({ $or: orClauses }).lean()
    : [];

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const productByPartNumber = new Map(
    products
      .filter((product) => product?.fishbowl?.partNum)
      .map((product) => [String(product.fishbowl.partNum), product])
  );
  const productBySku = new Map(
    products
      .filter((product) => product?.sku)
      .map((product) => [String(product.sku), product])
  );

  const resolvedPricingContext = getPricingContext(pricingContext);

  return normalized.map((item) => {
    const product =
      (item.productId && productById.get(String(item.productId))) ||
      (item.partNumber && productByPartNumber.get(String(item.partNumber))) ||
      (item.sku && productBySku.get(String(item.sku))) ||
      null;

    if (!product) {
      return {
        ...item,
        lineTotal: Number((item.qty * item.unitPrice).toFixed(2)),
      };
    }

    const resolved = resolveProductPrice(product, resolvedPricingContext);

    const resolvedPartNumber =
      product?.fishbowl?.partNum || item.partNumber || product?.sku || item.sku || "";

    const resolvedSku =
      product?.sku || item.sku || resolvedPartNumber;

    const resolvedName =
      item.name ||
      product?.fishbowl?.description ||
      resolvedSku ||
      "Product";

    const resolvedUnitPrice = Number(resolved.resolvedPrice || 0);

    return {
      ...item,
      productId: String(product._id),
      partNumber: resolvedPartNumber,
      sku: resolvedSku,
      name: resolvedName,
      unitPrice: resolvedUnitPrice,
      priceSource: resolved.source,
      accountType: resolved.approvedType,
      priceLabel: resolved.label,
      lineTotal: Number((item.qty * resolvedUnitPrice).toFixed(2)),
    };
  });
}

export function calcAmountTotalCents(items = []) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  return Math.max(0, Math.round(subtotal * 100));
}
import VendorOffering from "../models/VendorOffering.js";

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
    vendorOfferingId: toObjectIdString(raw.vendorOfferingId),
    partNumber: String(raw.partNumber || raw.sku || "").trim(),
    name: String(raw.name || raw.partNumber || raw.sku || "Product").trim(),
    detail: buildDetail(raw),
    qty,
    unitPrice,
    lineTotal: Number((qty * unitPrice).toFixed(2)),
    vendorName: String(raw.vendorName || raw?.metadata?.vendorName || "").trim(),
    vendorPartNumber: String(raw.vendorPartNumber || raw?.metadata?.vendorPartNumber || "").trim(),
    attributes:
      raw.attributes && typeof raw.attributes === "object" && !Array.isArray(raw.attributes)
        ? raw.attributes
        : {},
  };
}

export async function normalizeOrderItems(items = [], { repriceFromVendorOfferings = true } = {}) {
  if (!Array.isArray(items)) return [];

  const normalized = items
    .map(normalizeOne)
    .filter((item) => item.partNumber || item.vendorPartNumber || item.vendorOfferingId);

  if (!repriceFromVendorOfferings || normalized.length === 0) {
    return normalized.map((item) => ({
      ...item,
      lineTotal: Number((item.qty * item.unitPrice).toFixed(2)),
    }));
  }

  const vendorOfferingIds = normalized
    .map((item) => item.vendorOfferingId)
    .filter(Boolean);

  if (!vendorOfferingIds.length) {
    return normalized.map((item) => ({
      ...item,
      lineTotal: Number((item.qty * item.unitPrice).toFixed(2)),
    }));
  }

  const offerings = await VendorOffering.find({
    _id: { $in: vendorOfferingIds },
    isActive: true,
    approvalStatus: "approved",
  }).lean();

  const offeringMap = new Map(offerings.map((offering) => [String(offering._id), offering]));

  return normalized.map((item) => {
    const offering = item.vendorOfferingId ? offeringMap.get(String(item.vendorOfferingId)) : null;

    const repricedUnitPrice =
      offering?.pricing?.price != null ? Number(offering.pricing.price) : item.unitPrice;

    const resolvedPartNumber =
      item.partNumber ||
      offering?.fishbowlPartNum ||
      offering?.internalPartNumber ||
      offering?.websiteSku ||
      item.vendorPartNumber ||
      "";

    return {
      ...item,
      productId: item.productId || (offering?.productId ? String(offering.productId) : null),
      vendorName: item.vendorName || offering?.vendorName || "",
      vendorPartNumber: item.vendorPartNumber || offering?.vendorPartNumber || "",
      partNumber: String(resolvedPartNumber).trim(),
      unitPrice: Number.isFinite(repricedUnitPrice) ? repricedUnitPrice : item.unitPrice,
      lineTotal: Number((item.qty * (Number.isFinite(repricedUnitPrice) ? repricedUnitPrice : item.unitPrice)).toFixed(2)),
    };
  });
}

export function calcAmountTotalCents(items = []) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  return Math.max(0, Math.round(subtotal * 100));
}

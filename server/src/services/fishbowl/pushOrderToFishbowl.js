import { fishbowlClient } from "../../integrations/fishbowl/fishbowlClient.js";
import Order from "../../models/Order.js";

function asBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function envString(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value);
}

function truncate(value, max = 255) {
  const text = String(value || "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function cleanState(value = "") {
  return truncate(value, 2).toUpperCase();
}

function money(value = 0) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Number(num.toFixed(4)) : 0;
}

function todayForFishbowl() {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
}

function customerDisplayName(order = {}) {
  return truncate(
    order.customer?.companyName ||
      `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() ||
      order.customer?.email ||
      "WEB CUSTOMER",
    40,
  );
}

function contactDisplayName(order = {}) {
  return truncate(
    `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() ||
      order.customer?.companyName ||
      order.customer?.email ||
      "Website Customer",
    30,
  );
}

function addressName(order = {}, type = "billing") {
  const address = type === "shipping" ? order.shippingAddress || {} : order.billingAddress || {};

  return truncate(
    address.companyName ||
      address.name ||
      order.customer?.companyName ||
      `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() ||
      (type === "shipping" ? "Ship To" : "Bill To"),
    60,
  );
}

function formatAddressLine(address = {}) {
  const line = [address.address1, address.address2].filter(Boolean).join(" ").trim();
  return truncate(line || "N/A", 90);
}

function resolveAddress(order = {}, type = "billing") {
  const fallback = order.billingAddress || {};
  const address = type === "shipping" ? order.shippingAddress || fallback : fallback;

  return {
    address1: formatAddressLine(address),
    city: truncate(address.city || "N/A", 30),
    state: cleanState(address.state || envString("FISHBOWL_SO_DEFAULT_STATE", "ID")),
    zip: truncate(address.zip || "00000", 10),
    country: truncate(envString("FISHBOWL_SO_DEFAULT_COUNTRY", "United States"), 30),
  };
}

function resolveFishbowlPartNumber(item = {}) {
  return truncate(
    item.partNumber ||
      item.vendorPartNumber ||
      item?.attributes?.fishbowlPartNum ||
      item?.attributes?.partNumber ||
      "",
    60,
  );
}

function resolveUom(item = {}) {
  return truncate(
    item.uom ||
      item.unitOfMeasure ||
      item?.attributes?.uom ||
      item?.attributes?.unitOfMeasure ||
      envString("FISHBOWL_SO_DEFAULT_UOM", "ea"),
    30,
  );
}

function resolveItemDescription(item = {}) {
  return truncate(item.name || item.detail || item.description || item.partNumber || "Website order item", 256);
}

function getOrderNote(order = {}) {
  const paymentMode = order.payment?.mode || "";
  const paymentStatus = order.payment?.status || "";
  return truncate(
    `Website order ${order.orderNumber || order._id}. Payment: ${paymentMode} ${paymentStatus}. Customer email: ${order.customer?.email || "N/A"}. PO#: ${order.customerPO || order.poNumber || order.purchaseOrderNumber || "N/A"}.`,
    500,
  );
}

const BASE_SALES_ORDER_DETAIL_HEADERS = [
  "SONum",
  "Status",
  "CustomerName",
  "CustomerContact",
  "BillToName",
  "BillToAddress",
  "BillToCity",
  "BillToState",
  "BillToZip",
  "BillToCountry",
  "ShipToName",
  "ShipToAddress",
  "ShipToCity",
  "ShipToState",
  "ShipToZip",
  "ShipToCountry",
  "ShipToResidential",
  "CarrierName",
  "TaxRateName",
  "PriorityId",
  "PONum",
  "VendorPONum",
  "Date",
  "Salesman",
  "ShippingTerms",
  "PaymentTerms",
  "FOB",
  "Note",
  "QuickBooksClassName",
  "LocationGroupName",
  "OrderDateScheduled",
  "URL",
  "CarrierService",
  "CurrencyName",
  "CurrencyRate",
  "PriceIsHomeCurrency",
  "DateExpired",
  "Phone",
  "Email",
  "Category",
  "SOItemTypeID",
  "ProductNumber",
  "ProductDescription",
  "ProductQuantity",
  "UOM",
  "ProductPrice",
  "Taxable",
  "TaxCode",
  "Note",
];

function normalizeCustomFieldHeader(name = "") {
  const clean = String(name || "").trim().replace(/^CF-/i, "");
  return clean ? `CF-${clean}` : "";
}

function getSalesOrderCustomFields(order = {}) {
  const fields = [];

  const enteredByValue = envString(
    "FISHBOWL_SO_CF_ENTERED_BY",
    envString("FISHBOWL_SO_ENTERED_BY", "Website"),
  );
  const enteredByName = envString("FISHBOWL_SO_CF_ENTERED_BY_NAME", "Entered by");

  if (enteredByValue) {
    fields.push({
      header: normalizeCustomFieldHeader(enteredByName),
      value: truncate(enteredByValue, 255),
    });
  }

  // Optional extra custom fields. Format:
  // FISHBOWL_SO_CUSTOM_FIELDS="Field One=Value One|Field Two=Value Two"
  const rawCustomFields = envString("FISHBOWL_SO_CUSTOM_FIELDS", "");
  for (const pair of rawCustomFields.split("|")) {
    const [rawName, ...rawValueParts] = pair.split("=");
    const header = normalizeCustomFieldHeader(rawName);
    const value = rawValueParts.join("=").trim();
    if (!header || !value) continue;
    if (fields.some((field) => field.header.toLowerCase() === header.toLowerCase())) continue;
    fields.push({ header, value: truncate(value, 255) });
  }

  return fields.filter((field) => field.header && field.value);
}

function buildSalesOrderDetailRows(order, externalRef) {
  const customerName = customerDisplayName(order);
  const contactName = contactDisplayName(order);
  const billing = resolveAddress(order, "billing");
  const shipping = resolveAddress(order, "shipping");
  const orderDate = todayForFishbowl();
  const paymentTerms =
    order.payment?.mode === "PAY_LATER"
      ? envString("FISHBOWL_SO_PAY_LATER_TERMS", envString("FISHBOWL_SO_PAYMENT_TERMS", "Net 30"))
      : envString("FISHBOWL_SO_PAY_NOW_TERMS", envString("FISHBOWL_SO_PAYMENT_TERMS", "Paid"));

  const common = {
    SONum: truncate(externalRef, 25),
    Status: Number(envString("FISHBOWL_SO_STATUS_ID", "20")),
    CustomerName: customerName,
    CustomerContact: contactName,
    BillToName: addressName(order, "billing"),
    BillToAddress: billing.address1,
    BillToCity: billing.city,
    BillToState: billing.state,
    BillToZip: billing.zip,
    BillToCountry: billing.country,
    ShipToName: addressName(order, "shipping"),
    ShipToAddress: shipping.address1,
    ShipToCity: shipping.city,
    ShipToState: shipping.state,
    ShipToZip: shipping.zip,
    ShipToCountry: shipping.country,
    ShipToResidential: envString("FISHBOWL_SO_SHIP_TO_RESIDENTIAL", "false"),
    CarrierName: envString("FISHBOWL_SO_CARRIER_NAME", "Will Call"),
    TaxRateName: envString("FISHBOWL_SO_TAX_RATE_NAME", "None"),
    PriorityId: Number(envString("FISHBOWL_SO_PRIORITY_ID", "30")),
    PONum: truncate(order.customerPO || order.poNumber || order.purchaseOrderNumber || externalRef, 15),
    VendorPONum: "",
    Date: orderDate,
    Salesman: envString("FISHBOWL_SO_SALESMAN", ""),
    ShippingTerms: envString("FISHBOWL_SO_SHIPPING_TERMS", "Will Call"),
    PaymentTerms: paymentTerms,
    FOB: envString("FISHBOWL_SO_FOB", "Origin"),
    Note: getOrderNote(order),
    QuickBooksClassName: envString("FISHBOWL_SO_QB_CLASS", ""),
    LocationGroupName: envString("FISHBOWL_SO_LOCATION_GROUP_NAME", "Main"),
    OrderDateScheduled: orderDate,
    URL: envString("PUBLIC_SITE_URL", ""),
    CarrierService: envString("FISHBOWL_SO_CARRIER_SERVICE", ""),
    CurrencyName: "",
    CurrencyRate: "",
    PriceIsHomeCurrency: "",
    DateExpired: "",
    Phone: truncate(order.customer?.phone || "", 256),
    Email: truncate(order.customer?.email || "", 256),
    Category: envString("FISHBOWL_SO_CATEGORY", ""),
  };

  const customFields = getSalesOrderCustomFields(order);
  const headers = [...BASE_SALES_ORDER_DETAIL_HEADERS, ...customFields.map((field) => field.header)];
  const rows = [headers];

  for (const item of order.items || []) {
    const partNumber = resolveFishbowlPartNumber(item);
    const qty = Number(item.qty || 0);
    if (!partNumber || !qty || qty <= 0) continue;

    const row = {
      ...common,
      SOItemTypeID: Number(envString("FISHBOWL_SO_ITEM_TYPE_ID", "10")),
      ProductNumber: partNumber,
      ProductDescription: resolveItemDescription(item),
      ProductQuantity: qty,
      UOM: resolveUom(item),
      ProductPrice: money(item.unitPrice || 0),
      Taxable: envString("FISHBOWL_SO_TAXABLE", "true"),
      TaxCode: envString("FISHBOWL_SO_TAX_CODE", ""),
      Note: truncate(item.detail || item.name || "", 500),
    };

    for (const field of customFields) {
      row[field.header] = field.value;
    }

    rows.push(headers.map((header) => row[header] ?? ""));
  }

  return rows;
}

function buildDirectPayload(order, externalRef) {
  const customerName = customerDisplayName(order);

  return {
    num: externalRef,
    status: Number(envString("FISHBOWL_SO_STATUS_ID", "20")),
    customer: {
      name: customerName,
      email: order.customer?.email || "",
      phone: order.customer?.phone || "",
    },
    billingAddress: order.billingAddress || {},
    shippingAddress: order.shippingAddress || {},
    note: getOrderNote(order),
    items: (order.items || [])
      .map((item, index) => ({
        lineNumber: index + 1,
        partNumber: resolveFishbowlPartNumber(item),
        description: resolveItemDescription(item),
        quantity: Number(item.qty || 0),
        uom: resolveUom(item),
        rate: money(item.unitPrice || 0),
      }))
      .filter((item) => item.partNumber && item.quantity > 0),
  };
}

function serializeFishbowlError(resp = {}) {
  const data = resp.data ?? resp.error ?? resp;
  if (typeof data === "string") return truncate(data, 1800);
  try {
    return truncate(JSON.stringify(data), 1800);
  } catch {
    return truncate(String(data), 1800);
  }
}

export async function pushOrderToFishbowl(orderId, options = {}) {
  const enabled = asBool(process.env.FISHBOWL_ENABLED, false);
  const dryRun = Boolean(options.dryRun);

  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);

  if (!enabled && !dryRun) {
    order.fishbowlStatus = "FAILED";
    order.fishbowlError = "FISHBOWL_ENABLED is false. Set FISHBOWL_ENABLED=true in server env before pushing orders.";
    await order.save();
    return { pushed: false, skipped: true, error: order.fishbowlError };
  }

  if (order.fishbowlId || order.fishbowlNumber || order.fishbowlStatus === "PUSHED") {
    return {
      skipped: true,
      reason: "Order already has Fishbowl refs",
      fishbowlId: order.fishbowlId,
      fishbowlNumber: order.fishbowlNumber,
      fishbowlStatus: order.fishbowlStatus,
    };
  }

  const validItems = (order.items || []).filter((item) => resolveFishbowlPartNumber(item));
  if (!validItems.length) {
    order.fishbowlStatus = "FAILED";
    order.fishbowlError = "Order has no valid Fishbowl part numbers.";
    await order.save();
    return { pushed: false, error: order.fishbowlError };
  }

  const mode = String(process.env.FISHBOWL_SO_CREATE_MODE || "IMPORT").toUpperCase();
  const externalRef = order.orderNumber || `IHI-${order._id}`;
  const importName = envString("FISHBOWL_SO_IMPORT_NAME", "Sales-Order-Details");

  let request;
  if (mode === "DIRECT") {
    request = {
      method: "POST",
      path: "/api/sales-orders",
      body: buildDirectPayload(order, externalRef),
    };
  } else {
    request = {
      method: "POST",
      path: `/api/import/${importName}`,
      body: buildSalesOrderDetailRows(order, externalRef),
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      pushed: false,
      mode,
      request,
      orderNumber: externalRef,
      rowCount: Array.isArray(request.body) ? request.body.length - 1 : request.body?.items?.length || 0,
    };
  }

  console.log("🐟 Pushing order to Fishbowl", {
    orderId: String(order._id),
    orderNumber: externalRef,
    mode,
    path: request.path,
    lineItems: validItems.length,
  });

  let resp;
  try {
    resp = await fishbowlClient.request(request);
  } catch (err) {
    order.fishbowlStatus = "FAILED";
    order.fishbowlError = err?.message || "Fishbowl request failed.";
    await order.save();
    throw err;
  }

  if (!resp.ok) {
    order.fishbowlStatus = "FAILED";
    order.fishbowlError = serializeFishbowlError(resp);
    await order.save();

    return {
      pushed: false,
      status: resp.status,
      error: resp.data || resp.error || order.fishbowlError,
      request: {
        method: request.method,
        path: request.path,
        mode,
        rowCount: Array.isArray(request.body) ? request.body.length - 1 : request.body?.items?.length || 0,
      },
      note:
        "If this is the first time this app logs into Fishbowl, approve the integration inside Fishbowl. If import fields are rejected, verify FISHBOWL_SO_CARRIER_NAME, FISHBOWL_SO_TAX_RATE_NAME, FISHBOWL_SO_LOCATION_GROUP_NAME, and optional FISHBOWL_SO_CATEGORY match Fishbowl exactly. Leave FISHBOWL_SO_CATEGORY unset unless you have a valid Fishbowl calendar category.",
    };
  }

  order.fishbowlStatus = "PUSHED";
  order.fishbowlError = "";
  order.fishbowlPushedAt = new Date();
  order.fishbowlNumber = externalRef;

  if (resp?.data?.id != null) order.fishbowlId = String(resp.data.id);
  if (resp?.data?.number) order.fishbowlNumber = String(resp.data.number);

  await order.save();

  return {
    pushed: true,
    fishbowl: resp.data,
    fishbowlNumber: order.fishbowlNumber,
    fishbowlStatus: order.fishbowlStatus,
  };
}

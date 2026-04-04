import { fishbowlClient } from "../../integrations/fishbowl/fishbowlClient.js";
import Order from "../../models/Order.js";

function resolveFishbowlPartNumber(item = {}) {
  return (
    item.partNumber ||
    item.vendorPartNumber ||
    item?.attributes?.fishbowlPartNum ||
    ""
  );
}

function buildImportRows(order, externalRef) {
  const customerName = order.customer?.companyName || `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || "WEB CUSTOMER";

  const rows = [["SO Number", "Customer", "Part Number", "Quantity", "Price"]];

  for (const item of order.items || []) {
    const partNumber = resolveFishbowlPartNumber(item);
    if (!partNumber) continue;

    rows.push([
      externalRef,
      customerName,
      partNumber,
      Number(item.qty || 0),
      Number(item.unitPrice || 0),
    ]);
  }

  return rows;
}

function buildDirectPayload(order, externalRef) {
  const customerName = order.customer?.companyName || `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || "WEB CUSTOMER";

  return {
    num: externalRef,
    customer: {
      name: customerName,
      email: order.customer?.email || "",
      phone: order.customer?.phone || "",
    },
    billingAddress: order.billingAddress || {},
    shippingAddress: order.shippingAddress || {},
    items: (order.items || [])
      .map((item, index) => ({
        lineNumber: index + 1,
        partNumber: resolveFishbowlPartNumber(item),
        description: item.name || item.detail || item.partNumber || "",
        quantity: Number(item.qty || 0),
        rate: Number(item.unitPrice || 0),
      }))
      .filter((item) => item.partNumber),
  };
}

export async function pushOrderToFishbowl(orderId) {
  const enabled = String(process.env.FISHBOWL_ENABLED || "false") === "true";
  if (!enabled) return { skipped: true, reason: "FISHBOWL_ENABLED is false" };

  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);

  if (order.fishbowlId || order.fishbowlNumber) {
    return {
      skipped: true,
      reason: "Order already has Fishbowl refs",
      fishbowlId: order.fishbowlId,
      fishbowlNumber: order.fishbowlNumber,
    };
  }

  const validItems = (order.items || []).filter((item) => resolveFishbowlPartNumber(item));
  if (!validItems.length) {
    return {
      pushed: false,
      error: "Order has no valid Fishbowl part numbers",
    };
  }

  const mode = String(process.env.FISHBOWL_SO_CREATE_MODE || "IMPORT").toUpperCase();
  const externalRef = order.orderNumber || `IHI-${order._id}`;

  let resp;

  if (mode === "DIRECT") {
    const payload = buildDirectPayload(order, externalRef);

    resp = await fishbowlClient.request({
      method: "POST",
      path: "/api/sales-orders",
      body: payload,
    });
  } else {
    const importName = "Sales-Order-Details";
    const rows = buildImportRows(order, externalRef);

    resp = await fishbowlClient.request({
      method: "POST",
      path: `/api/import/${importName}`,
      body: rows,
    });
  }

  if (!resp.ok) {
    return {
      pushed: false,
      status: resp.status,
      error: resp.data,
      note:
        "If this is the first time this app logs into Fishbowl, approve the integration inside Fishbowl.",
    };
  }

  order.fishbowlStatus = "PUSHED";
  order.fishbowlNumber = externalRef;

  if (resp?.data?.id != null) order.fishbowlId = String(resp.data.id);
  if (resp?.data?.number) order.fishbowlNumber = String(resp.data.number);
  if (resp?.data?.status) order.fishbowlStatus = String(resp.data.status);

  await order.save();

  return {
    pushed: true,
    fishbowl: resp.data,
    fishbowlNumber: order.fishbowlNumber,
  };
}

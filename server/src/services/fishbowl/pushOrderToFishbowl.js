// src/services/fishbowl/pushOrderToFishbowl.js
import { fishbowlClient } from "../../integrations/fishbowl/fishbowlClient.js";
import Order from "../../models/Order.js"; // adjust to your project

export async function pushOrderToFishbowl(orderId) {
  const enabled = String(process.env.FISHBOWL_ENABLED || "false") === "true";
  if (!enabled) return { skipped: true, reason: "FISHBOWL_ENABLED is false" };

  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);

  // Idempotency guard
  if (order.fishbowlId || order.fishbowlNumber) {
    return {
      skipped: true,
      reason: "Order already has Fishbowl refs",
      fishbowlId: order.fishbowlId,
      fishbowlNumber: order.fishbowlNumber,
    };
  }

  const mode = String(process.env.FISHBOWL_SO_CREATE_MODE || "IMPORT").toUpperCase();

  // TODO: map your order shape -> Fishbowl
  // (customer, addresses, shipping, tax, payment terms, line items -> FB parts/products, etc.)
  // Keep a stable external reference so you can find this SO later:
  const externalRef = `IHI-${order._id}`;

  let resp;

  if (mode === "DIRECT") {
    // Only use this if your /apidocs shows POST /api/sales-orders for your version
    const payload = {
      // TODO: real Sales Order JSON per your server's /apidocs
      // num: externalRef,
      // customer: { id: ... } or { name: ... }
      // items: [...]
    };

    resp = await fishbowlClient.request({
      method: "POST",
      path: "/api/sales-orders",
      body: payload,
    });
  } else {
    // IMPORT mode: use Fishbowl's import mechanism (CSV/JSON import endpoint). :contentReference[oaicite:7]{index=7}
    // You’ll pick the import name exactly as Fishbowl labels it, with spaces replaced by "-".
    // Example shown in docs: "Sales Order Details" -> "Sales-Order-Details". :contentReference[oaicite:8]{index=8}
    const importName = "Sales-Order-Details";

    // TODO: build rows to match the import definition in Fishbowl.
    // This is a placeholder structure: [ [headers...], [row...], [row...] ]
    const rows = [
      ["SO Number", "Customer", "Part Number", "Quantity"], // placeholder headers
      [externalRef, "WEB CUSTOMER", "PART-123", 1],         // placeholder row
    ];

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
        "If this is the first time this app logs into Fishbowl, approve the integration inside Fishbowl (or you may see an approval error).",
    };
  }

  // TODO: Once we know the response shape / lookup strategy, save refs:
  // order.fishbowlId = ...
  // order.fishbowlNumber = ...
  // order.fishbowlStatus = ...
  // await order.save();

  return { pushed: true, fishbowl: resp.data };
}
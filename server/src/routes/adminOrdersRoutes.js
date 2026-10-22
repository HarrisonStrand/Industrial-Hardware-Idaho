import express from "express";
import { requireAuth } from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import Order from "../models/Order.js";
import { pushOrderToFishbowl } from "../services/fishbowl/pushOrderToFishbowl.js";
import { stripe } from "../utils/stripe.js";

const router = express.Router();

const ADMIN_REVIEW_STATUSES = [
  "PENDING",
  "APPROVED_IN_PROGRESS",
  "APPROVED_COMPLETED",
  "DENIED",
];

const PAYMENT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "INVOICED"];

// Matches orders with archivedAt null or missing.
const NOT_ARCHIVED = { archivedAt: null };

// Stripe PaymentIntent statuses that can still be canceled.
const CANCELABLE_PI_STATUSES = ["requires_payment_method", "requires_confirmation", "requires_action"];

function adminId(req) {
  return req.user?.id || req.user?._id || null;
}

// Why an order may not be hard-deleted, or "" when it may.
// Only unpaid pay-now orders that never reached Fishbowl can be deleted.
function deleteBlockReason(order) {
  const mode = order.payment?.mode || "PAY_NOW";
  const status = order.payment?.status || "PENDING";
  if (mode !== "PAY_NOW") return "Pay-later orders are real invoices and cannot be deleted. Archive it instead.";
  if (!["PENDING", "FAILED"].includes(status)) {
    return `Orders with payment status ${status} cannot be deleted. Archive it instead.`;
  }
  if (order.fishbowlId || order.fishbowlNumber || order.fishbowlPushedAt) {
    return "This order was pushed to Fishbowl and cannot be deleted. Archive it instead.";
  }
  return "";
}

function safeStringify(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function fishbowlPushErrorMessage(result = {}) {
  const error = result.error || result.result?.error || result.message;

  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error);
      return parsed?.message || parsed?.error || error;
    } catch {
      return error;
    }
  }

  if (error?.message) return error.message;
  if (error?.error) return safeStringify(error.error);

  if (result?.status) return `Fishbowl push failed with status ${result.status}.`;
  return "Fishbowl push failed.";
}

function buildSearchFilter({ q = "", adminStatus = "", paymentStatus = "", fishbowlStatus = "", archived = "" }) {
  const filter = {};

  // Default view hides archived orders.
  if (archived === "only") filter.archivedAt = { $ne: null };
  else if (archived !== "all") filter.archivedAt = null;

  if (adminStatus) filter["adminReview.status"] = adminStatus;
  if (paymentStatus) filter["payment.status"] = paymentStatus;

  if (fishbowlStatus === "NOT_SENT") {
    filter.$or = [
      { fishbowlStatus: "NOT_SENT" },
      { fishbowlStatus: "" },
      { fishbowlStatus: null },
      { fishbowlStatus: { $exists: false } },
    ];
  } else if (fishbowlStatus) {
    filter.fishbowlStatus = fishbowlStatus;
  }

  const query = String(q || "").trim();
  if (query) {
    const searchOr = [
      { orderNumber: { $regex: query, $options: "i" } },
      { "customer.email": { $regex: query, $options: "i" } },
      { "customer.companyName": { $regex: query, $options: "i" } },
      { "customer.firstName": { $regex: query, $options: "i" } },
      { "customer.lastName": { $regex: query, $options: "i" } },
      { "payment.stripePaymentIntentId": { $regex: query, $options: "i" } },
      { "items.partNumber": { $regex: query, $options: "i" } },
      { "items.name": { $regex: query, $options: "i" } },
    ];

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
      delete filter.$or;
    } else {
      filter.$or = searchOr;
    }
  }

  return filter;
}

async function getOrderSummary() {
  const [adminAgg, paymentAgg, fishbowlAgg, total] = await Promise.all([
    Order.aggregate([{ $match: NOT_ARCHIVED }, { $group: { _id: "$adminReview.status", count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: NOT_ARCHIVED }, { $group: { _id: "$payment.status", count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: NOT_ARCHIVED }, { $group: { _id: "$fishbowlStatus", count: { $sum: 1 } } }]),
    Order.countDocuments(NOT_ARCHIVED),
  ]);

  const admin = Object.fromEntries(adminAgg.map((row) => [row._id || "PENDING", row.count]));
  const payment = Object.fromEntries(paymentAgg.map((row) => [row._id || "PENDING", row.count]));
  const fishbowl = Object.fromEntries(fishbowlAgg.map((row) => [row._id || "NOT_SENT", row.count]));

  const archived = await Order.countDocuments({ archivedAt: { $ne: null } });

  return { total, admin, payment, fishbowl, archived };
}

/**
 * GET /api/admin/orders
 */
router.get("/orders", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      q = "",
      adminStatus = "",
      paymentStatus = "",
      fishbowlStatus = "",
      archived = "",
      page = "1",
      limit = "25",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const filter = buildSearchFilter({ q, adminStatus, paymentStatus, fishbowlStatus, archived });

    const [items, total, summary] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
      getOrderSummary(),
    ]);

    res.json({
      items,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
      summary,
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to list orders" });
  }
});

/**
 * GET /api/admin/orders/summary
 */
router.get("/orders/summary", requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json(await getOrderSummary());
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to summarize orders" });
  }
});

/**
 * POST /api/admin/orders/archive-completed
 * Archives every non-archived order that is completed or denied.
 */
router.post("/orders/archive-completed", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await Order.updateMany(
      { ...NOT_ARCHIVED, "adminReview.status": { $in: ["APPROVED_COMPLETED", "DENIED"] } },
      { $set: { archivedAt: new Date(), archivedBy: adminId(req) } }
    );
    const count = result.modifiedCount ?? 0;
    console.log(`[admin-orders] archive-completed: ${count} orders archived by admin ${adminId(req)}`);
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to archive orders" });
  }
});

/**
 * GET /api/admin/orders/:id
 */
router.get("/orders/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to fetch order" });
  }
});

/**
 * PATCH /api/admin/orders/:id/review
 */
router.patch("/orders/:id/review", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, deniedReason = "" } = req.body || {};

    if (!ADMIN_REVIEW_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const reason = String(deniedReason || "").trim();
    if (status === "DENIED" && !reason) {
      return res.status(400).json({ error: "deniedReason is required when status is DENIED" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (["APPROVED_IN_PROGRESS", "APPROVED_COMPLETED"].includes(status) && order.payment?.status === "FAILED") {
      return res.status(400).json({ error: "Orders with failed payment cannot be approved or completed." });
    }

    order.adminReview = order.adminReview || {};
    order.adminReview.status = status;
    order.adminReview.deniedReason = status === "DENIED" ? reason : "";
    order.adminReview.reviewedAt = new Date();
    order.adminReview.reviewedBy = req.user?.id || req.user?._id || null;

    await order.save();

    res.json({ ok: true, orderId: order._id, adminReview: order.adminReview });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to update order review" });
  }
});

/**
 * PATCH /api/admin/orders/:id/archive  { archived: true|false }
 */
router.patch("/orders/:id/archive", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { archived } = req.body || {};
    if (typeof archived !== "boolean") {
      return res.status(400).json({ error: "archived must be true or false" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.archivedAt = archived ? new Date() : null;
    order.archivedBy = archived ? adminId(req) : null;
    await order.save();

    res.json({ ok: true, orderId: order._id, archivedAt: order.archivedAt });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to update archive state" });
  }
});

/**
 * DELETE /api/admin/orders/:id
 * Only unpaid PAY_NOW orders never pushed to Fishbowl. Real orders are archived instead.
 */
router.delete("/orders/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const blocked = deleteBlockReason(order);
    if (blocked) return res.status(409).json({ error: blocked });

    const piId = order.payment?.stripePaymentIntentId;
    if (piId && stripe) {
      let pi;
      try {
        pi = await stripe.paymentIntents.retrieve(piId);
      } catch (err) {
        return res.status(502).json({ error: `Could not check the Stripe payment: ${err?.message || "unknown error"}` });
      }

      if (pi.status === "succeeded") {
        return res.status(409).json({ error: "Stripe shows this payment succeeded. The order cannot be deleted." });
      }
      if (pi.status === "processing" || pi.status === "requires_capture") {
        return res.status(409).json({ error: `Stripe payment is ${pi.status}. Wait for it to settle before deleting.` });
      }
      if (CANCELABLE_PI_STATUSES.includes(pi.status)) {
        try {
          await stripe.paymentIntents.cancel(piId);
        } catch (err) {
          return res.status(502).json({ error: `Could not cancel the Stripe payment: ${err?.message || "unknown error"}` });
        }
      }
      // "canceled" needs nothing more.
    }

    await Order.deleteOne({ _id: order._id });
    console.log(`[admin-orders] deleted order ${order.orderNumber} (${order._id}) by admin ${adminId(req)}`);

    res.json({ ok: true, orderId: order._id, orderNumber: order.orderNumber });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to delete order" });
  }
});

/**
 * POST /api/admin/orders/:id/push-fishbowl
 */
router.post("/orders/:id/push-fishbowl", requireAuth, requireAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const paymentStatus = order.payment?.status || "PENDING";
    const reviewStatus = order.adminReview?.status || "PENDING";

    if (paymentStatus === "FAILED") {
      return res.status(400).json({ error: "Cannot push an order with failed payment to Fishbowl." });
    }

    if (reviewStatus === "DENIED") {
      return res.status(400).json({ error: "Cannot push a denied order to Fishbowl." });
    }

    if (reviewStatus === "PENDING") {
      return res.status(400).json({ error: "Approve/start processing this order before pushing it to Fishbowl." });
    }

    const result = await pushOrderToFishbowl(order._id);
    if (result?.pushed === false) {
      return res.status(502).json({
        ok: false,
        error: fishbowlPushErrorMessage(result),
        result,
      });
    }

    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({
      error: err?.message || safeStringify(err) || "Failed to push order to Fishbowl",
    });
  }
});

export default router;

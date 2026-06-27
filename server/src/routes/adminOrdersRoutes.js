import express from "express";
import { requireAuth } from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import Order from "../models/Order.js";
import { pushOrderToFishbowl } from "../services/fishbowl/pushOrderToFishbowl.js";

const router = express.Router();

const ADMIN_REVIEW_STATUSES = [
  "PENDING",
  "APPROVED_IN_PROGRESS",
  "APPROVED_COMPLETED",
  "DENIED",
];

const PAYMENT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "INVOICED"];

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

function buildSearchFilter({ q = "", adminStatus = "", paymentStatus = "", fishbowlStatus = "" }) {
  const filter = {};

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
    Order.aggregate([{ $group: { _id: "$adminReview.status", count: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: "$payment.status", count: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: "$fishbowlStatus", count: { $sum: 1 } } }]),
    Order.countDocuments({}),
  ]);

  const admin = Object.fromEntries(adminAgg.map((row) => [row._id || "PENDING", row.count]));
  const payment = Object.fromEntries(paymentAgg.map((row) => [row._id || "PENDING", row.count]));
  const fishbowl = Object.fromEntries(fishbowlAgg.map((row) => [row._id || "NOT_SENT", row.count]));

  return { total, admin, payment, fishbowl };
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
      page = "1",
      limit = "25",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const filter = buildSearchFilter({ q, adminStatus, paymentStatus, fishbowlStatus });

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

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import Order from "../models/Order.js";

const router = express.Router();

/**
 * GET /api/admin/orders
 * Query:
 *  - q: search string (orderNumber, email, company, stripe PI)
 *  - adminStatus: PENDING | APPROVED_IN_PROGRESS | APPROVED_COMPLETED | DENIED
 *  - paymentStatus: PENDING | SUCCEEDED | FAILED | INVOICED
 *  - page: 1-based
 *  - limit: max 100
 */
router.get("/orders", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      q = "",
      adminStatus = "",
      paymentStatus = "",
      page = "1",
      limit = "25",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (adminStatus) filter["adminReview.status"] = adminStatus;
    if (paymentStatus) filter["payment.status"] = paymentStatus;

    if (q) {
      filter.$or = [
        { orderNumber: { $regex: q, $options: "i" } },
        { "customer.email": { $regex: q, $options: "i" } },
        { "customer.companyName": { $regex: q, $options: "i" } },
        { "customer.firstName": { $regex: q, $options: "i" } },
        { "customer.lastName": { $regex: q, $options: "i" } },
        { "payment.stripePaymentIntentId": { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      items,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to list orders" });
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
 * Body:
 *  - status: PENDING | APPROVED_IN_PROGRESS | APPROVED_COMPLETED | DENIED
 *  - deniedReason?: string (required if DENIED)
 */
router.patch("/orders/:id/review", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, deniedReason = "" } = req.body || {};

    const allowed = ["PENDING", "APPROVED_IN_PROGRESS", "APPROVED_COMPLETED", "DENIED"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const reason = String(deniedReason || "").trim();
    if (status === "DENIED" && !reason) {
      return res.status(400).json({ error: "deniedReason is required when status is DENIED" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Ensure object exists (in case older orders don’t have it yet)
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

export default router;
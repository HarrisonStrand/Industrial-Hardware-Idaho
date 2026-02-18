import User from "../models/User.js";
import Order from "../models/Order.js";

function calcTotals(items) {
  const subtotal = items.reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);
  const tax = 0;
  const shipping = 0;
  const total = subtotal + tax + shipping;
  return { subtotal, tax, shipping, total };
}

export async function getCapabilities(req, res) {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const account = user.account || {};
  const approvedType = account.approvedType || "RETAIL";
  const approvalStatus = account.approvalStatus || "NONE";

  const hasCardOnFile = Boolean(user?.payment?.defaultPaymentMethodId);

  res.json({
    account: {
      requestedType: account.requestedType || "RETAIL",
      approvedType,
      approvalStatus,
      rejectionReason: account.rejectionReason || ""
    },
    payment: { hasCardOnFile },
    canUseNet30: approvalStatus === "APPROVED" && approvedType === "NET30",
    canUseHouse: approvalStatus === "APPROVED" && approvedType === "HOUSE"
  });
}

export async function requestAccountType(req, res) {
  const { requestedType } = req.body || {};
  if (!["NET30", "HOUSE"].includes(requestedType)) {
    return res.status(400).json({ error: "requestedType must be NET30 or HOUSE" });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.account = user.account || {};
  user.account.requestedType = requestedType;
  user.account.approvalStatus = "PENDING";
  user.account.rejectionReason = "";
  await user.save();

  return res.json({ success: true });
}

export async function createPayLaterOrder(req, res) {
  const { payLaterType, items, notes } = req.body || {};

  if (!["NET30", "HOUSE"].includes(payLaterType)) {
    return res.status(400).json({ error: "payLaterType must be NET30 or HOUSE" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const account = user.account || {};
  const approved = account.approvalStatus === "APPROVED";
  const matches =
    (payLaterType === "NET30" && account.approvedType === "NET30") ||
    (payLaterType === "HOUSE" && account.approvedType === "HOUSE");

  if (!approved || !matches) {
    return res.status(403).json({
      error: "Pay later requires admin approval.",
      approvalStatus: account.approvalStatus || "NONE",
      approvedType: account.approvedType || "RETAIL"
    });
  }

  const totals = calcTotals(items);

  const order = await Order.create({
    userId: user._id,
    items,
    ...totals,
    billingAddress: user.billingAddress || {},
    deliveryAddress: user.deliveryAddress || {},
    paymentMode: "PAY_LATER",
    payLaterType,
    paymentStatus: "UNPAID",
    status: "PENDING",
    notes: notes || ""
  });

  return res.status(201).json({ orderId: order._id });
}

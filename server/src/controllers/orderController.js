import Order from "../models/Order.js";

export async function getMyOrder(req, res) {
  const { orderId } = req.params;

  const order = await Order.findOne({ _id: orderId, userId: req.user.id }).lean();
  if (!order) return res.status(404).json({ error: "Order not found" });

  return res.json({ order });
}
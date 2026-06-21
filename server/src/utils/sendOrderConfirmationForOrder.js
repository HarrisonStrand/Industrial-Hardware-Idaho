import Order from "../models/Order.js";
import { sendOrderConfirmationEmail } from "./mailer.js";

function toPlainOrder(order) {
  if (!order) return null;
  if (typeof order.toObject === "function") return order.toObject();
  return order;
}

export async function sendOrderConfirmationForOrder(orderOrId) {
  const order = typeof orderOrId === "string"
    ? await Order.findById(orderOrId)
    : orderOrId;

  if (!order) {
    return { sent: false, skipped: true, reason: "Order not found" };
  }

  if (order?.confirmationEmail?.sentAt) {
    return {
      sent: false,
      skipped: true,
      reason: "Confirmation email already sent",
      sentAt: order.confirmationEmail.sentAt,
    };
  }

  const orderData = toPlainOrder(order);
  const to = orderData?.customer?.email || "";

  try {
    await sendOrderConfirmationEmail({
      to,
      orderNumber: orderData.orderNumber,
      items: orderData.items,
      amountTotalCents: orderData.amountTotalCents,
      currency: orderData.currency,
      customer: orderData.customer,
      billingAddress: orderData.billingAddress,
      shippingAddress: orderData.shippingAddress,
      shippingSameAsBilling: orderData.shippingSameAsBilling,
    });

    order.confirmationEmail = order.confirmationEmail || {};
    order.confirmationEmail.sentAt = new Date();
    order.confirmationEmail.lastError = "";
    await order.save();

    return { sent: true, skipped: false, sentAt: order.confirmationEmail.sentAt };
  } catch (err) {
    order.confirmationEmail = order.confirmationEmail || {};
    order.confirmationEmail.lastError = err?.message || "Failed to send confirmation email";
    await order.save().catch(() => null);
    throw err;
  }
}

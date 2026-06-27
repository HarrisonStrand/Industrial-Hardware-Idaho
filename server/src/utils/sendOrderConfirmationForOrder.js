import Order from "../models/Order.js";
import { transporter, sendOrderConfirmationEmail } from "./mailer.js";

function toPlainOrder(order) {
  if (!order) return null;
  if (typeof order.toObject === "function") return order.toObject();
  return order;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents = 0, currency = "usd") {
  return `${(Number(cents || 0) / 100).toFixed(2)} ${String(currency || "usd").toUpperCase()}`;
}

function lineMoney(value = 0) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatAddress(addr = {}) {
  if (!addr) return "N/A";
  return [
    addr.companyName || addr.name,
    addr.address1,
    addr.address2,
    [addr.city, addr.state, addr.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br/>") || "N/A";
}

function orderItemsTable(order = {}) {
  const rows = (order.items || [])
    .map((item) => `
      <tr>
        <td style="padding:8px 10px; border-bottom:1px solid #ddd;">
          <strong>${escapeHtml(item.partNumber || "")}</strong><br/>
          <span>${escapeHtml(item.name || item.detail || "")}</span>
        </td>
        <td style="padding:8px 10px; border-bottom:1px solid #ddd; text-align:center;">${Number(item.qty || 0)}</td>
        <td style="padding:8px 10px; border-bottom:1px solid #ddd; text-align:right;">${lineMoney(item.unitPrice)}</td>
        <td style="padding:8px 10px; border-bottom:1px solid #ddd; text-align:right;">${lineMoney(item.lineTotal)}</td>
      </tr>
    `)
    .join("");

  return `
    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:14px;">
      <thead>
        <tr>
          <th align="left" style="padding:8px 10px; border-bottom:2px solid #495a42;">Item</th>
          <th align="center" style="padding:8px 10px; border-bottom:2px solid #495a42;">Qty</th>
          <th align="right" style="padding:8px 10px; border-bottom:2px solid #495a42;">Unit</th>
          <th align="right" style="padding:8px 10px; border-bottom:2px solid #495a42;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function sendAdminOrderNotificationEmail(order = {}) {
  const recipient = process.env.ORDER_NOTIFICATION_TO || process.env.ORDERS_TO || process.env.EMAIL_TO;
  if (!recipient) {
    return { sent: false, skipped: true, reason: "No ORDER_NOTIFICATION_TO / ORDERS_TO / EMAIL_TO configured" };
  }

  const customerName =
    order.customer?.companyName ||
    `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() ||
    order.customer?.email ||
    "Website Customer";

  const html = `
    <div style="font-family:Arial,sans-serif; color:#183018; line-height:1.5;">
      <h2 style="color:#495a42; margin-bottom:8px;">New Website Order</h2>
      <p style="margin-top:0;">A new order was placed on the IHI website.</p>

      <table cellspacing="0" cellpadding="0" style="font-size:14px; margin:16px 0;">
        <tr><td style="padding:4px 16px 4px 0;"><strong>Order #</strong></td><td>${escapeHtml(order.orderNumber)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;"><strong>Total</strong></td><td>$${money(order.amountTotalCents, order.currency)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;"><strong>Payment</strong></td><td>${escapeHtml(order.payment?.mode)} / ${escapeHtml(order.payment?.status)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;"><strong>Customer</strong></td><td>${escapeHtml(customerName)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;"><strong>Email</strong></td><td>${escapeHtml(order.customer?.email || "")}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;"><strong>Phone</strong></td><td>${escapeHtml(order.customer?.phone || "")}</td></tr>
      </table>

      <h3 style="color:#495a42;">Items</h3>
      ${orderItemsTable(order)}

      <h3 style="color:#495a42; margin-top:22px;">Billing</h3>
      <p>${formatAddress(order.billingAddress)}</p>

      <h3 style="color:#495a42; margin-top:22px;">Shipping</h3>
      <p>${order.shippingSameAsBilling ? "Same as billing" : formatAddress(order.shippingAddress)}</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"IHI Website" <${process.env.EMAIL_USER}>`,
    to: recipient,
    replyTo: order.customer?.email || process.env.EMAIL_USER,
    subject: `New Website Order — ${order.orderNumber}`,
    html,
  });

  return { sent: true, skipped: false, to: recipient };
}

export async function sendOrderConfirmationForOrder(orderOrId) {
  const order = typeof orderOrId === "string"
    ? await Order.findById(orderOrId)
    : orderOrId;

  if (!order) {
    return { sent: false, skipped: true, reason: "Order not found" };
  }

  const orderData = toPlainOrder(order);
  const result = {
    customer: { sent: false, skipped: false },
    admin: { sent: false, skipped: false },
  };

  if (!order?.confirmationEmail?.sentAt) {
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
      result.customer = { sent: true, skipped: false, sentAt: order.confirmationEmail.sentAt };
    } catch (err) {
      order.confirmationEmail = order.confirmationEmail || {};
      order.confirmationEmail.lastError = err?.message || "Failed to send customer confirmation email";
      result.customer = { sent: false, skipped: false, error: order.confirmationEmail.lastError };
    }
  } else {
    result.customer = {
      sent: false,
      skipped: true,
      reason: "Confirmation email already sent",
      sentAt: order.confirmationEmail.sentAt,
    };
  }

  if (!order?.adminNotificationEmail?.sentAt) {
    try {
      const adminResult = await sendAdminOrderNotificationEmail(orderData);
      order.adminNotificationEmail = order.adminNotificationEmail || {};
      if (adminResult.sent) {
        order.adminNotificationEmail.sentAt = new Date();
        order.adminNotificationEmail.lastError = "";
      } else {
        order.adminNotificationEmail.lastError = adminResult.reason || "Admin notification skipped";
      }
      result.admin = { ...adminResult, sentAt: order.adminNotificationEmail.sentAt };
    } catch (err) {
      order.adminNotificationEmail = order.adminNotificationEmail || {};
      order.adminNotificationEmail.lastError = err?.message || "Failed to send admin order notification email";
      result.admin = { sent: false, skipped: false, error: order.adminNotificationEmail.lastError };
    }
  } else {
    result.admin = {
      sent: false,
      skipped: true,
      reason: "Admin notification already sent",
      sentAt: order.adminNotificationEmail.sentAt,
    };
  }

  await order.save().catch(() => null);

  if (result.customer.error || result.admin.error) {
    console.warn("ORDER EMAIL WARNING:", { orderNumber: order.orderNumber, result });
  }

  return result;
}

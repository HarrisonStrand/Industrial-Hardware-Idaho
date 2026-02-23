import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

console.log("📧 MAILER CONFIG:", {
  host: process.env.EMAIL_HOST,
  user: process.env.EMAIL_USER,
  hasPass: !!process.env.EMAIL_PASS
});

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection on server start
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Mailer verification failed:", error);
  } else {
    console.log("✅ Mail server is ready to send emails");
  }
});

/* ============================
   CONTACT FORM EMAIL
============================ */
export async function sendContactEmail({
  name,
  company,
  email,
  phone,
  date,
  subject,
  message
}) {
  return transporter.sendMail({
    from: `"IHI Website" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    replyTo: email,
    subject: `Contact Form: ${subject}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Company:</strong> ${escapeHtml(company || "N/A")}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || "N/A")}</p>
      <p><strong>Date:</strong> ${escapeHtml(date)}</p>
      <hr />
      <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
    `
  });
}

/* ============================
   ORDER CONFIRMATION EMAIL
============================ */
export async function sendOrderConfirmationEmail({
  to,
  orderNumber,
  items,
  amountTotalCents,
  currency = "usd",
  customer,
  billingAddress,
  shippingAddress,
  shippingSameAsBilling
}) {
  if (!to) {
    console.warn("⚠️ No recipient email provided for order confirmation.");
    return;
  }

  const total = (Number(amountTotalCents || 0) / 100).toFixed(2);

  const rows = (items || [])
    .map(
      (it) => `
        <tr>
          <td style="padding:6px 0;">${escapeHtml(it.name || it.partNumber)}</td>
          <td style="padding:6px 0; text-align:center;">${Number(it.qty || 0)}</td>
          <td style="padding:6px 0; text-align:right;">$${Number(it.lineTotal || 0).toFixed(2)}</td>
        </tr>
      `
    )
    .join("");

  const billingHtml = formatAddress(billingAddress);
  const shippingHtml = shippingSameAsBilling
    ? "<p>Same as billing</p>"
    : formatAddress(shippingAddress);

  return transporter.sendMail({
    from: `"Industrial Hardware Idaho" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Order Confirmation — ${orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; color:#111; max-width:600px;">
        <h2 style="margin-bottom:4px;">Thank you${customer?.firstName ? `, ${escapeHtml(customer.firstName)}` : ""}!</h2>
        <p style="margin-top:0;">Your order has been received and is being processed.</p>

        <p>
          <strong>Order #:</strong> ${escapeHtml(orderNumber)}
        </p>

        <table style="width:100%; border-collapse:collapse; margin-top:12px;">
          <thead>
            <tr>
              <th style="text-align:left; border-bottom:1px solid #ddd;">Item</th>
              <th style="text-align:center; border-bottom:1px solid #ddd;">Qty</th>
              <th style="text-align:right; border-bottom:1px solid #ddd;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <p style="margin-top:16px;">
          <strong>Order Total:</strong> $${total} ${currency.toUpperCase()}
        </p>

        <hr style="margin:20px 0;" />

        <h3 style="margin-bottom:4px;">Billing Address</h3>
        ${billingHtml}

        <h3 style="margin-top:16px; margin-bottom:4px;">Shipping Address</h3>
        ${shippingHtml}

        <hr style="margin:20px 0;" />

        <p style="font-size:12px; color:#666;">
          Industrial Hardware Idaho<br/>
          This email confirms receipt of your order. You will be contacted if any issues arise.
        </p>
      </div>
    `
  });
}

/* ============================
   HELPERS
============================ */

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAddress(addr) {
  if (!addr) return "<p>N/A</p>";

  return `
    <p style="margin:0;">
      ${escapeHtml(addr.address1 || "")}<br/>
      ${addr.address2 ? `${escapeHtml(addr.address2)}<br/>` : ""}
      ${escapeHtml(addr.city || "")}, ${escapeHtml(addr.state || "")} ${escapeHtml(addr.zip || "")}
    </p>
  `;
}
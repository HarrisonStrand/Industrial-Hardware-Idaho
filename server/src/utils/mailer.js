import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

console.log("📧 MAILER CONFIG:", {
  host: process.env.EMAIL_HOST,
  user: process.env.EMAIL_USER,
  hasPass: !!process.env.EMAIL_PASS,
  contactTo: process.env.EMAIL_TO,
  specialTo: process.env.SPECIAL_REQUEST_TO || process.env.EMAIL_TO,
});

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("❌ Mailer verification failed:", error);
  } else {
    console.log("✅ Mail server is ready to send emails");
  }
});

const BRAND = {
  mainColor: "#495a42",
  altColor: "#183018",
  accentLight: "#b9ab8e",
  accentDark: "#8e6953",
  mainLight: "#e7e7e7",
  secondaryLight: "#d9d9d9",
  fontMain: "'Red Rose', Georgia, 'Times New Roman', serif",
  fontBody: "'Open Sans', Arial, Helvetica, sans-serif",
};

function emailShell({ preheader = "", eyebrow = "Industrial Hardware Idaho", title = "", subtitle = "", contentHtml = "", footerNote = "Submitted from the IHI website." }) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title || eyebrow)}</title>
      </head>
      <body style="margin:0; padding:0; background:${BRAND.mainLight}; font-family:${BRAND.fontBody}; color:${BRAND.altColor};">
        <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
          ${escapeHtml(preheader)}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.mainLight};">
          <tr>
            <td align="center" style="padding:24px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:720px; background:#ffffff; border:1px solid ${BRAND.accentLight}; border-radius:18px; overflow:hidden;">
                <tr>
                  <td style="background:${BRAND.mainColor}; padding:22px 28px;">
                    <div style="font-family:${BRAND.fontMain}; font-size:13px; line-height:1.2; letter-spacing:1.2px; text-transform:uppercase; color:${BRAND.accentLight}; margin-bottom:10px;">
                      ${escapeHtml(eyebrow)}
                    </div>
                    <div style="font-family:${BRAND.fontMain}; font-size:30px; line-height:1.15; color:#ffffff; margin:0 0 8px;">
                      ${escapeHtml(title)}
                    </div>
                    ${subtitle ? `<div style="font-family:${BRAND.fontBody}; font-size:14px; line-height:1.6; color:${BRAND.secondaryLight};">${escapeHtml(subtitle)}</div>` : ""}
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px; background:#ffffff;">
                    ${contentHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px; background:${BRAND.mainLight}; border-top:1px solid ${BRAND.accentLight}; font-family:${BRAND.fontBody}; font-size:12px; line-height:1.6; color:${BRAND.altColor};">
                    <strong style="color:${BRAND.mainColor};">Industrial Hardware Idaho</strong><br/>
                    ${escapeHtml(footerNote)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function sectionTitle(label = "") {
  return `<div style="font-family:${BRAND.fontMain}; color:${BRAND.mainColor}; font-size:20px; line-height:1.2; margin:0 0 14px;">${escapeHtml(label)}</div>`;
}

function infoTable(rows = []) {
  const htmlRows = rows
    .filter(([label, value]) => label)
    .map(([label, value]) => `
      <tr>
        <td valign="top" style="padding:10px 12px 10px 0; width:170px; font-family:${BRAND.fontBody}; font-size:13px; line-height:1.5; font-weight:700; color:${BRAND.mainColor}; border-bottom:1px solid ${BRAND.secondaryLight};">${escapeHtml(label)}</td>
        <td valign="top" style="padding:10px 0; font-family:${BRAND.fontBody}; font-size:14px; line-height:1.6; color:${BRAND.altColor}; border-bottom:1px solid ${BRAND.secondaryLight};">${value}</td>
      </tr>
    `)
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">${htmlRows}</table>`;
}

function messageBlock(label = "Message", body = "") {
  return `
    <div style="margin-top:22px;">
      ${sectionTitle(label)}
      <div style="background:${BRAND.mainLight}; border:1px solid ${BRAND.accentLight}; border-radius:14px; padding:18px; font-family:${BRAND.fontBody}; font-size:14px; line-height:1.7; color:${BRAND.altColor}; white-space:normal;">
        ${escapeHtml(body || "").replace(/\n/g, "<br/>")}
      </div>
    </div>
  `;
}

export async function sendContactEmail({ name, company, email, phone, date, subject, message }) {
  const contentHtml = `
    ${sectionTitle("Contact details")}
    ${infoTable([
      ["Subject", escapeHtml(subject || "General inquiry")],
      ["Date", escapeHtml(date || new Date().toLocaleDateString())],
      ["Name", escapeHtml(name)],
      ["Company", escapeHtml(company || "N/A")],
      ["Email", `<a href="mailto:${escapeHtml(email)}" style="color:${BRAND.accentDark}; text-decoration:none;">${escapeHtml(email)}</a>`],
      ["Phone", escapeHtml(phone || "N/A")],
    ])}
    ${messageBlock("Message", message)}
  `;

  return transporter.sendMail({
    from: `"IHI Website" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    replyTo: email,
    subject: `Contact Form: ${subject || "General inquiry"}`,
    html: emailShell({
      preheader: `New contact form submission from ${name || email || "website visitor"}`,
      eyebrow: "Industrial Hardware Idaho",
      title: "New Contact Submission",
      subtitle: subject || "Website inquiry",
      contentHtml,
      footerNote: "Sent from the contact form on the IHI website.",
    }),
  });
}

export async function sendSpecialRequestEmail({ partName, partDescription, quantityNeeded, customerPO, name, company, phone, email, date }) {
  const recipient = process.env.SPECIAL_REQUEST_TO || process.env.EMAIL_TO;
  const contentHtml = `
    ${sectionTitle("Requested part")}
    ${infoTable([
      ["Part / item", escapeHtml(partName)],
      ["Quantity needed", escapeHtml(quantityNeeded)],
      ["Customer PO", escapeHtml(customerPO || "N/A")],
      ["Requested on", escapeHtml(date || new Date().toLocaleDateString())],
    ])}
    ${messageBlock("Part description / special notes", partDescription)}
    <div style="margin-top:22px;">
      ${sectionTitle("Customer details")}
      ${infoTable([
        ["Contact name", escapeHtml(name)],
        ["Company", escapeHtml(company || "N/A")],
        ["Email", `<a href="mailto:${escapeHtml(email)}" style="color:${BRAND.accentDark}; text-decoration:none;">${escapeHtml(email)}</a>`],
        ["Phone", escapeHtml(phone || "N/A")],
      ])}
    </div>
  `;

  return transporter.sendMail({
    from: `"IHI Website" <${process.env.EMAIL_USER}>`,
    to: recipient,
    replyTo: email,
    subject: `Special Request: ${partName} (${quantityNeeded})`,
    html: emailShell({
      preheader: `New special request for ${partName}`,
      eyebrow: "Industrial Hardware Idaho",
      title: "Special Request Submission",
      subtitle: `${partName} · Qty ${quantityNeeded}`,
      contentHtml,
      footerNote: "Sent from the special request form on the IHI website.",
    }),
  });
}

export async function sendOrderConfirmationEmail({
  to,
  orderNumber,
  items,
  amountTotalCents,
  currency = "usd",
  customer,
  billingAddress,
  shippingAddress,
  shippingSameAsBilling,
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
          <td style="padding:10px 12px 10px 0; font-family:${BRAND.fontBody}; font-size:14px; line-height:1.6; color:${BRAND.altColor}; border-bottom:1px solid ${BRAND.secondaryLight};">${escapeHtml(it.name || it.partNumber)}</td>
          <td style="padding:10px 12px; text-align:center; font-family:${BRAND.fontBody}; font-size:14px; line-height:1.6; color:${BRAND.altColor}; border-bottom:1px solid ${BRAND.secondaryLight};">${Number(it.qty || 0)}</td>
          <td style="padding:10px 0; text-align:right; font-family:${BRAND.fontBody}; font-size:14px; line-height:1.6; color:${BRAND.altColor}; border-bottom:1px solid ${BRAND.secondaryLight};">$${Number(it.lineTotal || 0).toFixed(2)}</td>
        </tr>
      `,
    )
    .join("");

  const contentHtml = `
    <div style="font-family:${BRAND.fontBody}; font-size:15px; line-height:1.7; color:${BRAND.altColor}; margin-bottom:20px;">
      Thank you${customer?.firstName ? `, ${escapeHtml(customer.firstName)}` : ""}. Your order has been received and is being processed.
    </div>
    ${sectionTitle("Order summary")}
    ${infoTable([["Order number", escapeHtml(orderNumber)], ["Order total", `$${total} ${escapeHtml(currency.toUpperCase())}`]])}
    <div style="margin-top:18px; border:1px solid ${BRAND.accentLight}; border-radius:14px; padding:18px; background:${BRAND.mainLight};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <thead>
          <tr>
            <th align="left" style="padding:0 12px 10px 0; font-family:${BRAND.fontMain}; font-size:16px; color:${BRAND.mainColor}; border-bottom:1px solid ${BRAND.accentLight};">Item</th>
            <th align="center" style="padding:0 12px 10px; font-family:${BRAND.fontMain}; font-size:16px; color:${BRAND.mainColor}; border-bottom:1px solid ${BRAND.accentLight};">Qty</th>
            <th align="right" style="padding:0 0 10px; font-family:${BRAND.fontMain}; font-size:16px; color:${BRAND.mainColor}; border-bottom:1px solid ${BRAND.accentLight};">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:22px;">
      ${sectionTitle("Billing address")}
      <div style="font-family:${BRAND.fontBody}; font-size:14px; line-height:1.7; color:${BRAND.altColor};">${formatAddress(billingAddress)}</div>
    </div>
    <div style="margin-top:22px;">
      ${sectionTitle("Shipping address")}
      <div style="font-family:${BRAND.fontBody}; font-size:14px; line-height:1.7; color:${BRAND.altColor};">${shippingSameAsBilling ? "Same as billing" : formatAddress(shippingAddress)}</div>
    </div>
  `;

  return transporter.sendMail({
    from: `"Industrial Hardware Idaho" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Order Confirmation — ${orderNumber}`,
    html: emailShell({
      preheader: `Your order ${orderNumber} has been received.`,
      eyebrow: "Industrial Hardware Idaho",
      title: "Order Confirmation",
      subtitle: `Order ${orderNumber}`,
      contentHtml,
      footerNote: "This email confirms receipt of your order. We will contact you if any issues come up.",
    }),
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAddress(addr) {
  if (!addr) return "N/A";
  return `${escapeHtml(addr.address1 || "")}<br/>${addr.address2 ? `${escapeHtml(addr.address2)}<br/>` : ""}${escapeHtml(addr.city || "")}, ${escapeHtml(addr.state || "")} ${escapeHtml(addr.zip || "")}`;
}

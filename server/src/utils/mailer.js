import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// With SMTP_HOST set (Amazon SES), mail goes through that server and comes from
// EMAIL_FROM. Without it, mail goes through the Gmail account in EMAIL_USER.
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);

export const transporter = nodemailer.createTransport(
  SMTP_HOST
    ? {
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      }
    : {
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      },
);

// Address every site email is sent from.
export const FROM_ADDRESS = process.env.EMAIL_FROM || process.env.EMAIL_USER || "";

export function fromHeader(name = "Industrial Hardware Idaho") {
  return `"${name}" <${FROM_ADDRESS}>`;
}

console.log("📧 MAILER CONFIG:", {
  via: SMTP_HOST ? `SMTP ${SMTP_HOST}:${SMTP_PORT}` : "Gmail",
  from: FROM_ADDRESS,
  hasLogin: SMTP_HOST ? !!(process.env.SMTP_USER && process.env.SMTP_PASS) : !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
  contactTo: process.env.EMAIL_TO,
  specialTo: process.env.SPECIAL_REQUEST_TO || process.env.EMAIL_TO,
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

const BUSINESS_PHONE = "(208) 375-5534";

// Every website order is will call: picked up at the store.
export const PICKUP_ADDRESS = "115 E 48th St, Boise, ID 83714";
const PICKUP_NOTE_HTML = `All website orders are <strong>pickup / will call</strong> at our store: ${PICKUP_ADDRESS}, Monday–Friday 7:30am–4:30pm. We'll contact you when your order is ready.`;

// Subtotal and tax lines for an order. Orders placed before sales tax have neither.
export function orderTotalRows({ subtotalCents = null, taxCents = null, taxRate = null, taxExempt = false } = {}) {
  if (subtotalCents === null || subtotalCents === undefined) return [];
  const dollars = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
  const taxLabel = taxExempt
    ? "Sales tax (exempt)"
    : `Idaho sales tax (${Math.round(Number(taxRate || 0) * 10000) / 100}%)`;
  return [
    ["Subtotal", dollars(subtotalCents)],
    [taxLabel, dollars(taxCents)],
  ];
}
const BACKORDER_COLOR = "#8a5a00";

// Items on the order with at least one unit on backorder.
export function backorderedItems(items = []) {
  return (items || []).filter((it) => Number(it?.qtyBackordered || 0) > 0);
}

// One bullet per backordered item: "5 of 10 — Name (PART#)".
export function backorderListHtml(items = []) {
  const list = backorderedItems(items)
    .map((it) => {
      const name = it.name || it.partNumber || "Item";
      const part = it.partNumber && it.partNumber !== name ? ` (${escapeHtml(it.partNumber)})` : "";
      return `<li style="margin:0 0 6px;"><strong>${Number(it.qtyBackordered)} of ${Number(it.qty || 0)}</strong> — ${escapeHtml(name)}${part}</li>`;
    })
    .join("");
  return list ? `<ul style="margin:0 0 14px; padding-left:20px;">${list}</ul>` : "";
}

function backorderNotice(items = []) {
  const list = backorderListHtml(items);
  if (!list) return "";
  return `
    <div style="margin:0 0 22px; border:2px solid ${BACKORDER_COLOR}; border-radius:14px; padding:18px; background:#fff8ec; font-family:${BRAND.fontBody}; font-size:14px; line-height:1.7; color:${BRAND.altColor};">
      <div style="font-family:${BRAND.fontMain}; font-size:18px; color:${BACKORDER_COLOR}; margin:0 0 10px;">The following items are on backorder:</div>
      ${list}
      <div>Typical lead time is 3-4 business days but is not guaranteed. If you have any questions, please feel free to contact us at <a href="tel:+12083755534" style="color:${BRAND.accentDark}; text-decoration:none;">${BUSINESS_PHONE}</a> or reply to this email.</div>
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
    from: fromHeader("IHI Website"),
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
    from: fromHeader("IHI Website"),
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


export async function sendNewsletterSignupEmail({ email, source = "website" }) {
  const recipient = process.env.NEWSLETTER_TO || process.env.EMAIL_TO;
  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Boise",
  });

  const contentHtml = `
    ${sectionTitle("Newsletter signup")}
    ${infoTable([
      ["Email", `<a href="mailto:${escapeHtml(email)}" style="color:${BRAND.accentDark}; text-decoration:none;">${escapeHtml(email)}</a>`],
      ["Source", escapeHtml(source || "website")],
      ["Submitted", escapeHtml(submittedAt)],
    ])}
  `;

  return transporter.sendMail({
    from: fromHeader("IHI Website"),
    to: recipient,
    replyTo: email,
    subject: `Newsletter Signup: ${email}`,
    html: emailShell({
      preheader: `New newsletter signup from ${email}`,
      eyebrow: "Industrial Hardware Idaho",
      title: "Newsletter Signup",
      subtitle: email,
      contentHtml,
      footerNote: "Sent from the newsletter form on the IHI website.",
    }),
  });
}

export async function sendOrderConfirmationEmail({
  to,
  orderNumber,
  items,
  amountTotalCents,
  subtotalCents = null,
  taxCents = null,
  taxRate = null,
  taxExempt = false,
  currency = "usd",
  customer,
  billingAddress,
}) {
  if (!to) {
    console.warn("⚠️ No recipient email provided for order confirmation.");
    return;
  }

  const total = (Number(amountTotalCents || 0) / 100).toFixed(2);
  const totalRows = [["Order number", escapeHtml(orderNumber)], ...orderTotalRows({ subtotalCents, taxCents, taxRate, taxExempt }), ["Order total", `$${total} ${escapeHtml(currency.toUpperCase())}`]];
  const rows = (items || [])
    .map(
      (it) => `
        <tr>
          <td style="padding:10px 12px 10px 0; font-family:${BRAND.fontBody}; font-size:14px; line-height:1.6; color:${BRAND.altColor}; border-bottom:1px solid ${BRAND.secondaryLight};">${escapeHtml(it.name || it.partNumber)}</td>
          <td style="padding:10px 12px; text-align:center; font-family:${BRAND.fontBody}; font-size:14px; line-height:1.6; color:${BRAND.altColor}; border-bottom:1px solid ${BRAND.secondaryLight};">${Number(it.qty || 0)}${Number(it.qtyBackordered || 0) > 0 ? `<br><span style="color:#8a5a00; font-size:12px; font-weight:600;">${Number(it.qtyBackordered)} backordered</span>` : ""}</td>
          <td style="padding:10px 0; text-align:right; font-family:${BRAND.fontBody}; font-size:14px; line-height:1.6; color:${BRAND.altColor}; border-bottom:1px solid ${BRAND.secondaryLight};">$${Number(it.lineTotal || 0).toFixed(2)}</td>
        </tr>
      `,
    )
    .join("");

  const contentHtml = `
    <div style="font-family:${BRAND.fontBody}; font-size:15px; line-height:1.7; color:${BRAND.altColor}; margin-bottom:20px;">
      Thank you${customer?.firstName ? `, ${escapeHtml(customer.firstName)}` : ""}. Your order has been received and is being processed.
    </div>
    ${backorderNotice(items)}
    ${sectionTitle("Order summary")}
    ${infoTable(totalRows)}
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
      ${sectionTitle("Pickup")}
      <div style="font-family:${BRAND.fontBody}; font-size:14px; line-height:1.7; color:${BRAND.altColor};">${PICKUP_NOTE_HTML}</div>
    </div>
  `;

  return transporter.sendMail({
    from: fromHeader("Industrial Hardware Idaho"),
    to,
    // Customer replies go to the store inbox.
    replyTo: process.env.EMAIL_TO || FROM_ADDRESS,
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

// True when the site has somewhere to send mail from.
export function mailConfigured() {
  return Boolean(FROM_ADDRESS);
}

// purpose "verify" finishes a sign-up; "delete" confirms deleting an account.
export async function sendVerificationCodeEmail({ to, code, firstName = "", purpose = "verify" }) {
  const deleting = purpose === "delete";
  const contentHtml = `
    <div style="font-family:${BRAND.fontBody}; font-size:15px; line-height:1.7; color:${BRAND.altColor}; margin-bottom:18px;">
      ${firstName ? `Hi ${escapeHtml(firstName)},<br/><br/>` : ""}${
        deleting
          ? "Enter this code on the Industrial Hardware Idaho website to confirm <strong>deleting your account</strong>. If you didn't ask for this, don't share the code and call us at " + BUSINESS_PHONE + "."
          : "Enter this code on the Industrial Hardware Idaho website to finish creating your account."
      }
    </div>
    <div style="text-align:center; margin:0 0 18px;">
      <div style="display:inline-block; font-family:${BRAND.fontMain}; font-size:34px; letter-spacing:10px; color:${BRAND.mainColor}; background:${BRAND.mainLight}; border:1px solid ${BRAND.accentLight}; border-radius:14px; padding:14px 22px;">${escapeHtml(code)}</div>
    </div>
    <div style="font-family:${BRAND.fontBody}; font-size:14px; line-height:1.7; color:${BRAND.altColor};">
      The code expires in 15 minutes. If you didn't sign up, you can ignore this email.
    </div>
  `;

  return transporter.sendMail({
    from: fromHeader("Industrial Hardware Idaho"),
    to,
    replyTo: process.env.EMAIL_TO || FROM_ADDRESS,
    subject: deleting
      ? `Code to delete your Industrial Hardware Idaho account: ${code}`
      : `Your Industrial Hardware Idaho code: ${code}`,
    html: emailShell({
      preheader: deleting ? `Your account deletion code is ${code}` : `Your verification code is ${code}`,
      title: deleting ? "Confirm account deletion" : "Verify your email",
      contentHtml,
      footerNote: deleting
        ? "Sent because someone asked to delete this account on ihidaho.com."
        : "Sent because this email address was used to create an account on ihidaho.com.",
    }),
  });
}

export async function sendAccountDeletedEmail({ to, firstName = "" }) {
  const contentHtml = `
    <div style="font-family:${BRAND.fontBody}; font-size:15px; line-height:1.7; color:${BRAND.altColor};">
      ${firstName ? `Hi ${escapeHtml(firstName)},<br/><br/>` : ""}Your Industrial Hardware Idaho website account has been deleted. Your saved card, addresses and profile were removed. Records of past orders are kept by the store.<br/><br/>
      If you didn't do this, call us at ${BUSINESS_PHONE}. You're always welcome to create a new account.
    </div>
  `;

  return transporter.sendMail({
    from: fromHeader("Industrial Hardware Idaho"),
    to,
    replyTo: process.env.EMAIL_TO || FROM_ADDRESS,
    subject: "Your Industrial Hardware Idaho account was deleted",
    html: emailShell({
      preheader: "Your website account was deleted.",
      title: "Account deleted",
      contentHtml,
      footerNote: "Sent to confirm a change to your account.",
    }),
  });
}

export async function sendPasswordChangedEmail({ to, firstName = "" }) {
  const contentHtml = `
    <div style="font-family:${BRAND.fontBody}; font-size:15px; line-height:1.7; color:${BRAND.altColor};">
      ${firstName ? `Hi ${escapeHtml(firstName)},<br/><br/>` : ""}The password for your Industrial Hardware Idaho account was just changed.<br/><br/>
      If you made this change, there's nothing else to do. If you didn't, reset your password from the sign-in page right away and call us at ${BUSINESS_PHONE}.
    </div>
  `;

  return transporter.sendMail({
    from: fromHeader("Industrial Hardware Idaho"),
    to,
    replyTo: process.env.EMAIL_TO || FROM_ADDRESS,
    subject: "Your Industrial Hardware Idaho password was changed",
    html: emailShell({
      preheader: "Your account password was changed.",
      title: "Password changed",
      contentHtml,
      footerNote: "Sent to let you know about a change to your account.",
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

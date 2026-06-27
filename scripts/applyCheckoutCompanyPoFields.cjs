const fs = require('fs');
const path = require('path');

const root = process.cwd();

function file(rel) {
  return path.join(root, rel);
}

function read(rel) {
  const p = file(rel);
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function write(rel, text) {
  fs.writeFileSync(file(rel), text);
  console.log(`✓ patched ${rel}`);
}

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) {
    console.warn(`⚠ skipped ${label}: pattern not found`);
    return text;
  }
  return text.replace(from, to);
}


function replaceAllMissing(text, from, to, label) {
  if (!text.includes(from)) return text;
  const count = text.split(from).length - 1;
  console.log(`  ${label}: patched ${count} occurrence(s)`);
  return text.split(from).join(to);
}

function insertAfter(text, marker, insert, label) {
  if (text.includes(insert.trim())) return text;
  if (!text.includes(marker)) {
    console.warn(`⚠ skipped ${label}: marker not found`);
    return text;
  }
  return text.replace(marker, `${marker}${insert}`);
}

function patchCheckout() {
  const rel = 'client/src/pages/Checkout/Checkout.jsx';
  let text = read(rel);

  text = replaceOnce(
    text,
    `\t\tphone: "",\n\t\taddress: normalizeAddress({}),`,
    `\t\tphone: "",\n\t\tcompanyName: "",\n\t\tpoNumber: "",\n\t\taddress: normalizeAddress({}),`,
    'billing state company/po fields',
  );

  text = replaceOnce(
    text,
    `\t\t\tphone: user.phone || "",\n\t\t\taddress: normalizeAddress(user.billingAddress),`,
    `\t\t\tphone: user.phone || "",\n\t\t\tcompanyName: user.company?.name || user.companyName || "",\n\t\t\tpoNumber: "",\n\t\t\taddress: normalizeAddress(user.billingAddress),`,
    'billing prefill company/po fields',
  );

  const phoneBlock = `\t\t\t\t\t\t\t<div className='col-12 col-md-6'>\n\t\t\t\t\t\t\t\t<label className='form-input-label text-uppercase form-label text-main mb-0'>Phone</label>\n\t\t\t\t\t\t\t\t<input className='form-input form-control rounded-3 text-dark' value={billing.phone} onChange={(e) => setBillingField("phone", e.target.value)} />\n\t\t\t\t\t\t\t</div>\n`;

  const companyPoBlock = `\n\t\t\t\t\t\t\t<div className='col-12 col-md-6'>\n\t\t\t\t\t\t\t\t<label className='form-input-label text-uppercase form-label text-main mb-0'>Company name <span className='text-muted text-capitalize'>(optional)</span></label>\n\t\t\t\t\t\t\t\t<input\n\t\t\t\t\t\t\t\t\tclassName='form-input form-control rounded-3 text-dark'\n\t\t\t\t\t\t\t\t\tvalue={billing.companyName}\n\t\t\t\t\t\t\t\t\tonChange={(e) => setBillingField("companyName", e.target.value)}\n\t\t\t\t\t\t\t\t\tplaceholder='Company name'\n\t\t\t\t\t\t\t\t/>\n\t\t\t\t\t\t\t</div>\n\n\t\t\t\t\t\t\t<div className='col-12 col-md-6'>\n\t\t\t\t\t\t\t\t<label className='form-input-label text-uppercase form-label text-main mb-0'>PO# <span className='text-muted text-capitalize'>(optional)</span></label>\n\t\t\t\t\t\t\t\t<input\n\t\t\t\t\t\t\t\t\tclassName='form-input form-control rounded-3 text-dark'\n\t\t\t\t\t\t\t\t\tvalue={billing.poNumber}\n\t\t\t\t\t\t\t\t\tonChange={(e) => setBillingField("poNumber", e.target.value)}\n\t\t\t\t\t\t\t\t\tplaceholder='Purchase order number'\n\t\t\t\t\t\t\t\t/>\n\t\t\t\t\t\t\t</div>\n`;

  if (!text.includes('value={billing.companyName}') && text.includes(phoneBlock)) {
    text = text.replace(phoneBlock, phoneBlock + companyPoBlock);
  } else if (!text.includes('value={billing.companyName}')) {
    console.warn('⚠ skipped checkout company/po inputs: phone block not found');
  }

  text = replaceOnce(
    text,
    `\t\t\t\tbody: JSON.stringify({\n\t\t\t\t\tpayLaterType,\n\t\t\t\t\titems: orderItemsPayload,\n\t\t\t\t}),`,
    `\t\t\t\tbody: JSON.stringify({\n\t\t\t\t\tpayLaterType,\n\t\t\t\t\tcompanyName: billing.companyName,\n\t\t\t\t\tpoNumber: billing.poNumber,\n\t\t\t\t\titems: orderItemsPayload,\n\t\t\t\t}),`,
    'pay-later company/po payload',
  );

  text = replaceOnce(
    text,
    `\t\t\t\tbody: JSON.stringify({\n\t\t\t\t\tamountCents,\n\t\t\t\t\tcurrency: "usd",\n\t\t\t\t\titems: orderItemsPayload,`,
    `\t\t\t\tbody: JSON.stringify({\n\t\t\t\t\tamountCents,\n\t\t\t\t\tcurrency: "usd",\n\t\t\t\t\tcompanyName: billing.companyName,\n\t\t\t\t\tpoNumber: billing.poNumber,\n\t\t\t\t\titems: orderItemsPayload,`,
    'saved-card company/po payload',
  );

  text = replaceOnce(
    text,
    `\t\t\t\t\tbody: JSON.stringify({\n\t\t\t\t\t\tamountCents,\n\t\t\t\t\t\tcurrency: "usd",\n\t\t\t\t\t\tsaveThisCard,`,
    `\t\t\t\t\tbody: JSON.stringify({\n\t\t\t\t\t\tamountCents,\n\t\t\t\t\t\tcurrency: "usd",\n\t\t\t\t\t\tcompanyName: billing?.companyName || "",\n\t\t\t\t\t\tpoNumber: billing?.poNumber || "",\n\t\t\t\t\t\tsaveThisCard,`,
    'manual-card intent company/po payload',
  );

  write(rel, text);
}

function patchOrderModel() {
  const rel = 'server/src/models/Order.js';
  let text = read(rel);

  if (!text.includes('poNumber: { type: String')) {
    text = replaceOnce(
      text,
      `    shippingSameAsBilling: { type: Boolean, default: true },\n\n    items: { type: [OrderItemSchema], default: [] },`,
      `    shippingSameAsBilling: { type: Boolean, default: true },\n\n    poNumber: { type: String, default: "", trim: true },\n    customerPO: { type: String, default: "", trim: true },\n    purchaseOrderNumber: { type: String, default: "", trim: true },\n\n    items: { type: [OrderItemSchema], default: [] },`,
      'order po fields',
    );
  }

  write(rel, text);
}

function patchCheckoutController() {
  const rel = 'server/src/controllers/checkoutController.js';
  let text = read(rel);

  text = insertAfter(
    text,
    `function safeAddress(a) {\n  return {\n    address1: a?.address1 || "",\n    address2: a?.address2 || "",\n    city: a?.city || "",\n    state: a?.state || "",\n    zip: a?.zip || "",\n  };\n}\n`,
    `\nfunction cleanText(value, max = 120) {\n  const text = String(value || "").trim();\n  return text.length > max ? text.slice(0, max) : text;\n}\n`,
    'cleanText helper',
  );

  const oldSnapshot = `function buildCustomerSnapshot(user) {\n  return {\n    firstName: user.firstName || "",\n    lastName: user.lastName || "",\n    email: user.email || "",\n    phone: user.phone || "",\n    companyName: user.company?.name || "",\n  };\n}`;
  const newSnapshot = `function buildCustomerSnapshot(user, checkout = {}) {\n  const checkoutCompanyName = cleanText(checkout.companyName, 120);\n\n  return {\n    firstName: user.firstName || "",\n    lastName: user.lastName || "",\n    email: user.email || "",\n    phone: user.phone || "",\n    companyName: checkoutCompanyName || user.company?.name || user.companyName || "",\n  };\n}`;
  text = replaceOnce(text, oldSnapshot, newSnapshot, 'customer snapshot checkout company');

  text = replaceOnce(
    text,
    `  paymentStatus = "PENDING",\n  pricingContext = {},\n}) {`,
    `  paymentStatus = "PENDING",\n  pricingContext = {},\n  companyName = "",\n  poNumber = "",\n}) {`,
    'normalized payload params',
  );

  text = replaceOnce(
    text,
    `    customer: buildCustomerSnapshot(user),\n    billingAddress: safeAddress(billingAddress || user.billingAddress),`,
    `    customer: buildCustomerSnapshot(user, { companyName }),\n    poNumber: cleanText(poNumber, 64),\n    customerPO: cleanText(poNumber, 64),\n    purchaseOrderNumber: cleanText(poNumber, 64),\n    billingAddress: safeAddress(billingAddress || user.billingAddress),`,
    'normalized payload company/po data',
  );

  text = replaceOnce(
    text,
    `    const { payLaterType, items = [] } = req.body || {};`,
    `    const { payLaterType, items = [], companyName = "", poNumber = "", customerPO = "" } = req.body || {};`,
    'pay-later destructure company/po',
  );

  text = replaceOnce(
    text,
    `      paymentStatus: "INVOICED",\n      pricingContext,\n    });`,
    `      paymentStatus: "INVOICED",\n      pricingContext,\n      companyName,\n      poNumber: poNumber || customerPO,\n    });`,
    'pay-later normalized company/po params',
  );

  text = replaceAllMissing(
    text,
    `      shippingAddress,
      shippingSameAsBilling = true,
    } = req.body || {};`,
    `      shippingAddress,
      shippingSameAsBilling = true,
      companyName = "",
      poNumber = "",
      customerPO = "",
    } = req.body || {};`,
    'pay-now/saved-card destructure company/po',
  );

  text = replaceAllMissing(
    text,
    `      paymentStatus: "PENDING",
      pricingContext,
    });`,
    `      paymentStatus: "PENDING",
      pricingContext,
      companyName,
      poNumber: poNumber || customerPO,
    });`,
    'pay-now/saved-card normalized company/po params',
  );
  write(rel, text);
}

function patchFishbowlPush() {
  const rel = 'server/src/services/fishbowl/pushOrderToFishbowl.js';
  const p = file(rel);
  if (!fs.existsSync(p)) {
    console.warn(`⚠ skipped ${rel}: file not found`);
    return;
  }
  let text = read(rel);

  text = replaceOnce(
    text,
    `order.customerPO || order.poNumber || externalRef`,
    `order.customerPO || order.poNumber || order.purchaseOrderNumber || externalRef`,
    'Fishbowl PONum order field fallback',
  );

  text = replaceOnce(
    text,
    `Customer email: ${'${order.customer?.email || "N/A"}'}.`,
    `Customer email: ${'${order.customer?.email || "N/A"}'}. PO#: ${'${order.customerPO || order.poNumber || order.purchaseOrderNumber || "N/A"}'}.`,
    'Fishbowl order note PO field',
  );

  write(rel, text);
}

function patchAdminOrderSearch() {
  const rel = 'server/src/routes/adminOrdersRoutes.js';
  const p = file(rel);
  if (!fs.existsSync(p)) return;
  let text = read(rel);

  if (!text.includes('{ poNumber: { $regex: q')) {
    text = replaceOnce(
      text,
      `        { "customer.companyName": { $regex: q, $options: "i" } },\n        { "customer.firstName": { $regex: q, $options: "i" } },`,
      `        { "customer.companyName": { $regex: q, $options: "i" } },\n        { poNumber: { $regex: q, $options: "i" } },\n        { customerPO: { $regex: q, $options: "i" } },\n        { purchaseOrderNumber: { $regex: q, $options: "i" } },\n        { "customer.firstName": { $regex: q, $options: "i" } },`,
      'admin order search PO fields',
    );
  }

  write(rel, text);
}

function patchOrderConfirmation() {
  const rel = 'client/src/pages/OrderConfirmation/OrderConfirmation.jsx';
  const p = file(rel);
  if (!fs.existsSync(p)) return;
  let text = read(rel);

  const marker = `          <div className="text-muted small mt-1">\n            Order #: <span className="text-main fw-semibold">{order.orderNumber}</span>\n          </div>\n`;
  const insert = `\n          {order.customer?.companyName ? (\n            <div className="text-muted small mt-1">\n              Company: <span className="text-main fw-semibold">{order.customer.companyName}</span>\n            </div>\n          ) : null}\n\n          {order.poNumber || order.customerPO || order.purchaseOrderNumber ? (\n            <div className="text-muted small mt-1">\n              PO#: <span className="text-main fw-semibold">{order.poNumber || order.customerPO || order.purchaseOrderNumber}</span>\n            </div>\n          ) : null}\n`;
  if (!text.includes('PO#: <span') && text.includes(marker)) {
    text = text.replace(marker, marker + insert);
  }

  write(rel, text);
}

function main() {
  patchCheckout();
  patchOrderModel();
  patchCheckoutController();
  patchFishbowlPush();
  patchAdminOrderSearch();
  patchOrderConfirmation();
  console.log('\nDone. Restart the server and rebuild the client after reviewing the diff.');
}

main();

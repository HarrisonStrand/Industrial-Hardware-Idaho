const fs = require('fs');
const path = require('path');

const root = process.cwd();

function file(rel) {
  return path.join(root, rel);
}

function exists(rel) {
  return fs.existsSync(file(rel));
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

function replaceAll(text, from, to, label) {
  if (!text.includes(from)) return text;
  if (text.includes(to)) return text;
  const count = text.split(from).length - 1;
  console.log(`  ${label}: patched ${count} occurrence(s)`);
  return text.split(from).join(to);
}

function patchCheckout() {
  const rel = 'client/src/pages/Checkout/Checkout.jsx';
  if (!exists(rel)) return console.warn(`⚠ skipped ${rel}: file not found`);
  let text = read(rel);

  text = replaceOnce(
    text,
    `function normalizeAddress(a) {\n\treturn {\n\t\taddress1: a?.address1 || "",`,
    `function normalizeAddress(a) {\n\treturn {\n\t\tname: a?.name || a?.companyName || "",\n\t\tcompanyName: a?.companyName || a?.name || "",\n\t\taddress1: a?.address1 || "",`,
    'checkout normalizeAddress billing name/company fields',
  );

  text = replaceOnce(
    text,
    `\t\t\tcompanyName: user.company?.name || user.companyName || "",`,
    `\t\t\tcompanyName: user.billingAddress?.companyName || user.billingAddress?.name || user.company?.name || user.companyName || "",`,
    'billing company prefill from billing address',
  );

  text = replaceOnce(
    text,
    `\t\t\taddress: { ...billing.address },`,
    `\t\t\taddress: { ...billing.address, name: billing.companyName || "", companyName: billing.companyName || "" },`,
    'shipping same-as-billing company name sync',
  );

  text = replaceOnce(
    text,
    `\t\tbilling.address,\n\t]);`,
    `\t\tbilling.address,\n\t\tbilling.companyName,\n\t]);`,
    'shipping same-as-billing company dependency',
  );

  text = replaceOnce(
    text,
    `\t\t\tbillingAddress: { ...billing.address },`,
    `\t\t\tbillingAddress: { ...billing.address, name: billing.companyName || "", companyName: billing.companyName || "" },`,
    'profile billing address company name',
  );

  text = replaceOnce(
    text,
    `\t\t\t\t? { ...billing.address }\n\t\t\t\t: { ...shipping.address },`,
    `\t\t\t\t? { ...billing.address, name: billing.companyName || "", companyName: billing.companyName || "" }\n\t\t\t\t: { ...shipping.address },`,
    'profile delivery same-as-billing company name',
  );

  text = replaceAll(
    text,
    `billingAddress: billing?.address,`,
    `billingAddress: { ...billing?.address, name: billing?.companyName || "", companyName: billing?.companyName || "" },`,
    'checkout API billingAddress company name payloads',
  );

  text = replaceOnce(
    text,
    `shippingAddress: shippingSameAsBilling\n\t\t\t\t\t\t? billing?.address\n\t\t\t\t\t\t: shipping?.address,`,
    `shippingAddress: shippingSameAsBilling\n\t\t\t\t\t\t? { ...billing?.address, name: billing?.companyName || "", companyName: billing?.companyName || "" }\n\t\t\t\t\t\t: shipping?.address,`,
    'saved-card shipping same-as-billing company name payload',
  );

  text = replaceOnce(
    text,
    `shippingAddress: shipping?.address,\n\t\t\t\t\t\tshippingSameAsBilling: Boolean(shippingSameAsBilling),`,
    `shippingAddress: shippingSameAsBilling\n\t\t\t\t\t\t\t? { ...billing?.address, name: billing?.companyName || "", companyName: billing?.companyName || "" }\n\t\t\t\t\t\t\t: shipping?.address,\n\t\t\t\t\t\tshippingSameAsBilling: Boolean(shippingSameAsBilling),`,
    'manual-card shipping same-as-billing company name payload',
  );

  write(rel, text);
}

function patchUserModel() {
  const rel = 'server/src/models/User.js';
  if (!exists(rel)) return;
  let text = read(rel);

  if (!text.includes('companyName: { type: String, trim: true, default: "" }')) {
    text = replaceOnce(
      text,
      `    name: { type: String, trim: true, default: "" },\n    address1:`,
      `    name: { type: String, trim: true, default: "" },\n    companyName: { type: String, trim: true, default: "" },\n    address1:`,
      'user address schema companyName field',
    );
  }

  write(rel, text);
}

function patchOrderModel() {
  const rel = 'server/src/models/Order.js';
  if (!exists(rel)) return;
  let text = read(rel);

  if (!text.includes('companyName: { type: String, default: "", trim: true }')) {
    text = replaceOnce(
      text,
      `  {\n    address1: { type: String, default: "" },`,
      `  {\n    name: { type: String, default: "", trim: true },\n    companyName: { type: String, default: "", trim: true },\n    address1: { type: String, default: "" },`,
      'order address schema companyName field',
    );
  }

  write(rel, text);
}

function patchCheckoutController() {
  const rel = 'server/src/controllers/checkoutController.js';
  if (!exists(rel)) return;
  let text = read(rel);

  text = replaceOnce(
    text,
    `function safeAddress(a) {\n  return {\n    address1: a?.address1 || "",`,
    `function safeAddress(a) {\n  const companyName = cleanText ? cleanText(a?.companyName || a?.name || "", 120) : String(a?.companyName || a?.name || "").trim();\n\n  return {\n    name: companyName,\n    companyName,\n    address1: a?.address1 || "",`,
    'checkout controller safeAddress companyName fields',
  );

  // If cleanText is not present above safeAddress in an older file, use a local no-op-safe helper.
  if (text.includes('const companyName = cleanText ? cleanText') && !text.includes('function cleanText(value')) {
    text = text.replace(
      `function safeAddress(a) {`,
      `function cleanText(value, max = 120) {\n  const text = String(value || "").trim();\n  return text.length > max ? text.slice(0, max) : text;\n}\n\nfunction safeAddress(a) {`,
    );
    text = text.replace('const companyName = cleanText ? cleanText(a?.companyName || a?.name || "", 120) : String(a?.companyName || a?.name || "").trim();', 'const companyName = cleanText(a?.companyName || a?.name || "", 120);');
  } else {
    text = text.replace('const companyName = cleanText ? cleanText(a?.companyName || a?.name || "", 120) : String(a?.companyName || a?.name || "").trim();', 'const companyName = cleanText(a?.companyName || a?.name || "", 120);');
  }

  text = replaceOnce(
    text,
    `    billingAddress: safeAddress(billingAddress || user.billingAddress),`,
    `    billingAddress: safeAddress({\n      ...(billingAddress || user.billingAddress || {}),\n      companyName: companyName || billingAddress?.companyName || billingAddress?.name || user.billingAddress?.companyName || user.billingAddress?.name || "",\n    }),`,
    'normalized order billing address companyName',
  );

  text = replaceOnce(
    text,
    `    shippingAddress: safeAddress(\n      shippingSameAsBilling\n        ? billingAddress || user.billingAddress\n        : shippingAddress || user.deliveryAddress\n    ),`,
    `    shippingAddress: safeAddress(\n      shippingSameAsBilling\n        ? {\n            ...(billingAddress || user.billingAddress || {}),\n            companyName: companyName || billingAddress?.companyName || billingAddress?.name || user.billingAddress?.companyName || user.billingAddress?.name || "",\n          }\n        : shippingAddress || user.deliveryAddress\n    ),`,
    'normalized order shipping same-as-billing companyName',
  );

  write(rel, text);
}

function patchFishbowlPush() {
  const rel = 'server/src/services/fishbowl/pushOrderToFishbowl.js';
  if (!exists(rel)) return;
  let text = read(rel);

  text = replaceOnce(
    text,
    `function addressName(order = {}, type = "billing") {\n  return truncate(\n    order.customer?.companyName ||`,
    `function addressName(order = {}, type = "billing") {\n  const address = type === "shipping" ? order.shippingAddress || {} : order.billingAddress || {};\n\n  return truncate(\n    address.companyName ||\n      address.name ||\n      order.customer?.companyName ||`,
    'Fishbowl addressName prefers billing/shipping companyName',
  );

  write(rel, text);
}

function patchEmailFormatting() {
  const rel = 'server/src/utils/sendOrderConfirmationForOrder.js';
  if (!exists(rel)) return;
  let text = read(rel);

  text = replaceOnce(
    text,
    `  return [\n    addr.address1,`,
    `  return [\n    addr.companyName || addr.name,\n    addr.address1,`,
    'email address formatter includes companyName',
  );

  write(rel, text);
}

function main() {
  patchCheckout();
  patchUserModel();
  patchOrderModel();
  patchCheckoutController();
  patchFishbowlPush();
  patchEmailFormatting();
  console.log('\nDone. Review git diff, restart the server, and rebuild the client.');
}

main();

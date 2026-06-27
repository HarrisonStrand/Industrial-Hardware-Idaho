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
  console.log(`  ${label}`);
  return text.replace(from, to);
}

function replaceAll(text, from, to, label) {
  if (!text.includes(from)) return text;
  if (text.includes(to)) return text;
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
  console.log(`  ${label}`);
  return text.replace(marker, `${marker}${insert}`);
}

function ensureCheckoutNormalizeAddress(text) {
  // The prior billing-company patch usually added these. Keep this idempotent for projects that missed it.
  text = replaceOnce(
    text,
    `function normalizeAddress(a) {\n\treturn {\n\t\taddress1: a?.address1 || "",`,
    `function normalizeAddress(a) {\n\treturn {\n\t\tname: a?.name || a?.companyName || "",\n\t\tcompanyName: a?.companyName || a?.name || "",\n\t\taddress1: a?.address1 || "",`,
    'checkout normalizeAddress supports address name/companyName',
  );
  return text;
}

function ensureAddressCompanyObject(addressExpr, companyExpr) {
  return `{ ...${addressExpr}, name: ${companyExpr} || "", companyName: ${companyExpr} || "" }`;
}

function patchCheckout() {
  const rel = 'client/src/pages/Checkout/Checkout.jsx';
  if (!exists(rel)) return console.warn(`⚠ skipped ${rel}: file not found`);
  let text = read(rel);

  text = ensureCheckoutNormalizeAddress(text);

  text = replaceOnce(
    text,
    `\tconst [shipping, setShipping] = useState({\n\t\tfirstName: "",\n\t\tlastName: "",\n\t\tphone: "",\n\t\taddress: normalizeAddress({}),\n\t});`,
    `\tconst [shipping, setShipping] = useState({\n\t\tfirstName: "",\n\t\tlastName: "",\n\t\tphone: "",\n\t\tcompanyName: "",\n\t\taddress: normalizeAddress({}),\n\t});`,
    'checkout shipping state companyName field',
  );

  text = replaceOnce(
    text,
    `\t\tsetShipping({\n\t\t\tfirstName: user.firstName || "",\n\t\t\tlastName: user.lastName || "",\n\t\t\tphone: user.phone || "",\n\t\t\taddress: normalizeAddress(user.deliveryAddress),\n\t\t});`,
    `\t\tsetShipping({\n\t\t\tfirstName: user.firstName || "",\n\t\t\tlastName: user.lastName || "",\n\t\t\tphone: user.phone || "",\n\t\t\tcompanyName: user.deliveryAddress?.companyName || user.deliveryAddress?.name || user.company?.name || user.companyName || "",\n\t\t\taddress: normalizeAddress(user.deliveryAddress),\n\t\t});`,
    'checkout shipping prefill companyName',
  );

  text = replaceOnce(
    text,
    `\t\tsetShipping((prev) => ({\n\t\t\t...prev,\n\t\t\tfirstName: billing.firstName,\n\t\t\tlastName: billing.lastName,\n\t\t\tphone: billing.phone,\n\t\t\taddress: { ...billing.address },\n\t\t}));`,
    `\t\tsetShipping((prev) => ({\n\t\t\t...prev,\n\t\t\tfirstName: billing.firstName,\n\t\t\tlastName: billing.lastName,\n\t\t\tphone: billing.phone,\n\t\t\tcompanyName: billing.companyName || "",\n\t\t\taddress: { ...billing.address, name: billing.companyName || "", companyName: billing.companyName || "" },\n\t\t}));`,
    'checkout same-as-billing syncs shipping companyName',
  );

  text = replaceOnce(
    text,
    `\t\tbilling.phone,\n\t\tbilling.address,\n\t]);`,
    `\t\tbilling.phone,\n\t\tbilling.companyName,\n\t\tbilling.address,\n\t]);`,
    'checkout same-as-billing effect depends on billing.companyName',
  );

  // If a previous billing patch already added billing.companyName dependency after billing.address, handle that shape too.
  text = replaceOnce(
    text,
    `\t\tbilling.address,\n\t\tbilling.companyName,\n\t]);`,
    `\t\tbilling.companyName,\n\t\tbilling.address,\n\t]);`,
    'checkout same-as-billing dependency order cleanup',
  );

  text = replaceOnce(
    text,
    `\t\tconst payload = {\n\t\t\tfirstName: billing.firstName,\n\t\t\tlastName: billing.lastName,\n\t\t\temail: billing.email,\n\t\t\tphone: billing.phone,\n\t\t\tbillingAddress: { ...billing.address },\n\t\t\tdeliveryAddress: shippingSameAsBilling\n\t\t\t\t? { ...billing.address }\n\t\t\t\t: { ...shipping.address },\n\t\t};`,
    `\t\tconst payload = {\n\t\t\tfirstName: billing.firstName,\n\t\t\tlastName: billing.lastName,\n\t\t\temail: billing.email,\n\t\t\tphone: billing.phone,\n\t\t\tbillingAddress: { ...billing.address, name: billing.companyName || "", companyName: billing.companyName || "" },\n\t\t\tdeliveryAddress: shippingSameAsBilling\n\t\t\t\t? { ...billing.address, name: billing.companyName || "", companyName: billing.companyName || "" }\n\t\t\t\t: { ...shipping.address, name: shipping.companyName || "", companyName: shipping.companyName || "" },\n\t\t};`,
    'profile persistence stores shipping companyName',
  );

  // Current local may already have the billing part patched. Patch only the deliveryAddress branches if so.
  text = replaceOnce(
    text,
    `\t\t\tdeliveryAddress: shippingSameAsBilling\n\t\t\t\t? { ...billing.address, name: billing.companyName || "", companyName: billing.companyName || "" }\n\t\t\t\t: { ...shipping.address },`,
    `\t\t\tdeliveryAddress: shippingSameAsBilling\n\t\t\t\t? { ...billing.address, name: billing.companyName || "", companyName: billing.companyName || "" }\n\t\t\t\t: { ...shipping.address, name: shipping.companyName || "", companyName: shipping.companyName || "" },`,
    'profile persistence stores different-shipping companyName',
  );

  const shippingPhoneBlock = `\t\t\t\t\t\t\t\t\t<div className='col-12 col-md-6'>\n\t\t\t\t\t\t\t\t\t\t<label className='form-input-label text-uppercase form-label text-main mb-0'>Phone</label>\n\t\t\t\t\t\t\t\t\t\t<input className='form-input form-control rounded-3 text-dark' value={shipping.phone} onChange={(e) => setShippingField("phone", e.target.value)} />\n\t\t\t\t\t\t\t\t\t</div>\n`;
  const shippingCompanyBlock = `\n\t\t\t\t\t\t\t\t\t<div className='col-12 col-md-6'>\n\t\t\t\t\t\t\t\t\t\t<label className='form-input-label text-uppercase form-label text-main mb-0'>Company name <span className='text-muted text-capitalize'>(optional)</span></label>\n\t\t\t\t\t\t\t\t\t\t<input\n\t\t\t\t\t\t\t\t\t\t\tclassName='form-input form-control rounded-3 text-dark'\n\t\t\t\t\t\t\t\t\t\t\tvalue={shipping.companyName}\n\t\t\t\t\t\t\t\t\t\t\tonChange={(e) => setShippingField("companyName", e.target.value)}\n\t\t\t\t\t\t\t\t\t\t\tplaceholder='Shipping company name'\n\t\t\t\t\t\t\t\t\t\t/>\n\t\t\t\t\t\t\t\t\t</div>\n`;

  if (!text.includes('value={shipping.companyName}')) {
    if (text.includes(shippingPhoneBlock)) {
      text = text.replace(shippingPhoneBlock, shippingPhoneBlock + shippingCompanyBlock);
      console.log('  checkout shipping companyName input');
    } else {
      // Less whitespace-sensitive fallback: insert after the first input bound to shipping.phone.
      const fallback = /(<input[^>]+value=\{shipping\.phone\}[^>]+onChange=\{\(e\) => setShippingField\("phone", e\.target\.value\)\}[^>]*\s*\/?>\s*<\/div>)/;
      if (fallback.test(text)) {
        text = text.replace(fallback, `$1${shippingCompanyBlock}`);
        console.log('  checkout shipping companyName input (fallback)');
      } else {
        console.warn('⚠ skipped checkout shipping companyName input: shipping phone block not found');
      }
    }
  }

  // Patch saved-card/manual-card shippingAddress payloads. These replacements are safe whether the prior billing-company patch was applied or not.
  text = replaceOnce(
    text,
    `shippingAddress: shippingSameAsBilling\n\t\t\t\t\t\t? billing?.address\n\t\t\t\t\t\t: shipping?.address,`,
    `shippingAddress: shippingSameAsBilling\n\t\t\t\t\t\t? { ...billing?.address, name: billing?.companyName || "", companyName: billing?.companyName || "" }\n\t\t\t\t\t\t: { ...shipping?.address, name: shipping?.companyName || "", companyName: shipping?.companyName || "" },`,
    'saved-card shippingAddress companyName payload',
  );

  text = replaceOnce(
    text,
    `shippingAddress: shippingSameAsBilling\n\t\t\t\t\t\t? { ...billing?.address, name: billing?.companyName || "", companyName: billing?.companyName || "" }\n\t\t\t\t\t\t: shipping?.address,`,
    `shippingAddress: shippingSameAsBilling\n\t\t\t\t\t\t? { ...billing?.address, name: billing?.companyName || "", companyName: billing?.companyName || "" }\n\t\t\t\t\t\t: { ...shipping?.address, name: shipping?.companyName || "", companyName: shipping?.companyName || "" },`,
    'saved-card different-shipping companyName payload',
  );

  text = replaceOnce(
    text,
    `shippingAddress: shippingSameAsBilling\n\t\t\t\t\t\t\t? { ...billing?.address, name: billing?.companyName || "", companyName: billing?.companyName || "" }\n\t\t\t\t\t\t\t: shipping?.address,`,
    `shippingAddress: shippingSameAsBilling\n\t\t\t\t\t\t\t? { ...billing?.address, name: billing?.companyName || "", companyName: billing?.companyName || "" }\n\t\t\t\t\t\t\t: { ...shipping?.address, name: shipping?.companyName || "", companyName: shipping?.companyName || "" },`,
    'manual-card different-shipping companyName payload',
  );

  // Generic last pass for any remaining explicit different-shipping branch.
  text = replaceAll(
    text,
    `: shipping?.address,`,
    `: { ...shipping?.address, name: shipping?.companyName || "", companyName: shipping?.companyName || "" },`,
    'remaining shipping address payload companyName branches',
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

  // Make sure safeAddress keeps companyName/name from shippingAddress payloads.
  text = replaceOnce(
    text,
    `function safeAddress(a) {\n  return {\n    address1: a?.address1 || "",`,
    `function safeAddress(a) {\n  const companyName = typeof cleanText === "function"\n    ? cleanText(a?.companyName || a?.name || "", 120)\n    : String(a?.companyName || a?.name || "").trim();\n\n  return {\n    name: companyName,\n    companyName,\n    address1: a?.address1 || "",`,
    'checkout controller safeAddress keeps companyName/name',
  );

  // If the previous billing patch already added safeAddress companyName, this branch will be skipped.
  text = text.replace('const companyName = typeof cleanText === "function"\n    ? cleanText(a?.companyName || a?.name || "", 120)\n    : String(a?.companyName || a?.name || "").trim();', 'const companyName = typeof cleanText === "function"\n    ? cleanText(a?.companyName || a?.name || "", 120)\n    : String(a?.companyName || a?.name || "").trim();');

  // When shipping is same as billing, ensure companyName is passed through. If different, safeAddress now keeps shippingAddress.companyName.
  text = replaceOnce(
    text,
    `    shippingAddress: safeAddress(\n      shippingSameAsBilling\n        ? billingAddress || user.billingAddress\n        : shippingAddress || user.deliveryAddress\n    ),`,
    `    shippingAddress: safeAddress(\n      shippingSameAsBilling\n        ? {\n            ...(billingAddress || user.billingAddress || {}),\n            companyName: companyName || billingAddress?.companyName || billingAddress?.name || user.billingAddress?.companyName || user.billingAddress?.name || "",\n          }\n        : shippingAddress || user.deliveryAddress\n    ),`,
    'checkout controller same-as-billing shipping companyName',
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
    'Fishbowl addressName prefers shipping companyName',
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

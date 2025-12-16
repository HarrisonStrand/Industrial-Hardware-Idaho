// seed-prices.cjs
// -------------------------------------------------------------
// Adds dummy prices to product-skus.json
// Safe to re-run (won't double-price)
// -------------------------------------------------------------

const fs = require("fs");
const path = require("path");

const SKU_PATH = path.join(
  __dirname,
  "client/src/data/product-skus.json"
);

if (!fs.existsSync(SKU_PATH)) {
  console.error("❌ product-skus.json not found");
  process.exit(1);
}

const skus = JSON.parse(fs.readFileSync(SKU_PATH, "utf8"));

// -------------------------------------------------------------
// BASE PRICES (by category.id)
// -------------------------------------------------------------
const BASE_PRICE = {
  bolts: 0.4,
  "machine-screws": 0.2,
  "sheet-metal-screws": 0.18,
  washers: 0.06,
  nuts: 0.25
};

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------
function diameterMultiplier(diameter) {
  if (!diameter) return 1;

  if (diameter.startsWith("#")) {
    const num = parseInt(diameter.replace("#", ""), 10);
    return Number.isFinite(num) ? 1 + num * 0.02 : 1;
  }

  const frac = {
    "1/4": 1.1,
    "5/16": 1.2,
    "3/8": 1.35,
    "7/16": 1.5,
    "1/2": 1.7,
    "9/16": 1.9,
    "5/8": 2.1,
    "3/4": 2.6
  };

  return frac[diameter] || 1;
}

function lengthMultiplier(length) {
  if (!length) return 1;

  const whole = length.split(" ")[0];
  const num = Number(whole);

  return Number.isFinite(num) ? 1 + num * 0.25 : 1;
}

function finishMultiplier(finish) {
  if (!finish) return 1;

  const f = finish.toLowerCase();

  if (f.includes("stainless")) return 1.4;
  if (f.includes("black")) return 1.1;
  if (f.includes("zinc")) return 1.05;
  if (f.includes("hdg")) return 1.2;

  return 1;
}

// -------------------------------------------------------------
// PRICE SEEDING
// -------------------------------------------------------------
let updated = 0;
let skipped = 0;

const pricedSkus = skus.map((sku) => {
  // Only skip if price is a valid number
  if (typeof sku.price === "number" && !Number.isNaN(sku.price)) {
    return sku;
  }

  const base = BASE_PRICE[sku.category] ?? 0.25;

  let price =
    base *
    diameterMultiplier(sku.attributes?.diameter) *
    finishMultiplier(sku.attributes?.finish);

  // Length only applies if it exists
  if (sku.attributes?.length) {
    price *= lengthMultiplier(sku.attributes.length);
  }

  if (!Number.isFinite(price)) {
    skipped++;
    return { ...sku, price: base };
  }

  updated++;

  return {
    ...sku,
    price: Number(price.toFixed(2))
  };
});

// -------------------------------------------------------------
// WRITE FILE
// -------------------------------------------------------------
fs.writeFileSync(SKU_PATH, JSON.stringify(pricedSkus, null, 2));

console.log(`✅ Price seeding complete`);
console.log(`💲 Prices added to ${updated} SKUs`);
console.log(`⚠️ Skipped (fallback-priced): ${skipped}`);

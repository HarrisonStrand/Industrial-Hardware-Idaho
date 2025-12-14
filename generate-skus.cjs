// generate-skus.cjs
// -------------------------------------------------------------
// Generates product-skus.json from product-parameters.json
// -------------------------------------------------------------

const fs = require("fs");
const path = require("path");

// IMPORT PART NUMBER GENERATOR FIRST
const { generatePartNumber } = require("./client/src/utils/partNumberGenerator.cjs");

// 🔒 HARD GUARD — prevents silent failure forever
if (typeof generatePartNumber !== "function") {
  throw new Error(
    "❌ generatePartNumber is not a function. Check partNumberGenerator.cjs exports."
  );
}

// Debug confirmation (safe)
console.log("✅ Loaded generatePartNumber");

// FILE PATHS
const PARAMS_PATH = path.join(__dirname, "client/src/data/product-parameters.json");
const OUTPUT_PATH = path.join(__dirname, "client/src/data/product-skus.json");

// SAFETY CHECKS
if (!fs.existsSync(PARAMS_PATH)) {
  console.error("❌ Missing product-parameters.json:", PARAMS_PATH);
  process.exit(1);
}

if (!fs.existsSync(OUTPUT_PATH)) {
  fs.writeFileSync(OUTPUT_PATH, "[]");
}

// LOAD PARAMETERS
const parameters = JSON.parse(fs.readFileSync(PARAMS_PATH, "utf8"));

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------
function normalize(values) {
  return Array.isArray(values) && values.length ? values : [null];
}

function normalizeGrades(grades) {
  if (!Array.isArray(grades)) return [null];
  const filtered = grades.filter(g => /\d/.test(g));
  return filtered.length ? filtered : [null];
}

function combinations(attrs) {
  const keys = Object.keys(attrs);
  const results = [];

  function build(i, obj) {
    if (i === keys.length) {
      results.push(obj);
      return;
    }
    for (const v of attrs[keys[i]]) {
      build(i + 1, { ...obj, [keys[i]]: v });
    }
  }

  build(0, {});
  return results;
}

// -------------------------------------------------------------
// MAIN GENERATION
// -------------------------------------------------------------
const skuList = [];
let errorCount = 0;

parameters.categories.forEach(category => {
  category.subcategories.forEach(sub => {
    const attrs = sub.attributes || {};
    let comboAttrs = null;

    // BOLTS / CAP SCREWS
    if (category.id === "bolts") {
      comboAttrs = {
        diameter: normalize(attrs.diameter),
        length: normalize(attrs.length),
        finish: normalize(attrs.finish),
        thread: normalize(attrs.thread),
        grade: normalizeGrades(attrs.grade),
        drive_type: normalize(attrs.drive_type)
      };
    }

    // MACHINE SCREWS
    else if (category.id === "machine-screws") {
      comboAttrs = {
        diameter: normalize(attrs.diameter),
        length: normalize(attrs.length),
        finish: normalize(attrs.finish),
        drive_type: normalize(attrs.drive_type)
      };
    }

    // SHEET METAL SCREWS
    else if (category.id === "sheet-metal-screws") {
      comboAttrs = {
        diameter: normalize(attrs.diameter),
        length: normalize(attrs.length),
        finish: normalize(attrs.finish),
        drive_type: normalize(attrs.drive_type)
      };
    }

    // WASHERS
    else if (category.id === "washers") {
      comboAttrs = {
        diameter: normalize(attrs.diameter),
        finish: normalize(attrs.finish)
      };
    }

    // NUTS
    else if (category.id === "nuts") {
      comboAttrs = {
        diameter: normalize(attrs.diameter),
        thread: normalize(attrs.thread),
        finish: normalize(attrs.finish)
      };
    }

    if (!comboAttrs) return;

    combinations(comboAttrs).forEach(combo => {
      try {
        const partNumber = generatePartNumber({
          category: sub.name,
          diameter: combo.diameter,
          length: combo.length,
          finish: combo.finish,
          thread: combo.thread,
          grade: combo.grade,
          drive: combo.drive_type
        });

        skuList.push({
          partNumber,
          category: category.id,
          subcategory: sub.id,
          attributes: combo
        });
      } catch (err) {
        // Log first few errors only (prevents spam)
        if (errorCount < 5) {
          console.warn("⚠️ SKU skipped:", sub.name, combo, err.message);
        }
        errorCount++;
      }
    });
  });
});

// WRITE OUTPUT
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(skuList, null, 2));

console.log("✅ SKU GENERATION COMPLETE");
console.log(`📦 Total SKUs Generated: ${skuList.length}`);
console.log(`⚠️ Skipped combinations: ${errorCount}`);
console.log(`📄 Output File: ${OUTPUT_PATH}`);

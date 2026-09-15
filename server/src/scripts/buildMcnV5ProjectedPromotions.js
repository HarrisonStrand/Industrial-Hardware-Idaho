// server/src/scripts/buildMcnV5ProjectedPromotions.js
//
// MCN v5 conservative projection pass.
//
// Input:
//   tmp/manufacturer-matching-mcn-review-v4.csv
//
// High-confidence rules:
//   1. Century Spring C-### catalog family
//   2. CGW explicit five-digit #catalog number in description
//   3. Vega candidate explicitly repeated as #catalog number in description
//   4. Verified current DeWalt/Powers Dropin / setting tool catalog numbers
//   5. Verified current DeWalt DWA5491 / DWA5492 Accu-Bit numbers
//
// Outputs:
//   tmp/IHI_MCN_v5_projected_promotions.csv
//   tmp/IHI_MCN_v5_remaining_review.csv
//   tmp/IHI_MCN_v5_vendor_warnings.csv
//   tmp/IHI_MCN_v5_summary.json

import fs from "fs";
import path from "path";

const INPUT_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "manufacturer-matching-mcn-review-v4.csv"
);

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "tmp"
);

const PROMOTIONS_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v5_projected_promotions.csv"
);

const REMAINING_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v5_remaining_review.csv"
);

const WARNINGS_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v5_vendor_warnings.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v5_summary.json"
);

function clean(value = "") {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value = "") {
  return clean(value).toUpperCase();
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function parseCsv(text) {
  const rows = [];

  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }

      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);

      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((row) =>
    row.some((value) => clean(value) !== "")
  );
}

function rowsToObjects(parsed) {
  if (!parsed.length) {
    return {
      headers: [],
      rows: [],
    };
  }

  const headers = parsed[0].map(clean);

  const rows = parsed.slice(1).map((values) => {
    const obj = {};

    for (let i = 0; i < headers.length; i += 1) {
      obj[headers[i]] = values[i] ?? "";
    }

    return obj;
  });

  return {
    headers,
    rows,
  };
}

function writeCsv(filePath, headers, rows) {
  const lines = [
    headers.map(csvEscape).join(","),

    ...rows.map((row) =>
      headers
        .map((header) => csvEscape(row[header] ?? ""))
        .join(",")
    ),
  ];

  fs.writeFileSync(
    filePath,
    `${lines.join("\n")}\n`,
    "utf8"
  );
}

function extractHashTokens(description = "") {
  const matches = [];

  const regex =
    /#\s*([A-Z0-9][A-Z0-9._/-]*)/gi;

  let match;

  while (
    (match = regex.exec(description)) !== null
  ) {
    matches.push(clean(match[1]));
  }

  return matches;
}

function getSingleFiveDigitHash(description = "") {
  const tokens = extractHashTokens(description);

  if (tokens.length !== 1) {
    return "";
  }

  if (!/^\d{5}$/.test(tokens[0])) {
    return "";
  }

  return tokens[0];
}

function candidateMatchesDescriptionHash(row) {
  const candidate = clean(
    row["MCN Candidate"]
  );

  if (!candidate) {
    return false;
  }

  const hashes = extractHashTokens(
    row["IHI Description"]
  );

  if (hashes.length !== 1) {
    return false;
  }

  return (
    normalized(candidate) ===
    normalized(hashes[0])
  );
}

function makePromotion({
  row,
  projectedMcn,
  status,
  manufacturer,
  rule,
  evidence,
}) {
  return {
    "Internal ID":
      clean(row["Internal ID"]),

    "IHI Part Number":
      clean(row["IHI Part Number"]),

    "Projected MCN":
      clean(projectedMcn),

    "Projected MCN Match Status":
      clean(status),

    "Manufacturer Match Hint":
      clean(manufacturer),

    "MCN Rule":
      clean(rule),

    "IHI Description":
      clean(row["IHI Description"]),

    "Prior MCN Match Status":
      clean(row["MCN Match Status"]),

    "Prior MCN Candidate":
      clean(row["MCN Candidate"]),

    "Vendor / Manufacturer":
      clean(row["Vendor / Manufacturer"]),

    Category:
      clean(row["Category"]),

    Subcategory:
      clean(row["Subcategory"]),

    "V5 Evidence":
      clean(evidence),
  };
}

/*
 * Current verified DeWalt / Powers catalog numbers
 * represented in the IHI review population.
 *
 * These are deliberately whitelisted rather than
 * blindly turning every DI number into ####-PWR.
 */
const DEWALT_DROPIN_POWERS_NUMBERS =
  new Set([
    // Type 304 stainless Dropin
    "06204",
    "06206",
    "06208",
    "06210",

    // Carbon steel Dropin
    "06304",
    "06306",
    "06308",
    "06312",
    "06320",

    // Standard Dropin setting tools
    "06305",
    "06307",
    "06309",
    "06311",
    "06313",

    // Mini Dropin
    "06322",
    "06335",

    // Mini Dropin setting tools
    "06323",
    "06336",
  ]);

const DEWALT_ACCU_BITS =
  new Set([
    "DWA5491",
    "DWA5492",
  ]);

function projectRow(row) {
  const vendor = clean(
    row["Vendor / Manufacturer"]
  );

  const partNumber = clean(
    row["IHI Part Number"]
  );

  const description = clean(
    row["IHI Description"]
  );

  /*
   * ============================================================
   * CENTURY SPRING
   * ============================================================
   *
   * C-### is an established Century Spring manufacturer
   * part-number family.
   *
   * Examples in the dataset:
   *
   * C-1
   * C-13
   * C-25
   * C-105
   * ...
   */
  if (
    vendor === "Century Spring Corp." &&
    /^C-\d+$/i.test(partNumber)
  ) {
    return makePromotion({
      row,

      projectedMcn:
        partNumber,

      status:
        "verified-manufacturer-family",

      manufacturer:
        "Century Spring Corp.",

      rule:
        "century-spring-c-series",

      evidence:
        "Century Spring C-### manufacturer catalog family; IHI part number already equals the manufacturer part number.",
    });
  }

  /*
   * ============================================================
   * CGW
   * ============================================================
   *
   * Only promote when the IHI description contains exactly
   * one explicit five-digit #catalog number.
   *
   * Examples:
   *
   * CUT-OFF WHEEL ... #45052
   * CUT-OFF WHEEL ... #35502
   * FLAP DISC ... #42103
   * SHOP ROLL ... #63072
   *
   * This deliberately allows the description catalog number
   * to override an older secondary candidate when the two
   * disagree.
   */
  if (vendor === "CGW") {
    const descriptionCatalogNumber =
      getSingleFiveDigitHash(description);

    if (descriptionCatalogNumber) {
      return makePromotion({
        row,

        projectedMcn:
          descriptionCatalogNumber,

        status:
          "verified-description-catalog-number",

        manufacturer:
          "CGW",

        rule:
          "cgw-description-five-digit-catalog-number",

        evidence:
          `Explicit CGW five-digit catalog number #${descriptionCatalogNumber} appears in IHI description.`,
      });
    }
  }

  /*
   * ============================================================
   * VEGA
   * ============================================================
   *
   * Promote only where the secondary MCN candidate is repeated
   * explicitly as a #catalog number in the description.
   *
   * Examples:
   *
   * BIT012 1300MH1QS
   * description ... #1300MH1QS
   *
   * BIT014 1KCA1
   * description ... #1KCA1
   */
  if (
    vendor === "Vega" &&
    candidateMatchesDescriptionHash(row)
  ) {
    const candidate = clean(
      row["MCN Candidate"]
    );

    return makePromotion({
      row,

      projectedMcn:
        candidate,

      status:
        "verified-description-catalog-number",

      manufacturer:
        "Vega",

      rule:
        "vega-description-catalog-number",

      evidence:
        `MCN candidate ${candidate} is explicitly repeated as #${candidate} in the IHI description.`,
    });
  }

  /*
   * ============================================================
   * DEWALT / POWERS — DROPIN
   * ============================================================
   *
   * Fishbowl examples:
   *
   * DI 06304
   * DI 06305
   * DI 06306
   *
   * Current manufacturer numbers:
   *
   * 06304-PWR
   * 06305-PWR
   * 06306-PWR
   *
   * Only catalog numbers in the explicit whitelist above
   * are promoted.
   */
  if (
    vendor === "DeWalt/Powers"
  ) {
    const dropinMatch =
      partNumber.match(
        /^DI\s+(\d{5})$/i
      );

    if (dropinMatch) {
      const baseNumber =
        dropinMatch[1];

      if (
        DEWALT_DROPIN_POWERS_NUMBERS.has(
          baseNumber
        )
      ) {
        const projected =
          `${baseNumber}-PWR`;

        return makePromotion({
          row,

          projectedMcn:
            projected,

          status:
            "verified-current-manufacturer-number",

          manufacturer:
            "DeWalt/Powers",

          rule:
            "dewalt-powers-current-dropin-catalog",

          evidence:
            `Current DeWalt/Powers Dropin catalog number verified as ${projected}.`,
        });
      }
    }

    /*
     * Current DEWALT Accu-Bit numbers do NOT receive
     * the -PWR suffix.
     */
    const accuBitMatch =
      partNumber.match(
        /^DI\s+(DWA549[12])$/i
      );

    if (accuBitMatch) {
      const projected =
        accuBitMatch[1].toUpperCase();

      if (
        DEWALT_ACCU_BITS.has(
          projected
        )
      ) {
        return makePromotion({
          row,

          projectedMcn:
            projected,

          status:
            "verified-current-manufacturer-number",

          manufacturer:
            "DeWalt/Powers",

          rule:
            "dewalt-current-accubit-catalog",

          evidence:
            `Current DEWALT Accu-Bit catalog number verified as ${projected}.`,
        });
      }
    }
  }

  return null;
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(
      `Input review file not found:\n${INPUT_PATH}`
    );
  }

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    }
  );

  const parsed = rowsToObjects(
    parseCsv(
      fs.readFileSync(
        INPUT_PATH,
        "utf8"
      )
    )
  );

  if (!parsed.rows.length) {
    throw new Error(
      "Input review CSV contains no data rows."
    );
  }

  const requiredHeaders = [
    "Internal ID",
    "IHI Part Number",
    "MCN Candidate",
    "MCN Match Status",
    "IHI Description",
    "Vendor / Manufacturer",
    "Category",
    "Subcategory",
  ];

  const missing =
    requiredHeaders.filter(
      (header) =>
        !parsed.headers.includes(header)
    );

  if (missing.length) {
    throw new Error(
      `Missing required columns: ${missing.join(", ")}`
    );
  }

  const promotions = [];
  const remaining = [];
  const warnings = [];

  const promotedInternalIds =
    new Set();

  for (const row of parsed.rows) {
    const projection =
      projectRow(row);

    if (projection) {
      const internalId =
        clean(
          projection["Internal ID"]
        );

      if (
        internalId &&
        promotedInternalIds.has(
          internalId
        )
      ) {
        throw new Error(
          `Duplicate v5 projection for Internal ID ${internalId}`
        );
      }

      if (internalId) {
        promotedInternalIds.add(
          internalId
        );
      }

      promotions.push(
        projection
      );

      continue;
    }

    remaining.push(row);

    /*
     * ----------------------------------------------------------
     * WRIGHT TOOLS VENDOR WARNING
     * ----------------------------------------------------------
     *
     * The remaining Wright Tools bucket contains numerous
     * descriptions explicitly identifying PROFERRED products.
     *
     * Do NOT promote MCNs from this group until vendor assignment
     * has been reviewed.
     */
    if (
      clean(
        row[
          "Vendor / Manufacturer"
        ]
      ) === "Wright Tools"
    ) {
      const description =
        clean(
          row[
            "IHI Description"
          ]
        );

      const explicitlyProferred =
        /PROFER+ED/i.test(
          description
        );

      warnings.push({
        "Internal ID":
          clean(
            row["Internal ID"]
          ),

        "IHI Part Number":
          clean(
            row[
              "IHI Part Number"
            ]
          ),

        "Current Vendor":
          "Wright Tools",

        "IHI Description":
          description,

        "MCN Match Status":
          clean(
            row[
              "MCN Match Status"
            ]
          ),

        "MCN Candidate":
          clean(
            row[
              "MCN Candidate"
            ]
          ),

        "Warning Type":
          explicitlyProferred
            ? "EXPLICIT-PROFERRED-DESCRIPTION"
            : "WRIGHT-VENDOR-NEEDS-REVIEW",

        Notes:
          explicitlyProferred
            ? "Description explicitly identifies Proferred; do not treat this row as Wright Tool without vendor correction."
            : "Remaining Wright Tools assignment should be verified before MCN promotion.",
      });
    }
  }

  /*
   * ------------------------------------------------------------
   * PROMOTION OUTPUT
   * ------------------------------------------------------------
   */

  const promotionHeaders = [
    "Internal ID",
    "IHI Part Number",
    "Projected MCN",
    "Projected MCN Match Status",
    "Manufacturer Match Hint",
    "MCN Rule",
    "IHI Description",
    "Prior MCN Match Status",
    "Prior MCN Candidate",
    "Vendor / Manufacturer",
    "Category",
    "Subcategory",
    "V5 Evidence",
  ];

  writeCsv(
    PROMOTIONS_PATH,
    promotionHeaders,
    promotions
  );

  /*
   * Keep original review-file schema for the remaining rows.
   */
  writeCsv(
    REMAINING_PATH,
    parsed.headers,
    remaining
  );

  const warningHeaders = [
    "Internal ID",
    "IHI Part Number",
    "Current Vendor",
    "IHI Description",
    "MCN Match Status",
    "MCN Candidate",
    "Warning Type",
    "Notes",
  ];

  writeCsv(
    WARNINGS_PATH,
    warningHeaders,
    warnings
  );

  /*
   * ------------------------------------------------------------
   * SUMMARY
   * ------------------------------------------------------------
   */

  const byManufacturer =
    {};

  const byRule =
    {};

  for (const row of promotions) {
    const manufacturer =
      clean(
        row[
          "Manufacturer Match Hint"
        ]
      ) || "(blank)";

    const rule =
      clean(
        row["MCN Rule"]
      ) || "(blank)";

    byManufacturer[
      manufacturer
    ] =
      (
        byManufacturer[
          manufacturer
        ] || 0
      ) + 1;

    byRule[rule] =
      (
        byRule[rule] || 0
      ) + 1;
  }

  const explicitProferredWarnings =
    warnings.filter(
      (row) =>
        row[
          "Warning Type"
        ] ===
        "EXPLICIT-PROFERRED-DESCRIPTION"
    ).length;

  const summary = {
    version:
      "MCN-v5-projection",

    inputRows:
      parsed.rows.length,

    projectedPromotions:
      promotions.length,

    remainingReviewRows:
      remaining.length,

    vendorWarningRows:
      warnings.length,

    explicitProferredWarnings,

    byManufacturer,

    byRule,

    outputs: {
      promotions:
        PROMOTIONS_PATH,

      remainingReview:
        REMAINING_PATH,

      vendorWarnings:
        WARNINGS_PATH,
    },
  };

  fs.writeFileSync(
    SUMMARY_PATH,
    `${JSON.stringify(
      summary,
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log("");
  console.log(
    "===== MCN V5 PROJECTED PROMOTIONS ====="
  );

  console.log(
    `Input review rows:       ${summary.inputRows}`
  );

  console.log(
    `✅ Projected promotions: ${summary.projectedPromotions}`
  );

  console.log(
    `🔎 Remaining review:     ${summary.remainingReviewRows}`
  );

  console.log(
    `⚠️ Vendor warnings:      ${summary.vendorWarningRows}`
  );

  console.log(
    `⚠️ Explicit Proferred:   ${summary.explicitProferredWarnings}`
  );

  console.log("");
  console.log(
    "Projected by manufacturer:"
  );

  console.table(
    byManufacturer
  );

  console.log("");
  console.log(
    "Projected by rule:"
  );

  console.table(
    byRule
  );

  console.log("");
  console.log("Outputs:");

  console.log(
    `Promotions: ${PROMOTIONS_PATH}`
  );

  console.log(
    `Remaining:  ${REMAINING_PATH}`
  );

  console.log(
    `Warnings:   ${WARNINGS_PATH}`
  );

  console.log(
    `Summary:    ${SUMMARY_PATH}`
  );
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v5 projection failed:",
    err
  );

  process.exit(1);
}
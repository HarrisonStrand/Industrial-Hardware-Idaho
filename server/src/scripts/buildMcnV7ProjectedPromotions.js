// server/src/scripts/buildMcnV7ProjectedPromotions.js
//
// MCN v7 conservative projection pass.
//
// Current verified families:
//
//   Hillsdale Terminal
//     - 49 exact manufacturer catalog numbers verified against
//       Hillsdale's published catalog / data sheets.
//
//   Hindley
//     - 4 exact catalog numbers verified against Hindley's
//       published wire hardware catalog.
//
// Input:
//   tmp/manufacturer-matching-mcn-review-v4.csv
//
// Outputs:
//   tmp/IHI_MCN_v7_projected_promotions.csv
//   tmp/IHI_MCN_v7_remaining_review.csv
//   tmp/IHI_MCN_v7_summary.json
//
// Expected checkpoint:
//   Input review rows: 17703
//   Projected:          53
//   Remaining:          17650

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
  "IHI_MCN_v7_projected_promotions.csv"
);

const REMAINING_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v7_remaining_review.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v7_summary.json"
);

function clean(value = "") {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value = "") {
  return clean(value).toUpperCase();
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

function csvEscape(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
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

/*
 * =============================================================================
 * HILLSDALE TERMINAL
 * =============================================================================
 *
 * Exact manufacturer part numbers verified against Hillsdale's
 * published catalog/data sheets.
 *
 * We deliberately use an explicit whitelist rather than attempting
 * to infer a generic numeric pattern.
 *
 * This prevents unrelated electrical SKUs in the broader
 * "Greenlite / Hillsdale" vendor bucket from being promoted.
 */

const HILLSDALE_VERIFIED_CATALOG_NUMBERS = new Set([
  "10041HT",
  "10052",

  "10100",
  "10100HT",
  "10101",
  "10102",
  "10103",

  "10141-00",
  "10170",

  "10230",
  "10240",
  "10250",
  "10260",

  "10310",
  "10381-00",

  "10501-00",
  "10561-00",

  "10610",
  "10610HT",
  "10611",
  "10612",
  "10613",
  "10613HT",
  "10618",
  "10618HT",
  "10619",
  "10630",
  "10631",

  "1503-00",
  "1561-00",

  "20381-00",
  "20501-00",
  "20561-00",

  "2141-00",
  "2381-00",
  "2503-00",
  "2561-00",

  "30381-00",
  "30501-00",

  "40381-00",
  "40501-00",

  "4141-00",
  "4382-00",
  "4562-00",

  "50050N",

  "6101-00",
  "6141-00",
  "6382-00",
  "6562-00",
]);

/*
 * =============================================================================
 * HINDLEY
 * =============================================================================
 *
 * Exact manufacturer numbers verified against Hindley's catalog.
 *
 * Catalog examples:
 *
 *   11101 = 1/4 x 3-3/4 lag eye bolt
 *   11104 = 5/16 x 4 lag eye bolt
 *   11095 = 3/8 x 6 lag eye bolt
 *   14322 = 3/8 x 4 stainless eye bolt
 *
 * We match the exact IHI row AND validate the product description.
 */

const HINDLEY_VERIFIED_ROWS = new Map([
  [
    "EYBL020 11101",
    {
      mcn: "11101",
      expectedPriorStatus: "possible-secondary-token",
      expectedPriorCandidate: "11101",
      descriptionPattern:
        /EYE LAG.*1\/4X3-3\/4/i,
    },
  ],

  [
    "EYBL040 11104",
    {
      mcn: "11104",
      expectedPriorStatus: "possible-secondary-token",
      expectedPriorCandidate: "11104",
      descriptionPattern:
        /EYE LAG.*5\/16X4/i,
    },
  ],

  [
    "EYBL080 11095",
    {
      mcn: "11095",
      expectedPriorStatus: "possible-secondary-token",
      expectedPriorCandidate: "11095",
      descriptionPattern:
        /EYE LAG.*3\/8X6/i,
    },
  ],

  [
    "SSEYB 14322",
    {
      mcn: "14322",
      expectedPriorStatus: "needs-review",
      expectedPriorCandidate: "",
      descriptionPattern:
        /S\/S EYE BOLT.*3\/8X4/i,
    },
  ],
]);

function makePromotion({
  row,
  projectedMcn,
  status,
  manufacturer,
  rule,
  evidenceType,
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

    "V7 Evidence Type":
      clean(evidenceType),

    "V7 Evidence":
      clean(evidence),
  };
}

function projectHillsdale(row) {
  const vendor =
    clean(
      row["Vendor / Manufacturer"]
    );

  if (
    vendor !==
    "Greenlite / Hillsdale"
  ) {
    return null;
  }

  const partNumber =
    clean(
      row["IHI Part Number"]
    );

  const priorStatus =
    clean(
      row["MCN Match Status"]
    );

  const priorCandidate =
    clean(
      row["MCN Candidate"]
    );

  /*
   * The current 49-row verified set all originate as
   * unverified-clean-candidate rows.
   *
   * Requiring this prevents the rule from unexpectedly
   * consuming a differently classified row later.
   */
  if (
    priorStatus !==
    "unverified-clean-candidate"
  ) {
    return null;
  }

  if (
    !HILLSDALE_VERIFIED_CATALOG_NUMBERS.has(
      normalized(partNumber)
    )
  ) {
    return null;
  }

  /*
   * Existing clean candidate should already equal
   * the IHI part number.
   */
  if (
    normalized(priorCandidate) !==
    normalized(partNumber)
  ) {
    return null;
  }

  return makePromotion({
    row,

    projectedMcn:
      partNumber,

    status:
      "verified-current-manufacturer-number",

    manufacturer:
      "Hillsdale Terminal",

    rule:
      "hillsdale-published-catalog-whitelist",

    evidenceType:
      "exact-published-manufacturer-number",

    evidence:
      `Exact Hillsdale Terminal manufacturer catalog number ${partNumber} verified against published Hillsdale catalog/data sheets.`,
  });
}

function projectHindley(row) {
  const vendor =
    clean(
      row["Vendor / Manufacturer"]
    );

  if (
    vendor !== "Hindley"
  ) {
    return null;
  }

  const partNumber =
    clean(
      row["IHI Part Number"]
    );

  const definition =
    HINDLEY_VERIFIED_ROWS.get(
      normalized(partNumber)
    );

  if (!definition) {
    return null;
  }

  const priorStatus =
    clean(
      row["MCN Match Status"]
    );

  const priorCandidate =
    clean(
      row["MCN Candidate"]
    );

  const description =
    clean(
      row["IHI Description"]
    );

  if (
    priorStatus !==
    definition.expectedPriorStatus
  ) {
    return null;
  }

  if (
    normalized(priorCandidate) !==
    normalized(
      definition.expectedPriorCandidate
    )
  ) {
    return null;
  }

  if (
    !definition.descriptionPattern.test(
      description
    )
  ) {
    return null;
  }

  return makePromotion({
    row,

    projectedMcn:
      definition.mcn,

    status:
      "verified-secondary-token",

    manufacturer:
      "Hindley",

    rule:
      "hindley-published-catalog-whitelist",

    evidenceType:
      "exact-published-manufacturer-number",

    evidence:
      `Hindley manufacturer catalog number ${definition.mcn} verified against published Hindley catalog and matching IHI product dimensions.`,
  });
}

function projectRow(row) {
  return (
    projectHillsdale(row) ||
    projectHindley(row) ||
    null
  );
}

function countBy(rows, field) {
  const counts = {};

  for (const row of rows) {
    const value =
      clean(row[field]) ||
      "(blank)";

    counts[value] =
      (
        counts[value] ||
        0
      ) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts).sort(
      (a, b) =>
        b[1] -
          a[1] ||
        a[0].localeCompare(
          b[0]
        )
    )
  );
}

function main() {
  if (
    !fs.existsSync(
      INPUT_PATH
    )
  ) {
    throw new Error(
      `Current MCN review file not found:\n${INPUT_PATH}`
    );
  }

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    }
  );

  const parsed =
    rowsToObjects(
      parseCsv(
        fs.readFileSync(
          INPUT_PATH,
          "utf8"
        )
      )
    );

  if (
    !parsed.rows.length
  ) {
    throw new Error(
      "Current MCN review file contains no data rows."
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

  const missingHeaders =
    requiredHeaders.filter(
      (header) =>
        !parsed.headers.includes(
          header
        )
    );

  if (
    missingHeaders.length
  ) {
    throw new Error(
      `Missing required columns: ${missingHeaders.join(", ")}`
    );
  }

  const promotions = [];
  const remaining = [];

  const usedInternalIds =
    new Set();

  const usedPartNumbers =
    new Set();

  for (
    const row
    of parsed.rows
  ) {
    const projection =
      projectRow(row);

    if (!projection) {
      remaining.push(row);
      continue;
    }

    const internalId =
      normalized(
        projection["Internal ID"]
      );

    const partNumber =
      normalized(
        projection[
          "IHI Part Number"
        ]
      );

    if (
      internalId &&
      usedInternalIds.has(
        internalId
      )
    ) {
      throw new Error(
        `Duplicate v7 Internal ID projection: ${internalId}`
      );
    }

    if (
      partNumber &&
      usedPartNumbers.has(
        partNumber
      )
    ) {
      throw new Error(
        `Duplicate v7 IHI Part Number projection: ${partNumber}`
      );
    }

    if (internalId) {
      usedInternalIds.add(
        internalId
      );
    }

    if (partNumber) {
      usedPartNumbers.add(
        partNumber
      );
    }

    promotions.push(
      projection
    );
  }

  /*
   * --------------------------------------------------------------------------
   * OUTPUT PROMOTIONS
   * --------------------------------------------------------------------------
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
    "V7 Evidence Type",
    "V7 Evidence",
  ];

  writeCsv(
    PROMOTIONS_PATH,
    promotionHeaders,
    promotions
  );

  /*
   * Preserve the exact schema of the current review file
   * for rows not selected by v7.
   */
  writeCsv(
    REMAINING_PATH,
    parsed.headers,
    remaining
  );

  /*
   * --------------------------------------------------------------------------
   * SUMMARY
   * --------------------------------------------------------------------------
   */

  const summary = {
    version:
      "MCN-v7-exact-catalog-projection",

    inputReviewRows:
      parsed.rows.length,

    projectedPromotions:
      promotions.length,

    remainingReviewRows:
      remaining.length,

    byManufacturer:
      countBy(
        promotions,
        "Manufacturer Match Hint"
      ),

    byPriorStatus:
      countBy(
        promotions,
        "Prior MCN Match Status"
      ),

    byRule:
      countBy(
        promotions,
        "MCN Rule"
      ),

    byEvidence:
      countBy(
        promotions,
        "V7 Evidence Type"
      ),

    outputs: {
      projectedPromotions:
        PROMOTIONS_PATH,

      remainingReview:
        REMAINING_PATH,
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

  /*
   * --------------------------------------------------------------------------
   * TERMINAL OUTPUT
   * --------------------------------------------------------------------------
   */

  console.log("");
  console.log(
    "===== MCN V7 EXACT CATALOG PROJECTED PROMOTIONS ====="
  );

  console.log(
    `Input review rows:       ${summary.inputReviewRows}`
  );

  console.log(
    `✅ Projected promotions: ${summary.projectedPromotions}`
  );

  console.log(
    `🔎 Remaining review:     ${summary.remainingReviewRows}`
  );

  console.log("");

  console.log(
    "Projected by manufacturer:"
  );

  console.table(
    summary.byManufacturer
  );

  console.log("");

  console.log(
    "Projected by prior status:"
  );

  console.table(
    summary.byPriorStatus
  );

  console.log("");

  console.log(
    "Projected by rule:"
  );

  console.table(
    summary.byRule
  );

  console.log("");

  console.log(
    `Promotions: ${PROMOTIONS_PATH}`
  );

  console.log(
    `Remaining:  ${REMAINING_PATH}`
  );

  console.log(
    `Summary:    ${SUMMARY_PATH}`
  );

  console.log("");

  if (
    summary.inputReviewRows === 17703 &&
    summary.projectedPromotions === 53 &&
    summary.remainingReviewRows === 17650 &&
    summary.byManufacturer[
      "Hillsdale Terminal"
    ] === 49 &&
    summary.byManufacturer[
      "Hindley"
    ] === 4
  ) {
    console.log(
      "✅ V7 projection matches the expected post-v6 checkpoint."
    );

    console.log(
      "✅ 49 Hillsdale + 4 Hindley exact catalog matches projected."
    );
  } else {
    console.log(
      "ℹ️ V7 counts differ from the expected checkpoint."
    );

    console.log(
      "   Do not merge anything yet; review the output first."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v7 projection failed:",
    err
  );

  process.exit(1);
}
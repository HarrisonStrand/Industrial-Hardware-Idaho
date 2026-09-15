// server/src/scripts/buildMcnV8ProjectedPromotions.js
//
// MCN v8 conservative projection pass.
//
// Current focus:
//   Century Spring retail C-series
//
// Verified internal pattern:
//
//   IHI Part Number:
//     SPR01300
//
//   IHI Description:
//     SPRING #13
//
//   Manufacturer MCN:
//     C-13
//
// Only NUMERIC Century Spring C-series rows are included.
//
// Examples:
//   SPR00100 -> SPRING #1   -> C-1
//   SPR01300 -> SPRING #13  -> C-13
//   SPR30500 -> SPRING #305 -> C-305
//   SPR61200 -> SPRING #612 -> C-612
//   SPR68000 -> SPRING #680 -> C-680
//
// Deliberately excluded for now:
//   SPR15110 -> SPRING #151A
//   SPR15130 -> SPRING #151C
//
// because the A/C suffix families need separate verification.
//
// Input:
//   tmp/manufacturer-matching-mcn-review-v4.csv
//
// Outputs:
//   tmp/IHI_MCN_v8_projected_promotions.csv
//   tmp/IHI_MCN_v8_remaining_review.csv
//   tmp/IHI_MCN_v8_summary.json
//
// Expected checkpoint:
//   Input review rows: 17650
//   Projected:          121
//   Remaining:          17529

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
  "IHI_MCN_v8_projected_promotions.csv"
);

const REMAINING_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v8_remaining_review.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v8_summary.json"
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

  const headers =
    parsed[0].map(clean);

  const rows =
    parsed.slice(1).map((values) => {
      const obj = {};

      for (
        let i = 0;
        i < headers.length;
        i += 1
      ) {
        obj[headers[i]] =
          values[i] ?? "";
      }

      return obj;
    });

  return {
    headers,
    rows,
  };
}

function csvEscape(value) {
  const text =
    String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function writeCsv(
  filePath,
  headers,
  rows
) {
  const lines = [
    headers
      .map(csvEscape)
      .join(","),

    ...rows.map((row) =>
      headers
        .map(
          (header) =>
            csvEscape(
              row[header] ?? ""
            )
        )
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
 * Extract an exact NUMERIC Century retail spring number.
 *
 * Accepted:
 *
 *   SPRING #1
 *   SPRING # 13
 *   SPRING #305
 *   SPRING # 680
 *
 * Rejected:
 *
 *   SPRING #151A
 *   SPRING #151C
 *
 * Those suffix families are intentionally deferred.
 */
function extractNumericSpringNumber(description = "") {
  const value =
    clean(description);

  const match =
    value.match(
      /^SPRING\s*#\s*(\d+)$/i
    );

  if (!match) {
    return "";
  }

  return String(
    Number(match[1])
  );
}

/*
 * Decode IHI's SPRxxxxx internal part-number structure.
 *
 * Numeric retail series use:
 *
 *   SPR00100 -> 1
 *   SPR01300 -> 13
 *   SPR30500 -> 305
 *   SPR68000 -> 680
 *
 * The final "00" acts as part of IHI's internal encoding
 * and is not part of the manufacturer catalog number.
 *
 * A/C variants use different endings, such as:
 *
 *   SPR15110
 *   SPR15130
 *
 * Those will NOT match this function.
 */
function decodeNumericSprPartNumber(partNumber = "") {
  const value =
    normalized(partNumber);

  const match =
    value.match(
      /^SPR(\d{3})00$/
    );

  if (!match) {
    return "";
  }

  return String(
    Number(match[1])
  );
}

function makePromotion(
  row,
  springNumber
) {
  const projectedMcn =
    `C-${springNumber}`;

  return {
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

    "Projected MCN":
      projectedMcn,

    "Projected MCN Match Status":
      "verified-manufacturer-family",

    "Manufacturer Match Hint":
      "Century Spring Corp.",

    "MCN Rule":
      "century-spring-retail-c-series",

    "IHI Description":
      clean(
        row[
          "IHI Description"
        ]
      ),

    "Prior MCN Match Status":
      clean(
        row[
          "MCN Match Status"
        ]
      ),

    "Prior MCN Candidate":
      clean(
        row[
          "MCN Candidate"
        ]
      ),

    "Vendor / Manufacturer":
      clean(
        row[
          "Vendor / Manufacturer"
        ]
      ),

    Category:
      clean(
        row["Category"]
      ),

    Subcategory:
      clean(
        row["Subcategory"]
      ),

    "V8 Century Number":
      springNumber,

    "V8 Evidence Type":
      "ihi-encoding-plus-explicit-century-spring-number",

    "V8 Evidence":
      `IHI part number encodes spring ${springNumber}; description explicitly says SPRING #${springNumber}; Century Spring retail manufacturer number is C-${springNumber}.`,
  };
}

function projectRow(row) {
  const vendor =
    clean(
      row[
        "Vendor / Manufacturer"
      ]
    );

  if (
    vendor !==
    "Century Spring Corp."
  ) {
    return null;
  }

  const priorStatus =
    clean(
      row[
        "MCN Match Status"
      ]
    );

  /*
   * Current 121-row family should still be sitting
   * in unverified-clean-candidate.
   */
  if (
    priorStatus !==
    "unverified-clean-candidate"
  ) {
    return null;
  }

  const partNumber =
    clean(
      row[
        "IHI Part Number"
      ]
    );

  const description =
    clean(
      row[
        "IHI Description"
      ]
    );

  const priorCandidate =
    clean(
      row[
        "MCN Candidate"
      ]
    );

  const partSpringNumber =
    decodeNumericSprPartNumber(
      partNumber
    );

  if (!partSpringNumber) {
    return null;
  }

  const descriptionSpringNumber =
    extractNumericSpringNumber(
      description
    );

  if (!descriptionSpringNumber) {
    return null;
  }

  /*
   * Require independent agreement between the
   * IHI encoded part number and the description.
   */
  if (
    partSpringNumber !==
    descriptionSpringNumber
  ) {
    return null;
  }

  /*
   * Because this was originally classified as an
   * unverified clean candidate, the old candidate
   * should still equal the exact IHI part number.
   */
  if (
    normalized(priorCandidate) !==
    normalized(partNumber)
  ) {
    return null;
  }

  return makePromotion(
    row,
    partSpringNumber
  );
}

function countBy(
  rows,
  field
) {
  const counts = {};

  for (const row of rows) {
    const value =
      clean(
        row[field]
      ) ||
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

  const usedIds =
    new Set();

  const usedParts =
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
        projection[
          "Internal ID"
        ]
      );

    const partNumber =
      normalized(
        projection[
          "IHI Part Number"
        ]
      );

    if (
      internalId &&
      usedIds.has(internalId)
    ) {
      throw new Error(
        `Duplicate v8 Internal ID projection: ${internalId}`
      );
    }

    if (
      partNumber &&
      usedParts.has(partNumber)
    ) {
      throw new Error(
        `Duplicate v8 IHI Part Number projection: ${partNumber}`
      );
    }

    if (internalId) {
      usedIds.add(
        internalId
      );
    }

    if (partNumber) {
      usedParts.add(
        partNumber
      );
    }

    promotions.push(
      projection
    );
  }

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
    "V8 Century Number",
    "V8 Evidence Type",
    "V8 Evidence",
  ];

  writeCsv(
    PROMOTIONS_PATH,
    promotionHeaders,
    promotions
  );

  writeCsv(
    REMAINING_PATH,
    parsed.headers,
    remaining
  );

  const summary = {
    version:
      "MCN-v8-century-retail-c-series",

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

  console.log("");
  console.log(
    "===== MCN V8 CENTURY SPRING PROJECTED PROMOTIONS ====="
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
    summary.inputReviewRows === 17650 &&
    summary.projectedPromotions === 121 &&
    summary.remainingReviewRows === 17529 &&
    summary.byManufacturer[
      "Century Spring Corp."
    ] === 121
  ) {
    console.log(
      "✅ V8 Century Spring projection matches the expected checkpoint."
    );

    console.log(
      "✅ 121 numeric C-series candidates projected."
    );

    console.log(
      "ℹ️ A/C suffix Century Spring rows remain intentionally unresolved."
    );
  } else {
    console.log(
      "ℹ️ V8 counts differ from the expected checkpoint."
    );

    console.log(
      "Do not merge anything yet; review the results first."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v8 projection failed:",
    err
  );

  process.exit(1);
}
// server/src/scripts/buildMcnV6ProjectedPromotions.js
//
// MCN v6 conservative projection pass.
//
// Current focus:
//   Hindley Manufacturing
//
// Rule:
//   When:
//     - Vendor / Manufacturer === "Hindley"
//     - IHI Description contains EXACTLY ONE five-digit #number
//     - Number is in Hindley's observed catalog range 10000–14999
//
//   Then:
//     Project that five-digit number as the MCN.
//
// Examples:
//   EYB10707
//   "EYE BOLT ZP 7/32X2-3/8 #10707"
//        -> MCN 10707
//
//   SE8SSE
//   'SCREW EYE S/S 1-5/8" #14374'
//        -> MCN 14374
//
//   UB14417SS
//   '... #14417'
//        -> MCN 14417
//
// Input:
//   tmp/manufacturer-matching-mcn-review-v4.csv
//
// Outputs:
//   tmp/IHI_MCN_v6_projected_promotions.csv
//   tmp/IHI_MCN_v6_remaining_review.csv
//   tmp/IHI_MCN_v6_summary.json

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
  "IHI_MCN_v6_projected_promotions.csv"
);

const REMAINING_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v6_remaining_review.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v6_summary.json"
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
 * Extract ONLY five-digit #numbers.
 *
 * This intentionally ignores things such as:
 *
 *   #6
 *   #8
 *   #10
 *
 * because those often represent screw size,
 * wire gauge, terminal size, etc.
 */
function extractFiveDigitHashNumbers(description = "") {
  const matches = [];

  const regex = /#\s*(\d{5})\b/g;

  let match;

  while (
    (match = regex.exec(description)) !== null
  ) {
    matches.push(match[1]);
  }

  return matches;
}

function getSingleHindleyCatalogNumber(description = "") {
  const matches =
    extractFiveDigitHashNumbers(description);

  /*
   * We require exactly one candidate.
   */
  if (matches.length !== 1) {
    return "";
  }

  const candidate = matches[0];

  /*
   * Hindley catalog numbers represented by this
   * IHI population fall within the 10xxx–14xxx
   * manufacturer number families.
   *
   * Keep the test explicit rather than allowing any
   * arbitrary five-digit value.
   */
  const numeric =
    Number(candidate);

  if (
    !Number.isInteger(numeric) ||
    numeric < 10000 ||
    numeric > 14999
  ) {
    return "";
  }

  return candidate;
}

function makePromotion(row, projectedMcn) {
  const partNumber =
    clean(
      row["IHI Part Number"]
    );

  const priorCandidate =
    clean(
      row["MCN Candidate"]
    );

  let evidenceType =
    "explicit-description-catalog-number";

  /*
   * Record additional supporting relationships
   * for auditing. These are NOT required in order
   * for the row to be promoted.
   */
  if (
    normalized(priorCandidate) ===
    normalized(projectedMcn)
  ) {
    evidenceType =
      "description-and-prior-candidate";
  } else if (
    normalized(partNumber).endsWith(
      normalized(projectedMcn)
    )
  ) {
    evidenceType =
      "description-and-ihi-suffix";
  }

  return {
    "Internal ID":
      clean(
        row["Internal ID"]
      ),

    "IHI Part Number":
      partNumber,

    "Projected MCN":
      projectedMcn,

    "Projected MCN Match Status":
      "verified-description-catalog-number",

    "Manufacturer Match Hint":
      "Hindley",

    "MCN Rule":
      "hindley-description-five-digit-catalog-number",

    "IHI Description":
      clean(
        row["IHI Description"]
      ),

    "Prior MCN Match Status":
      clean(
        row["MCN Match Status"]
      ),

    "Prior MCN Candidate":
      priorCandidate,

    "Vendor / Manufacturer":
      clean(
        row["Vendor / Manufacturer"]
      ),

    Category:
      clean(
        row["Category"]
      ),

    Subcategory:
      clean(
        row["Subcategory"]
      ),

    "V6 Evidence Type":
      evidenceType,

    "V6 Evidence":
      `IHI description explicitly identifies Hindley catalog #${projectedMcn}.`,
  };
}

function projectRow(row) {
  const vendor =
    clean(
      row["Vendor / Manufacturer"]
    );

  if (vendor !== "Hindley") {
    return null;
  }

  const description =
    clean(
      row["IHI Description"]
    );

  const catalogNumber =
    getSingleHindleyCatalogNumber(
      description
    );

  if (!catalogNumber) {
    return null;
  }

  return makePromotion(
    row,
    catalogNumber
  );
}

function countBy(rows, field) {
  const counts = {};

  for (const row of rows) {
    const value =
      clean(row[field]) ||
      "(blank)";

    counts[value] =
      (counts[value] || 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts).sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0].localeCompare(b[0])
    )
  );
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

  const parsed =
    rowsToObjects(
      parseCsv(
        fs.readFileSync(
          INPUT_PATH,
          "utf8"
        )
      )
    );

  if (!parsed.rows.length) {
    throw new Error(
      "Current MCN review file contains no rows."
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
        !parsed.headers.includes(header)
    );

  if (missingHeaders.length) {
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

  for (const row of parsed.rows) {
    const projection =
      projectRow(row);

    if (!projection) {
      remaining.push(row);
      continue;
    }

    const id =
      normalized(
        projection["Internal ID"]
      );

    const part =
      normalized(
        projection["IHI Part Number"]
      );

    if (
      id &&
      usedInternalIds.has(id)
    ) {
      throw new Error(
        `Duplicate v6 Internal ID projection: ${id}`
      );
    }

    if (
      part &&
      usedPartNumbers.has(part)
    ) {
      throw new Error(
        `Duplicate v6 IHI Part Number projection: ${part}`
      );
    }

    if (id) {
      usedInternalIds.add(id);
    }

    if (part) {
      usedPartNumbers.add(part);
    }

    promotions.push(projection);
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
    "V6 Evidence Type",
    "V6 Evidence",
  ];

  writeCsv(
    PROMOTIONS_PATH,
    promotionHeaders,
    promotions
  );

  /*
   * Preserve the original current-review schema
   * for everything not projected.
   */
  writeCsv(
    REMAINING_PATH,
    parsed.headers,
    remaining
  );

  /*
   * ------------------------------------------------------------
   * SUMMARY
   * ------------------------------------------------------------
   */

  const summary = {
    version:
      "MCN-v6-hindley-projection",

    inputReviewRows:
      parsed.rows.length,

    projectedPromotions:
      promotions.length,

    remainingReviewRows:
      remaining.length,

    byPriorStatus:
      countBy(
        promotions,
        "Prior MCN Match Status"
      ),

    byEvidenceType:
      countBy(
        promotions,
        "V6 Evidence Type"
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
   * ------------------------------------------------------------
   * TERMINAL OUTPUT
   * ------------------------------------------------------------
   */

  console.log("");
  console.log(
    "===== MCN V6 HINDLEY PROJECTED PROMOTIONS ====="
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
    "Projected by prior status:"
  );

  console.table(
    summary.byPriorStatus
  );

  console.log("");
  console.log(
    "Projected by evidence:"
  );

  console.table(
    summary.byEvidenceType
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
    summary.inputReviewRows === 17864 &&
    summary.projectedPromotions === 161 &&
    summary.remainingReviewRows === 17703
  ) {
    console.log(
      "✅ V6 Hindley projection matches the expected post-v5 checkpoint."
    );
  } else {
    console.log(
      "ℹ️ Counts differ from the expected 17,864 → 161 projection checkpoint."
    );

    console.log(
      "   Do not merge anything yet; review the counts first."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v6 Hindley projection failed:",
    err
  );

  process.exit(1);
}
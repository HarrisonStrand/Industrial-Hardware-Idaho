// server/src/scripts/buildMcnV9ProjectedPromotions.js
//
// MCN v9 conservative projection pass.
//
// Century Spring A/C catalog-number families:
//
//   Description: SPRING #151A
//   IHI part:    SPR15110
//   MCN:         151-A
//
//   Description: SPRING #151C
//   IHI part:    SPR15130
//   MCN:         151-C
//
// Only dominant, internally consistent encodings are accepted:
//
//   A -> IHI ending 10
//   C -> IHI ending 30
//
// Explicitly excluded:
//   A -> 00
//   C -> 10
//   A -> 30
//
// Input:
//   tmp/manufacturer-matching-mcn-review-v4.csv
//
// Outputs:
//   tmp/IHI_MCN_v9_projected_promotions.csv
//   tmp/IHI_MCN_v9_remaining_review.csv
//   tmp/IHI_MCN_v9_summary.json
//
// Expected:
//   Input:      17529
//   Projected:     51
//   Remaining: 17478

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
  "IHI_MCN_v9_projected_promotions.csv"
);

const REMAINING_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v9_remaining_review.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v9_summary.json"
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
        .map((header) =>
          csvEscape(row[header] ?? "")
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

function parseDescription(description = "") {
  const value = normalized(description);

  const match = value.match(
    /^SPRING\s*#\s*(\d+)([AC])$/
  );

  if (!match) {
    return null;
  }

  return {
    base: String(Number(match[1])),
    suffix: match[2],
  };
}

function parseIhiPartNumber(partNumber = "") {
  const value = normalized(partNumber);

  const match = value.match(
    /^SPR(\d{3})(\d{2})$/
  );

  if (!match) {
    return null;
  }

  return {
    base: String(Number(match[1])),
    ending: match[2],
  };
}

function expectedEndingForSuffix(suffix) {
  if (suffix === "A") {
    return "10";
  }

  if (suffix === "C") {
    return "30";
  }

  return "";
}

function makePromotion({
  row,
  base,
  suffix,
  ending,
}) {
  const projectedMcn =
    `${base}-${suffix}`;

  return {
    "Internal ID":
      clean(row["Internal ID"]),

    "IHI Part Number":
      clean(row["IHI Part Number"]),

    "Projected MCN":
      projectedMcn,

    "Projected MCN Match Status":
      "verified-description-catalog-number",

    "Manufacturer Match Hint":
      "Century Spring Corp.",

    "MCN Rule":
      "century-spring-published-a-c-series",

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

    "V9 Century Base":
      base,

    "V9 Century Suffix":
      suffix,

    "V9 IHI Ending":
      ending,

    "V9 Evidence Type":
      "published-century-stock-number-family",

    "V9 Evidence":
      `Description identifies Century Spring #${base}${suffix}; Century catalog format is ${base}-${suffix}; IHI encoding ${ending} agrees with the dominant ${suffix} family.`,
  };
}

function projectRow(row) {
  if (
    clean(
      row["Vendor / Manufacturer"]
    ) !== "Century Spring Corp."
  ) {
    return null;
  }

  /*
   * All 51 dominant suffix rows currently belong to
   * unverified-clean-candidate.
   */
  if (
    clean(row["MCN Match Status"]) !==
    "unverified-clean-candidate"
  ) {
    return null;
  }

  const partNumber =
    clean(row["IHI Part Number"]);

  const description =
    clean(row["IHI Description"]);

  const priorCandidate =
    clean(row["MCN Candidate"]);

  const descriptionInfo =
    parseDescription(description);

  if (!descriptionInfo) {
    return null;
  }

  const partInfo =
    parseIhiPartNumber(partNumber);

  if (!partInfo) {
    return null;
  }

  /*
   * The numeric base must independently agree.
   */
  if (
    descriptionInfo.base !==
    partInfo.base
  ) {
    return null;
  }

  /*
   * Only accept the dominant internally consistent mappings.
   *
   * A -> 10
   * C -> 30
   *
   * This automatically excludes:
   *
   * A -> 00
   * C -> 10
   * A -> 30
   */
  const expectedEnding =
    expectedEndingForSuffix(
      descriptionInfo.suffix
    );

  if (
    !expectedEnding ||
    partInfo.ending !== expectedEnding
  ) {
    return null;
  }

  /*
   * These rows were previously clean candidates,
   * so the old candidate must still equal the
   * IHI internal part number.
   */
  if (
    normalized(priorCandidate) !==
    normalized(partNumber)
  ) {
    return null;
  }

  return makePromotion({
    row,
    base:
      descriptionInfo.base,
    suffix:
      descriptionInfo.suffix,
    ending:
      partInfo.ending,
  });
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

  if (!parsed.rows.length) {
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
        !parsed.headers.includes(header)
    );

  if (missingHeaders.length) {
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

  for (const row of parsed.rows) {
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
        projection["IHI Part Number"]
      );

    if (
      internalId &&
      usedIds.has(internalId)
    ) {
      throw new Error(
        `Duplicate v9 Internal ID projection: ${internalId}`
      );
    }

    if (
      partNumber &&
      usedParts.has(partNumber)
    ) {
      throw new Error(
        `Duplicate v9 IHI Part Number projection: ${partNumber}`
      );
    }

    if (internalId) {
      usedIds.add(internalId);
    }

    if (partNumber) {
      usedParts.add(partNumber);
    }

    promotions.push(projection);
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
    "V9 Century Base",
    "V9 Century Suffix",
    "V9 IHI Ending",
    "V9 Evidence Type",
    "V9 Evidence",
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
      "MCN-v9-century-a-c-series",

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

    bySuffix:
      countBy(
        promotions,
        "V9 Century Suffix"
      ),

    byEnding:
      countBy(
        promotions,
        "V9 IHI Ending"
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
    "===== MCN V9 CENTURY SPRING A/C PROJECTED PROMOTIONS ====="
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
    "Projected by suffix:"
  );

  console.table(
    summary.bySuffix
  );

  console.log("");

  console.log(
    "Projected by IHI ending:"
  );

  console.table(
    summary.byEnding
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
    summary.inputReviewRows === 17529 &&
    summary.projectedPromotions === 51 &&
    summary.remainingReviewRows === 17478 &&
    summary.bySuffix.A === 25 &&
    summary.bySuffix.C === 26 &&
    summary.byEnding["10"] === 25 &&
    summary.byEnding["30"] === 26
  ) {
    console.log(
      "✅ V9 projection matches the expected Century Spring checkpoint."
    );

    console.log(
      "✅ 25 A-series + 26 C-series catalog numbers projected."
    );

    console.log(
      "✅ Five inconsistent suffix/encoding rows were excluded."
    );
  } else {
    console.log(
      "ℹ️ V9 counts differ from the expected checkpoint."
    );

    console.log(
      "Do not merge anything yet; review the projection first."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v9 projection failed:",
    err
  );

  process.exit(1);
}
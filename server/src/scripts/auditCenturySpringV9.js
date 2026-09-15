// server/src/scripts/auditCenturySpringV9.js
//
// MCN v9 Century Spring audit.
//
// Purpose:
//   Inspect every remaining Century Spring row after v8 before
//   creating any new MCN promotion rules.
//
// Input:
//   tmp/manufacturer-matching-mcn-review-v4.csv
//
// Outputs:
//   tmp/mcn-v9-century-rows.csv
//   tmp/mcn-v9-century-pattern-summary.csv
//   tmp/mcn-v9-century-summary.json
//
// This script DOES NOT modify any overrides.

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

const ROWS_PATH = path.join(
  OUTPUT_DIR,
  "mcn-v9-century-rows.csv"
);

const PATTERN_PATH = path.join(
  OUTPUT_DIR,
  "mcn-v9-century-pattern-summary.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "mcn-v9-century-summary.json"
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

function countBy(rows, getter) {
  const counts = {};

  for (const row of rows) {
    const value =
      clean(
        typeof getter === "function"
          ? getter(row)
          : row[getter]
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
        a[0].localeCompare(b[0])
    )
  );
}

/*
 * ---------------------------------------------------------------------------
 * DESCRIPTION CLASSIFICATION
 * ---------------------------------------------------------------------------
 */

function classifyDescription(description = "") {
  const value =
    normalized(description);

  let match =
    value.match(
      /^SPRING\s*#\s*(\d+)$/
    );

  if (match) {
    return {
      family:
        "numeric",

      number:
        String(
          Number(match[1])
        ),

      suffix:
        "",
    };
  }

  match =
    value.match(
      /^SPRING\s*#\s*(\d+)([A-Z])$/
    );

  if (match) {
    return {
      family:
        `suffix-${match[2]}`,

      number:
        String(
          Number(match[1])
        ),

      suffix:
        match[2],
    };
  }

  return {
    family:
      "other",

    number:
      "",

    suffix:
      "",
  };
}

/*
 * ---------------------------------------------------------------------------
 * IHI PART-NUMBER CLASSIFICATION
 * ---------------------------------------------------------------------------
 *
 * Example:
 *
 *   SPR15110
 *
 *   Prefix: SPR
 *   Base:   151
 *   Ending: 10
 */

function classifyPartNumber(partNumber = "") {
  const value =
    normalized(partNumber);

  const match =
    value.match(
      /^SPR(\d{3})(\d{2})$/
    );

  if (!match) {
    return {
      family:
        "other",

      base:
        "",

      ending:
        "",
    };
  }

  return {
    family:
      "SPR###xx",

    base:
      String(
        Number(match[1])
      ),

    ending:
      match[2],
  };
}

/*
 * ---------------------------------------------------------------------------
 * CURRENT MCN CANDIDATE CLASSIFICATION
 * ---------------------------------------------------------------------------
 */

function classifyCandidate(
  row
) {
  const candidate =
    clean(
      row[
        "MCN Candidate"
      ]
    );

  const partNumber =
    clean(
      row[
        "IHI Part Number"
      ]
    );

  if (!candidate) {
    return "blank";
  }

  if (
    normalized(candidate) ===
    normalized(partNumber)
  ) {
    return "equals-ihi-part-number";
  }

  if (
    /^C-\d+[A-Z]?$/i.test(
      candidate
    )
  ) {
    return "century-c-series-looking";
  }

  if (
    /^\d+[A-Z]?$/i.test(
      candidate
    )
  ) {
    return "numeric-or-suffix-token";
  }

  return "other";
}

/*
 * ---------------------------------------------------------------------------
 * POTENTIAL SUFFIX RELATIONSHIP
 * ---------------------------------------------------------------------------
 *
 * IMPORTANT:
 *
 * This is ONLY an audit classification.
 *
 * It does NOT declare that:
 *
 *   ending 10 = suffix A
 *   ending 30 = suffix C
 *
 * Instead, it tells us whether the remaining data consistently
 * exhibits those relationships so they can be independently verified
 * before we create a rule.
 */

function classifySuffixRelationship({
  descriptionInfo,
  partInfo,
}) {
  if (
    !descriptionInfo.suffix ||
    !partInfo.ending
  ) {
    return "not-applicable";
  }

  return (
    `${descriptionInfo.suffix} -> ${partInfo.ending}`
  );
}

function buildAuditRow(row) {
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

  const descriptionInfo =
    classifyDescription(
      description
    );

  const partInfo =
    classifyPartNumber(
      partNumber
    );

  const baseNumbersAgree =
    (
      descriptionInfo.number &&
      partInfo.base
    )
      ? (
          descriptionInfo.number ===
          partInfo.base
            ? "yes"
            : "no"
        )
      : "n/a";

  return {
    "Internal ID":
      clean(
        row[
          "Internal ID"
        ]
      ),

    "IHI Part Number":
      partNumber,

    "IHI Description":
      description,

    "MCN Candidate":
      clean(
        row[
          "MCN Candidate"
        ]
      ),

    "MCN Match Status":
      clean(
        row[
          "MCN Match Status"
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
        row[
          "Category"
        ]
      ),

    Subcategory:
      clean(
        row[
          "Subcategory"
        ]
      ),

    "Description Family":
      descriptionInfo.family,

    "Description Number":
      descriptionInfo.number,

    "Description Suffix":
      descriptionInfo.suffix,

    "Part Number Family":
      partInfo.family,

    "Part Base Number":
      partInfo.base,

    "Part Ending":
      partInfo.ending,

    "Base Numbers Agree":
      baseNumbersAgree,

    "Candidate Pattern":
      classifyCandidate(
        row
      ),

    "Suffix / Part Ending":
      classifySuffixRelationship({
        descriptionInfo,
        partInfo,
      }),
  };
}

function makePatternSummary(
  auditRows
) {
  const groups =
    new Map();

  for (
    const row
    of auditRows
  ) {
    const key = [
      row[
        "Description Family"
      ],

      row[
        "Part Number Family"
      ],

      row[
        "Part Ending"
      ],

      row[
        "MCN Match Status"
      ],

      row[
        "Candidate Pattern"
      ],

      row[
        "Base Numbers Agree"
      ],

      row[
        "Suffix / Part Ending"
      ],
    ].join("|||");

    if (!groups.has(key)) {
      groups.set(
        key,
        {
          "Description Family":
            row[
              "Description Family"
            ],

          "Part Number Family":
            row[
              "Part Number Family"
            ],

          "Part Ending":
            row[
              "Part Ending"
            ],

          "MCN Match Status":
            row[
              "MCN Match Status"
            ],

          "Candidate Pattern":
            row[
              "Candidate Pattern"
            ],

          "Base Numbers Agree":
            row[
              "Base Numbers Agree"
            ],

          "Suffix / Part Ending":
            row[
              "Suffix / Part Ending"
            ],

          Count:
            0,
        }
      );
    }

    groups.get(
      key
    ).Count += 1;
  }

  return Array.from(
    groups.values()
  ).sort(
    (a, b) =>
      b.Count -
        a.Count ||
      a[
        "Description Family"
      ].localeCompare(
        b[
          "Description Family"
        ]
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

  /*
   * Only current Century Spring review rows.
   */
  const centuryRows =
    parsed.rows.filter(
      (row) =>
        clean(
          row[
            "Vendor / Manufacturer"
          ]
        ) ===
        "Century Spring Corp."
    );

  const auditRows =
    centuryRows.map(
      buildAuditRow
    );

  const patternSummary =
    makePatternSummary(
      auditRows
    );

  const auditHeaders = [
    "Internal ID",
    "IHI Part Number",
    "IHI Description",
    "MCN Candidate",
    "MCN Match Status",
    "Vendor / Manufacturer",
    "Category",
    "Subcategory",
    "Description Family",
    "Description Number",
    "Description Suffix",
    "Part Number Family",
    "Part Base Number",
    "Part Ending",
    "Base Numbers Agree",
    "Candidate Pattern",
    "Suffix / Part Ending",
  ];

  writeCsv(
    ROWS_PATH,
    auditHeaders,
    auditRows
  );

  const patternHeaders = [
    "Description Family",
    "Part Number Family",
    "Part Ending",
    "MCN Match Status",
    "Candidate Pattern",
    "Base Numbers Agree",
    "Suffix / Part Ending",
    "Count",
  ];

  writeCsv(
    PATTERN_PATH,
    patternHeaders,
    patternSummary
  );

  /*
   * ------------------------------------------------------------------------
   * ADDITIONAL COUNTS
   * ------------------------------------------------------------------------
   */

  const baseAgreement =
    countBy(
      auditRows,
      "Base Numbers Agree"
    );

  const descriptionFamilies =
    countBy(
      auditRows,
      "Description Family"
    );

  const partEndings =
    countBy(
      auditRows,
      "Part Ending"
    );

  const suffixRelationships =
    countBy(
      auditRows,
      "Suffix / Part Ending"
    );

  const candidatePatterns =
    countBy(
      auditRows,
      "Candidate Pattern"
    );

  const statusCounts =
    countBy(
      auditRows,
      "MCN Match Status"
    );

  /*
   * Rows that look especially useful for a future suffix rule:
   *
   * - description explicitly has a suffix
   * - IHI part number parses
   * - base number agrees
   */
  const suffixRowsWithAgreement =
    auditRows.filter(
      (row) =>
        row[
          "Description Suffix"
        ] &&
        row[
          "Part Number Family"
        ] ===
          "SPR###xx" &&
        row[
          "Base Numbers Agree"
        ] ===
          "yes"
    );

  const suffixAgreementCounts =
    countBy(
      suffixRowsWithAgreement,
      "Suffix / Part Ending"
    );

  const summary = {
    version:
      "MCN-v9-century-audit",

    inputReviewRows:
      parsed.rows.length,

    centuryReviewRows:
      auditRows.length,

    statusCounts,

    descriptionFamilies,

    partEndings,

    candidatePatterns,

    baseAgreement,

    suffixRelationships,

    suffixRowsWithMatchingBase:
      suffixRowsWithAgreement.length,

    suffixAgreementCounts,

    outputs: {
      centuryRows:
        ROWS_PATH,

      patternSummary:
        PATTERN_PATH,
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
   * ------------------------------------------------------------------------
   * TERMINAL OUTPUT
   * ------------------------------------------------------------------------
   */

  console.log("");
  console.log(
    "===== MCN V9 CENTURY SPRING AUDIT ====="
  );

  console.log(
    `Full review rows:       ${summary.inputReviewRows}`
  );

  console.log(
    `Century review rows:    ${summary.centuryReviewRows}`
  );

  console.log("");

  console.log(
    "STATUS COUNTS"
  );

  console.table(
    statusCounts
  );

  console.log("");

  console.log(
    "DESCRIPTION FAMILIES"
  );

  console.table(
    descriptionFamilies
  );

  console.log("");

  console.log(
    "PART NUMBER ENDINGS"
  );

  console.table(
    partEndings
  );

  console.log("");

  console.log(
    "CANDIDATE PATTERNS"
  );

  console.table(
    candidatePatterns
  );

  console.log("");

  console.log(
    "BASE NUMBER AGREEMENT"
  );

  console.table(
    baseAgreement
  );

  console.log("");

  console.log(
    "SUFFIX / PART ENDING RELATIONSHIPS"
  );

  console.table(
    suffixRelationships
  );

  console.log("");

  console.log(
    "SUFFIX ROWS WITH MATCHING BASE NUMBER"
  );

  console.log(
    suffixRowsWithAgreement.length
  );

  console.table(
    suffixAgreementCounts
  );

  console.log("");

  console.log(
    "PATTERN SUMMARY"
  );

  console.table(
    patternSummary
  );

  console.log("");

  console.log(
    `Rows:     ${ROWS_PATH}`
  );

  console.log(
    `Patterns: ${PATTERN_PATH}`
  );

  console.log(
    `Summary:  ${SUMMARY_PATH}`
  );

  console.log("");

  if (
    summary.inputReviewRows ===
      17529 &&
    summary.centuryReviewRows ===
      123
  ) {
    console.log(
      "✅ V9 Century audit matches the expected post-v8 checkpoint."
    );

    console.log(
      "ℹ️ No MCN overrides were modified."
    );
  } else {
    console.log(
      "ℹ️ Counts differ from the expected post-v8 checkpoint."
    );

    console.log(
      "Review the generated audit before creating any v9 promotion rule."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v9 Century audit failed:",
    err
  );

  process.exit(1);
}
// server/src/scripts/auditGreenliteHillsdaleV10.js
//
// MCN v10 Greenlite / Hillsdale audit.
//
// Purpose:
//   Classify every remaining Greenlite / Hillsdale review row before
//   building any new MCN promotion rules.
//
// Input:
//   tmp/manufacturer-matching-mcn-review-v4.csv
//
// Outputs:
//   tmp/mcn-v10-greenlite-hillsdale-rows.csv
//   tmp/mcn-v10-greenlite-hillsdale-patterns.csv
//   tmp/mcn-v10-greenlite-hillsdale-summary.json
//
// This script DOES NOT modify any overrides.
//
// Expected post-v9 checkpoint:
//   Full review rows:                  17478
//   Greenlite / Hillsdale review rows:   701

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
  "mcn-v10-greenlite-hillsdale-rows.csv"
);

const PATTERNS_PATH = path.join(
  OUTPUT_DIR,
  "mcn-v10-greenlite-hillsdale-patterns.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "mcn-v10-greenlite-hillsdale-summary.json"
);

function clean(value = "") {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value = "") {
  return clean(value).toUpperCase();
}

function escapeRegex(value = "") {
  return String(value)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function countBy(rows, fieldOrGetter) {
  const counts = {};

  for (const row of rows) {
    const raw =
      typeof fieldOrGetter === "function"
        ? fieldOrGetter(row)
        : row[fieldOrGetter];

    const value =
      clean(raw) ||
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

/*
 * ---------------------------------------------------------------------------
 * BRAND CLUES
 * ---------------------------------------------------------------------------
 */

function classifyBrandClue(description = "") {
  const value = normalized(description);

  const hillsdale =
    /\bHILLSDALE\b/.test(value);

  const greenlite =
    /\bGREENLITE\b/.test(value);

  if (hillsdale && greenlite) {
    return "both-explicit";
  }

  if (hillsdale) {
    return "hillsdale-explicit";
  }

  if (greenlite) {
    return "greenlite-explicit";
  }

  return "no-explicit-brand";
}

/*
 * ---------------------------------------------------------------------------
 * PART / CANDIDATE SHAPES
 * ---------------------------------------------------------------------------
 */

function classifyCodeShape(value = "") {
  const v = normalized(value);

  if (!v) {
    return "blank";
  }

  if (/^\d+$/.test(v)) {
    return "numeric";
  }

  if (/^\d+-\d+$/.test(v)) {
    return "numeric-dash-numeric";
  }

  if (/^\d+[A-Z]+$/.test(v)) {
    return "numeric-alpha-suffix";
  }

  if (/^[A-Z]+\d+$/.test(v)) {
    return "alpha-prefix-numeric";
  }

  if (/^[A-Z]+\d+[A-Z]+$/.test(v)) {
    return "alpha-prefix-numeric-suffix";
  }

  if (/^[A-Z]+\d+(?:-\d+)+[A-Z]*$/.test(v)) {
    return "alpha-prefix-hyphenated";
  }

  if (/^[A-Z0-9]+-[A-Z0-9-]+$/.test(v)) {
    return "hyphenated-mixed";
  }

  if (/^[A-Z0-9]+$/.test(v)) {
    return "compact-alphanumeric";
  }

  return "other";
}

function leadingStem(value = "") {
  const v = normalized(value);

  const match =
    v.match(/^([A-Z]+)/);

  return match
    ? match[1]
    : "(none)";
}

function trailingLetters(value = "") {
  const v = normalized(value);

  const match =
    v.match(/([A-Z]+)$/);

  return match
    ? match[1]
    : "(none)";
}

/*
 * ---------------------------------------------------------------------------
 * DESCRIPTION TOKEN EVIDENCE
 * ---------------------------------------------------------------------------
 */

function valueAppearsInDescription(
  value,
  description
) {
  const needle = clean(value);
  const haystack = clean(description);

  if (!needle || !haystack) {
    return false;
  }

  const regex =
    new RegExp(
      `(^|[^A-Z0-9])${escapeRegex(
        needle
      )}([^A-Z0-9]|$)`,
      "i"
    );

  return regex.test(
    haystack
  );
}

function extractHashTokens(description = "") {
  const value = clean(description);

  const tokens = [];

  const regex =
    /#\s*([A-Z0-9][A-Z0-9.-]*)/gi;

  let match;

  while (
    (match = regex.exec(value))
  ) {
    tokens.push(
      clean(match[1])
    );
  }

  return [
    ...new Set(tokens),
  ];
}

function extractLabeledCatalogTokens(
  description = ""
) {
  const value = clean(description);

  const tokens = [];

  const regex =
    /\b(?:MFG|MFR|MODEL|CAT|CATALOG|PART|P\/N|PN)\s*(?:#|NO\.?|NUMBER|:)?\s*([A-Z0-9][A-Z0-9./-]*)/gi;

  let match;

  while (
    (match = regex.exec(value))
  ) {
    tokens.push(
      clean(match[1])
    );
  }

  return [
    ...new Set(tokens),
  ];
}

/*
 * ---------------------------------------------------------------------------
 * CANDIDATE RELATIONSHIP
 * ---------------------------------------------------------------------------
 */

function classifyCandidateRelationship(
  partNumber,
  candidate
) {
  const part =
    normalized(partNumber);

  const cand =
    normalized(candidate);

  if (!cand) {
    return "candidate-blank";
  }

  if (cand === part) {
    return "candidate-equals-part";
  }

  if (
    part &&
    part.includes(cand)
  ) {
    return "candidate-contained-in-part";
  }

  if (
    part &&
    cand.includes(part)
  ) {
    return "part-contained-in-candidate";
  }

  return "candidate-different";
}

/*
 * ---------------------------------------------------------------------------
 * DIRECT EVIDENCE
 * ---------------------------------------------------------------------------
 */

function classifyDirectEvidence({
  brandClue,
  candidateInDescription,
  partInDescription,
  hashTokens,
  labeledTokens,
  candidate,
}) {
  const candidateNorm =
    normalized(candidate);

  const hashMatch =
    !!candidateNorm &&
    hashTokens.some(
      (token) =>
        normalized(token) ===
        candidateNorm
    );

  const labeledMatch =
    !!candidateNorm &&
    labeledTokens.some(
      (token) =>
        normalized(token) ===
        candidateNorm
    );

  if (
    brandClue !==
      "no-explicit-brand" &&
    candidateInDescription &&
    (hashMatch || labeledMatch)
  ) {
    return "explicit-brand-plus-labeled-candidate";
  }

  if (
    candidateInDescription &&
    labeledMatch
  ) {
    return "labeled-candidate-in-description";
  }

  if (
    candidateInDescription &&
    hashMatch
  ) {
    return "hash-candidate-in-description";
  }

  if (
    brandClue !==
      "no-explicit-brand" &&
    candidateInDescription
  ) {
    return "explicit-brand-plus-candidate";
  }

  if (
    candidateInDescription
  ) {
    return "candidate-in-description";
  }

  if (
    brandClue !==
    "no-explicit-brand"
  ) {
    return "explicit-brand-only";
  }

  if (partInDescription) {
    return "ihi-part-in-description";
  }

  return "no-direct-description-evidence";
}

function buildAuditRow(row) {
  const partNumber =
    clean(
      row["IHI Part Number"]
    );

  const candidate =
    clean(
      row["MCN Candidate"]
    );

  const description =
    clean(
      row["IHI Description"]
    );

  const brandClue =
    classifyBrandClue(
      description
    );

  const candidateInDescription =
    valueAppearsInDescription(
      candidate,
      description
    );

  const partInDescription =
    valueAppearsInDescription(
      partNumber,
      description
    );

  const hashTokens =
    extractHashTokens(
      description
    );

  const labeledTokens =
    extractLabeledCatalogTokens(
      description
    );

  const directEvidence =
    classifyDirectEvidence({
      brandClue,
      candidateInDescription,
      partInDescription,
      hashTokens,
      labeledTokens,
      candidate,
    });

  return {
    "Internal ID":
      clean(
        row["Internal ID"]
      ),

    "IHI Part Number":
      partNumber,

    "IHI Description":
      description,

    "MCN Candidate":
      candidate,

    "MCN Match Status":
      clean(
        row["MCN Match Status"]
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

    "Brand Clue":
      brandClue,

    "Part Shape":
      classifyCodeShape(
        partNumber
      ),

    "Part Leading Stem":
      leadingStem(
        partNumber
      ),

    "Part Trailing Letters":
      trailingLetters(
        partNumber
      ),

    "Candidate Shape":
      classifyCodeShape(
        candidate
      ),

    "Candidate Relationship":
      classifyCandidateRelationship(
        partNumber,
        candidate
      ),

    "Candidate In Description":
      candidateInDescription
        ? "yes"
        : "no",

    "IHI Part In Description":
      partInDescription
        ? "yes"
        : "no",

    "Hash Tokens":
      hashTokens.join(" | "),

    "Labeled Catalog Tokens":
      labeledTokens.join(" | "),

    "Direct Evidence":
      directEvidence,
  };
}

function makePatternSummary(
  auditRows
) {
  const groups =
    new Map();

  for (const row of auditRows) {
    const key = [
      row[
        "MCN Match Status"
      ],

      row[
        "Brand Clue"
      ],

      row[
        "Direct Evidence"
      ],

      row[
        "Part Shape"
      ],

      row[
        "Part Leading Stem"
      ],

      row[
        "Part Trailing Letters"
      ],

      row[
        "Candidate Shape"
      ],

      row[
        "Candidate Relationship"
      ],
    ].join("|||");

    if (!groups.has(key)) {
      groups.set(
        key,
        {
          "MCN Match Status":
            row[
              "MCN Match Status"
            ],

          "Brand Clue":
            row[
              "Brand Clue"
            ],

          "Direct Evidence":
            row[
              "Direct Evidence"
            ],

          "Part Shape":
            row[
              "Part Shape"
            ],

          "Part Leading Stem":
            row[
              "Part Leading Stem"
            ],

          "Part Trailing Letters":
            row[
              "Part Trailing Letters"
            ],

          "Candidate Shape":
            row[
              "Candidate Shape"
            ],

          "Candidate Relationship":
            row[
              "Candidate Relationship"
            ],

          Count: 0,
        }
      );
    }

    groups.get(key).Count += 1;
  }

  return Array.from(
    groups.values()
  ).sort(
    (a, b) =>
      b.Count -
        a.Count ||
      a[
        "Direct Evidence"
      ].localeCompare(
        b[
          "Direct Evidence"
        ]
      )
  );
}

function topEntries(
  counts,
  limit = 25
) {
  return Object.fromEntries(
    Object.entries(counts)
      .slice(0, limit)
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
        !parsed.headers.includes(
          header
        )
    );

  if (missingHeaders.length) {
    throw new Error(
      `Missing required columns: ${missingHeaders.join(", ")}`
    );
  }

  const sourceRows =
    parsed.rows.filter(
      (row) =>
        clean(
          row[
            "Vendor / Manufacturer"
          ]
        ) ===
        "Greenlite / Hillsdale"
    );

  const auditRows =
    sourceRows.map(
      buildAuditRow
    );

  const patternRows =
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
    "Brand Clue",
    "Part Shape",
    "Part Leading Stem",
    "Part Trailing Letters",
    "Candidate Shape",
    "Candidate Relationship",
    "Candidate In Description",
    "IHI Part In Description",
    "Hash Tokens",
    "Labeled Catalog Tokens",
    "Direct Evidence",
  ];

  writeCsv(
    ROWS_PATH,
    auditHeaders,
    auditRows
  );

  const patternHeaders = [
    "MCN Match Status",
    "Brand Clue",
    "Direct Evidence",
    "Part Shape",
    "Part Leading Stem",
    "Part Trailing Letters",
    "Candidate Shape",
    "Candidate Relationship",
    "Count",
  ];

  writeCsv(
    PATTERNS_PATH,
    patternHeaders,
    patternRows
  );

  const statusCounts =
    countBy(
      auditRows,
      "MCN Match Status"
    );

  const brandCounts =
    countBy(
      auditRows,
      "Brand Clue"
    );

  const directEvidenceCounts =
    countBy(
      auditRows,
      "Direct Evidence"
    );

  const partShapeCounts =
    countBy(
      auditRows,
      "Part Shape"
    );

  const candidateShapeCounts =
    countBy(
      auditRows,
      "Candidate Shape"
    );

  const relationshipCounts =
    countBy(
      auditRows,
      "Candidate Relationship"
    );

  const stemCounts =
    countBy(
      auditRows,
      "Part Leading Stem"
    );

  const trailingCounts =
    countBy(
      auditRows,
      "Part Trailing Letters"
    );

  const descriptionCandidateCount =
    auditRows.filter(
      (row) =>
        row[
          "Candidate In Description"
        ] === "yes"
    ).length;

  const explicitBrandCount =
    auditRows.filter(
      (row) =>
        row[
          "Brand Clue"
        ] !==
        "no-explicit-brand"
    ).length;

  const strongDirectEvidence =
    auditRows.filter(
      (row) =>
        [
          "explicit-brand-plus-labeled-candidate",
          "labeled-candidate-in-description",
          "hash-candidate-in-description",
          "explicit-brand-plus-candidate",
          "candidate-in-description",
        ].includes(
          row[
            "Direct Evidence"
          ]
        )
    );

  const summary = {
    version:
      "MCN-v10-greenlite-hillsdale-audit",

    inputReviewRows:
      parsed.rows.length,

    greenliteHillsdaleRows:
      auditRows.length,

    statusCounts,

    brandCounts,

    directEvidenceCounts,

    partShapeCounts,

    candidateShapeCounts,

    relationshipCounts,

    leadingStemCounts:
      topEntries(
        stemCounts,
        30
      ),

    trailingLetterCounts:
      topEntries(
        trailingCounts,
        20
      ),

    candidateAppearsInDescription:
      descriptionCandidateCount,

    explicitBrandDescriptions:
      explicitBrandCount,

    strongDirectEvidenceRows:
      strongDirectEvidence.length,

    outputs: {
      rows:
        ROWS_PATH,

      patterns:
        PATTERNS_PATH,
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
    "===== MCN V10 GREENLITE / HILLSDALE AUDIT ====="
  );

  console.log(
    `Full review rows:             ${summary.inputReviewRows}`
  );

  console.log(
    `Greenlite / Hillsdale rows:   ${summary.greenliteHillsdaleRows}`
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
    "BRAND CLUES IN DESCRIPTION"
  );

  console.table(
    brandCounts
  );

  console.log("");

  console.log(
    "DIRECT EVIDENCE"
  );

  console.table(
    directEvidenceCounts
  );

  console.log("");

  console.log(
    "PART NUMBER SHAPES"
  );

  console.table(
    partShapeCounts
  );

  console.log("");

  console.log(
    "CANDIDATE SHAPES"
  );

  console.table(
    candidateShapeCounts
  );

  console.log("");

  console.log(
    "CANDIDATE RELATIONSHIPS"
  );

  console.table(
    relationshipCounts
  );

  console.log("");

  console.log(
    "TOP PART NUMBER LEADING STEMS"
  );

  console.table(
    topEntries(
      stemCounts,
      30
    )
  );

  console.log("");

  console.log(
    "TOP TRAILING LETTERS"
  );

  console.table(
    topEntries(
      trailingCounts,
      20
    )
  );

  console.log("");

  console.log(
    "DIRECT-EVIDENCE TOTALS"
  );

  console.log(
    `Candidate appears in description: ${descriptionCandidateCount}`
  );

  console.log(
    `Explicit brand in description:     ${explicitBrandCount}`
  );

  console.log(
    `Strong direct-evidence rows:       ${strongDirectEvidence.length}`
  );

  console.log("");

  console.log(
    "TOP 40 PATTERN GROUPS"
  );

  console.table(
    patternRows.slice(
      0,
      40
    )
  );

  console.log("");

  console.log(
    `Rows:     ${ROWS_PATH}`
  );

  console.log(
    `Patterns: ${PATTERNS_PATH}`
  );

  console.log(
    `Summary:  ${SUMMARY_PATH}`
  );

  console.log("");

  if (
    summary.inputReviewRows ===
      17478 &&
    summary.greenliteHillsdaleRows ===
      701
  ) {
    console.log(
      "✅ V10 Greenlite / Hillsdale audit matches the expected post-v9 checkpoint."
    );

    console.log(
      "ℹ️ No MCN overrides were modified."
    );
  } else {
    console.log(
      "ℹ️ Counts differ from the expected post-v9 checkpoint."
    );

    console.log(
      "Review the audit before creating any v10 promotion rules."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v10 Greenlite / Hillsdale audit failed:",
    err
  );

  process.exit(1);
}
// server/src/scripts/validateMcnV8ProjectedPromotions.js
//
// Validates MCN v8 Century Spring projected promotions.
//
// Input:
//   tmp/IHI_MCN_v8_projected_promotions.csv
//
// Outputs:
//   tmp/IHI_MCN_v8_safe_promotions.csv
//   tmp/IHI_MCN_v8_conflicts.csv
//   tmp/IHI_MCN_v8_unresolved.csv
//   tmp/IHI_MCN_v8_override_additions.csv
//   tmp/IHI_MCN_v8_validation_summary.json
//
// Expected batch:
//   Century Spring Corp.: 121

import fs from "fs";
import path from "path";

const INPUT_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "IHI_MCN_v8_projected_promotions.csv"
);

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "tmp"
);

const SAFE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v8_safe_promotions.csv"
);

const CONFLICT_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v8_conflicts.csv"
);

const UNRESOLVED_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v8_unresolved.csv"
);

const OVERRIDE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v8_override_additions.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v8_validation_summary.json"
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

function extractNumericSpringNumber(
  description = ""
) {
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

function decodeNumericSprPartNumber(
  partNumber = ""
) {
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

function validateRow(row) {
  const reasons = [];

  const internalId =
    clean(
      row["Internal ID"]
    );

  const partNumber =
    clean(
      row["IHI Part Number"]
    );

  const projected =
    clean(
      row["Projected MCN"]
    );

  const status =
    clean(
      row[
        "Projected MCN Match Status"
      ]
    );

  const manufacturer =
    clean(
      row[
        "Manufacturer Match Hint"
      ]
    );

  const rule =
    clean(
      row["MCN Rule"]
    );

  const description =
    clean(
      row["IHI Description"]
    );

  const priorStatus =
    clean(
      row[
        "Prior MCN Match Status"
      ]
    );

  const priorCandidate =
    clean(
      row[
        "Prior MCN Candidate"
      ]
    );

  const sourceVendor =
    clean(
      row[
        "Vendor / Manufacturer"
      ]
    );

  const centuryNumber =
    clean(
      row[
        "V8 Century Number"
      ]
    );

  const evidenceType =
    clean(
      row[
        "V8 Evidence Type"
      ]
    );

  /*
   * ------------------------------------------------------------
   * REQUIRED IDENTITY
   * ------------------------------------------------------------
   */

  if (!internalId) {
    reasons.push(
      "Internal ID is blank"
    );
  }

  if (!partNumber) {
    reasons.push(
      "IHI Part Number is blank"
    );
  }

  if (!projected) {
    reasons.push(
      "Projected MCN is blank"
    );
  }

  /*
   * ------------------------------------------------------------
   * SOURCE / MANUFACTURER
   * ------------------------------------------------------------
   */

  if (
    sourceVendor !==
    "Century Spring Corp."
  ) {
    reasons.push(
      `Source vendor is "${sourceVendor}", expected Century Spring Corp.`
    );
  }

  if (
    manufacturer !==
    "Century Spring Corp."
  ) {
    reasons.push(
      `Manufacturer hint is "${manufacturer}", expected Century Spring Corp.`
    );
  }

  /*
   * ------------------------------------------------------------
   * STATUS / RULE
   * ------------------------------------------------------------
   */

  if (
    status !==
    "verified-manufacturer-family"
  ) {
    reasons.push(
      `Unexpected projected status "${status}"`
    );
  }

  if (
    rule !==
    "century-spring-retail-c-series"
  ) {
    reasons.push(
      `Unexpected v8 rule "${rule}"`
    );
  }

  if (
    priorStatus !==
    "unverified-clean-candidate"
  ) {
    reasons.push(
      `Unexpected prior status "${priorStatus}"`
    );
  }

  if (
    evidenceType !==
    "ihi-encoding-plus-explicit-century-spring-number"
  ) {
    reasons.push(
      `Unexpected evidence type "${evidenceType}"`
    );
  }

  /*
   * ------------------------------------------------------------
   * PART-NUMBER DECODING
   * ------------------------------------------------------------
   */

  const partSpringNumber =
    decodeNumericSprPartNumber(
      partNumber
    );

  if (!partSpringNumber) {
    reasons.push(
      `IHI part number "${partNumber}" does not match numeric SPR###00 pattern`
    );
  }

  /*
   * ------------------------------------------------------------
   * DESCRIPTION NUMBER
   * ------------------------------------------------------------
   */

  const descriptionSpringNumber =
    extractNumericSpringNumber(
      description
    );

  if (!descriptionSpringNumber) {
    reasons.push(
      `Description "${description}" does not contain an exact numeric SPRING # value`
    );
  }

  /*
   * ------------------------------------------------------------
   * CROSS-CHECK INTERNAL NUMBER SOURCES
   * ------------------------------------------------------------
   */

  if (
    partSpringNumber &&
    descriptionSpringNumber &&
    partSpringNumber !==
      descriptionSpringNumber
  ) {
    reasons.push(
      `IHI part number decodes to spring ${partSpringNumber}, but description identifies spring ${descriptionSpringNumber}`
    );
  }

  if (
    centuryNumber &&
    partSpringNumber &&
    centuryNumber !==
      partSpringNumber
  ) {
    reasons.push(
      `Stored V8 Century Number ${centuryNumber} does not equal decoded part number ${partSpringNumber}`
    );
  }

  if (
    centuryNumber &&
    descriptionSpringNumber &&
    centuryNumber !==
      descriptionSpringNumber
  ) {
    reasons.push(
      `Stored V8 Century Number ${centuryNumber} does not equal description spring number ${descriptionSpringNumber}`
    );
  }

  /*
   * ------------------------------------------------------------
   * EXPECTED MCN
   * ------------------------------------------------------------
   */

  const expectedNumber =
    partSpringNumber ||
    descriptionSpringNumber ||
    centuryNumber;

  const expectedMcn =
    expectedNumber
      ? `C-${expectedNumber}`
      : "";

  if (
    expectedMcn &&
    normalized(projected) !==
      normalized(expectedMcn)
  ) {
    reasons.push(
      `Projected MCN "${projected}" does not equal expected Century Spring MCN "${expectedMcn}"`
    );
  }

  /*
   * Explicitly reject A/C suffix variants.
   *
   * They should never have made it into this batch.
   */
  if (
    /[A-Z]$/i.test(
      descriptionSpringNumber
    )
  ) {
    reasons.push(
      "Century Spring suffix variant unexpectedly entered numeric v8 batch"
    );
  }

  /*
   * ------------------------------------------------------------
   * PRIOR CANDIDATE
   * ------------------------------------------------------------
   *
   * These originated as clean IHI candidates, so the prior
   * candidate should equal the IHI part number, NOT C-###.
   */

  if (
    normalized(priorCandidate) !==
    normalized(partNumber)
  ) {
    reasons.push(
      `Prior clean candidate "${priorCandidate}" does not equal IHI part number "${partNumber}"`
    );
  }

  if (
    reasons.length
  ) {
    return {
      bucket:
        "unresolved",

      reasons,
    };
  }

  return {
    bucket:
      "safe",

    reasons: [
      `Century Spring ${projected} passed independent IHI encoding + description validation`,
    ],
  };
}

function addAuditFields(
  row,
  validation
) {
  return {
    ...row,

    "V8 Validation Bucket":
      validation.bucket,

    "V8 Validation Notes":
      validation.reasons.join(
        "; "
      ),
  };
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
    Object.entries(
      counts
    ).sort(
      (a, b) =>
        b[1] -
          a[1] ||
        a[0].localeCompare(
          b[0]
        )
    )
  );
}

function findDuplicates(
  rows,
  field
) {
  const map =
    new Map();

  for (
    let i = 0;
    i < rows.length;
    i += 1
  ) {
    const key =
      normalized(
        rows[i][field]
      );

    if (!key) {
      continue;
    }

    if (!map.has(key)) {
      map.set(
        key,
        []
      );
    }

    map.get(
      key
    ).push(i);
  }

  return Array.from(
    map.entries()
  ).filter(
    ([, indexes]) =>
      indexes.length > 1
  );
}

function main() {
  if (
    !fs.existsSync(
      INPUT_PATH
    )
  ) {
    throw new Error(
      `V8 projected promotion file not found:\n${INPUT_PATH}`
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
      "V8 projected promotion file contains no rows."
    );
  }

  const requiredHeaders = [
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
    "V8 Century Number",
    "V8 Evidence Type",
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
   * ------------------------------------------------------------
   * DUPLICATE SAFETY
   * ------------------------------------------------------------
   */

  const duplicateIds =
    findDuplicates(
      parsed.rows,
      "Internal ID"
    );

  const duplicateParts =
    findDuplicates(
      parsed.rows,
      "IHI Part Number"
    );

  if (
    duplicateIds.length
  ) {
    throw new Error(
      `Duplicate Internal IDs detected in v8 projections: ${duplicateIds
        .slice(0, 10)
        .map(
          ([id]) => id
        )
        .join(", ")}`
    );
  }

  if (
    duplicateParts.length
  ) {
    throw new Error(
      `Duplicate IHI Part Numbers detected in v8 projections: ${duplicateParts
        .slice(0, 10)
        .map(
          ([part]) => part
        )
        .join(", ")}`
    );
  }

  /*
   * ------------------------------------------------------------
   * VALIDATE
   * ------------------------------------------------------------
   */

  const safe = [];
  const conflicts = [];
  const unresolved = [];

  for (
    const row
    of parsed.rows
  ) {
    const validation =
      validateRow(row);

    const audited =
      addAuditFields(
        row,
        validation
      );

    if (
      validation.bucket ===
      "safe"
    ) {
      safe.push(
        audited
      );
    }

    else if (
      validation.bucket ===
      "conflict"
    ) {
      conflicts.push(
        audited
      );
    }

    else {
      unresolved.push(
        audited
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * WRITE AUDIT FILES
   * ------------------------------------------------------------
   */

  const auditHeaders = [
    ...parsed.headers,

    "V8 Validation Bucket",

    "V8 Validation Notes",
  ];

  writeCsv(
    SAFE_PATH,
    auditHeaders,
    safe
  );

  writeCsv(
    CONFLICT_PATH,
    auditHeaders,
    conflicts
  );

  writeCsv(
    UNRESOLVED_PATH,
    auditHeaders,
    unresolved
  );

  /*
   * ------------------------------------------------------------
   * BUILD PERMANENT OVERRIDE ADDITIONS
   * ------------------------------------------------------------
   */

  const overrideHeaders = [
    "Internal ID",
    "IHI Part Number",
    "MCN",
    "Manufacturer / Match Hint",
    "MCN Match Status",
    "Rule",
    "IHI Description",
  ];

  const overrideRows =
    safe.map(
      (row) => ({
        "Internal ID":
          clean(
            row[
              "Internal ID"
            ]
          ),

        "IHI Part Number":
          clean(
            row[
              "IHI Part Number"
            ]
          ),

        MCN:
          clean(
            row[
              "Projected MCN"
            ]
          ),

        "Manufacturer / Match Hint":
          clean(
            row[
              "Manufacturer Match Hint"
            ]
          ),

        "MCN Match Status":
          clean(
            row[
              "Projected MCN Match Status"
            ]
          ),

        Rule:
          clean(
            row[
              "MCN Rule"
            ]
          ),

        "IHI Description":
          clean(
            row[
              "IHI Description"
            ]
          ),
      })
    );

  writeCsv(
    OVERRIDE_PATH,
    overrideHeaders,
    overrideRows
  );

  /*
   * ------------------------------------------------------------
   * SUMMARY
   * ------------------------------------------------------------
   */

  const summary = {
    version:
      "MCN-v8-validation",

    inputRows:
      parsed.rows.length,

    safePromotions:
      safe.length,

    conflicts:
      conflicts.length,

    unresolved:
      unresolved.length,

    safeRate:
      Number(
        (
          safe.length /
          parsed.rows.length *
          100
        ).toFixed(2)
      ),

    safeByManufacturer:
      countBy(
        safe,
        "Manufacturer Match Hint"
      ),

    safeByPriorStatus:
      countBy(
        safe,
        "Prior MCN Match Status"
      ),

    safeByRule:
      countBy(
        safe,
        "MCN Rule"
      ),

    duplicateInternalIds:
      duplicateIds.length,

    duplicatePartNumbers:
      duplicateParts.length,

    outputs: {
      safePromotions:
        SAFE_PATH,

      conflicts:
        CONFLICT_PATH,

      unresolved:
        UNRESOLVED_PATH,

      overrideAdditions:
        OVERRIDE_PATH,
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
    "===== MCN V8 CENTURY SPRING VALIDATION SUMMARY ====="
  );

  console.log(
    `Input rows:       ${summary.inputRows}`
  );

  console.log(
    `✅ Safe:          ${summary.safePromotions}`
  );

  console.log(
    `⚠️ Conflicts:     ${summary.conflicts}`
  );

  console.log(
    `🔎 Unresolved:    ${summary.unresolved}`
  );

  console.log(
    `Safe rate:        ${summary.safeRate}%`
  );

  console.log("");

  console.log(
    "Safe promotions by manufacturer:"
  );

  console.table(
    summary.safeByManufacturer
  );

  console.log("");

  console.log(
    "Safe promotions by prior status:"
  );

  console.table(
    summary.safeByPriorStatus
  );

  console.log("");

  console.log(
    "Safe promotions by rule:"
  );

  console.table(
    summary.safeByRule
  );

  console.log("");

  console.log(
    `Duplicate Internal IDs: ${summary.duplicateInternalIds}`
  );

  console.log(
    `Duplicate Part Numbers: ${summary.duplicatePartNumbers}`
  );

  console.log("");

  console.log(
    "Outputs:"
  );

  console.log(
    summary.outputs
  );

  console.log("");

  console.log(
    `Summary: ${SUMMARY_PATH}`
  );

  if (
    summary.inputRows === 121 &&
    summary.safePromotions === 121 &&
    summary.conflicts === 0 &&
    summary.unresolved === 0 &&
    summary.safeByManufacturer[
      "Century Spring Corp."
    ] === 121
  ) {
    console.log("");

    console.log(
      "✅ All 121 Century Spring v8 projections passed deterministic validation."
    );

    console.log(
      "✅ V8 override additions are ready for merge preview."
    );
  } else {
    console.log("");

    console.log(
      `⚠️ ${summary.conflicts + summary.unresolved} v8 rows still require review.`
    );

    console.log(
      "Do not merge v8 into the permanent override file yet."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v8 validation failed:",
    err
  );

  process.exit(1);
}
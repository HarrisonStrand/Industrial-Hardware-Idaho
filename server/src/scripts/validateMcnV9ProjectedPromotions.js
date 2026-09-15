// server/src/scripts/validateMcnV9ProjectedPromotions.js
//
// Validates MCN v9 Century Spring A/C projected promotions.
//
// Input:
//   tmp/IHI_MCN_v9_projected_promotions.csv
//
// Outputs:
//   tmp/IHI_MCN_v9_safe_promotions.csv
//   tmp/IHI_MCN_v9_conflicts.csv
//   tmp/IHI_MCN_v9_unresolved.csv
//   tmp/IHI_MCN_v9_override_additions.csv
//   tmp/IHI_MCN_v9_validation_summary.json
//
// Expected batch:
//   Century Spring A-series: 25
//   Century Spring C-series: 26
//   TOTAL:                   51
//
// Accepted relationships:
//   description suffix A + IHI ending 10 -> ###-A
//   description suffix C + IHI ending 30 -> ###-C
//
// Anything else is rejected.

import fs from "fs";
import path from "path";

const INPUT_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "IHI_MCN_v9_projected_promotions.csv"
);

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "tmp"
);

const SAFE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v9_safe_promotions.csv"
);

const CONFLICT_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v9_conflicts.csv"
);

const UNRESOLVED_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v9_unresolved.csv"
);

const OVERRIDE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v9_override_additions.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v9_validation_summary.json"
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
      row.push(
        field.replace(/\r$/, "")
      );

      rows.push(row);

      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(
      field.replace(/\r$/, "")
    );

    rows.push(row);
  }

  return rows.filter((row) =>
    row.some(
      (value) =>
        clean(value) !== ""
    )
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
        .map((header) =>
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
 * ---------------------------------------------------------------------------
 * CENTURY DESCRIPTION PARSER
 * ---------------------------------------------------------------------------
 *
 * Accepted:
 *
 *   SPRING #151A
 *   SPRING #151C
 *
 * Returns:
 *
 *   {
 *     base: "151",
 *     suffix: "A"
 *   }
 */

function parseDescription(
  description = ""
) {
  const value =
    normalized(description);

  const match =
    value.match(
      /^SPRING\s*#\s*(\d+)([AC])$/
    );

  if (!match) {
    return null;
  }

  return {
    base:
      String(
        Number(match[1])
      ),

    suffix:
      match[2],
  };
}

/*
 * ---------------------------------------------------------------------------
 * IHI PART NUMBER PARSER
 * ---------------------------------------------------------------------------
 *
 * Example:
 *
 *   SPR15110
 *
 * becomes:
 *
 *   {
 *     base: "151",
 *     ending: "10"
 *   }
 */

function parseIhiPartNumber(
  partNumber = ""
) {
  const value =
    normalized(partNumber);

  const match =
    value.match(
      /^SPR(\d{3})(\d{2})$/
    );

  if (!match) {
    return null;
  }

  return {
    base:
      String(
        Number(match[1])
      ),

    ending:
      match[2],
  };
}

function expectedEndingForSuffix(
  suffix
) {
  if (suffix === "A") {
    return "10";
  }

  if (suffix === "C") {
    return "30";
  }

  return "";
}

function expectedMcn(
  base,
  suffix
) {
  if (
    !base ||
    !suffix
  ) {
    return "";
  }

  return `${base}-${suffix}`;
}

/*
 * ---------------------------------------------------------------------------
 * ROW VALIDATION
 * ---------------------------------------------------------------------------
 */

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

  const projectedMcn =
    clean(
      row["Projected MCN"]
    );

  const projectedStatus =
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

  const storedBase =
    clean(
      row[
        "V9 Century Base"
      ]
    );

  const storedSuffix =
    normalized(
      row[
        "V9 Century Suffix"
      ]
    );

  const storedEnding =
    clean(
      row[
        "V9 IHI Ending"
      ]
    );

  const evidenceType =
    clean(
      row[
        "V9 Evidence Type"
      ]
    );

  /*
   * ------------------------------------------------------------------------
   * REQUIRED IDENTITY
   * ------------------------------------------------------------------------
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

  if (!projectedMcn) {
    reasons.push(
      "Projected MCN is blank"
    );
  }

  /*
   * ------------------------------------------------------------------------
   * MANUFACTURER
   * ------------------------------------------------------------------------
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
   * ------------------------------------------------------------------------
   * STATUS / RULE / EVIDENCE
   * ------------------------------------------------------------------------
   */

  if (
    projectedStatus !==
    "verified-description-catalog-number"
  ) {
    reasons.push(
      `Unexpected projected status "${projectedStatus}"`
    );
  }

  if (
    rule !==
    "century-spring-published-a-c-series"
  ) {
    reasons.push(
      `Unexpected v9 rule "${rule}"`
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
    "published-century-stock-number-family"
  ) {
    reasons.push(
      `Unexpected evidence type "${evidenceType}"`
    );
  }

  /*
   * ------------------------------------------------------------------------
   * DESCRIPTION PARSING
   * ------------------------------------------------------------------------
   */

  const descriptionInfo =
    parseDescription(
      description
    );

  if (!descriptionInfo) {
    reasons.push(
      `Description "${description}" is not an exact Century Spring #<number>A/C suffix format`
    );
  }

  /*
   * ------------------------------------------------------------------------
   * IHI PART NUMBER PARSING
   * ------------------------------------------------------------------------
   */

  const partInfo =
    parseIhiPartNumber(
      partNumber
    );

  if (!partInfo) {
    reasons.push(
      `IHI part number "${partNumber}" does not match SPR###xx format`
    );
  }

  /*
   * ------------------------------------------------------------------------
   * BASE NUMBER AGREEMENT
   * ------------------------------------------------------------------------
   */

  if (
    descriptionInfo &&
    partInfo &&
    descriptionInfo.base !==
      partInfo.base
  ) {
    reasons.push(
      `Description base ${descriptionInfo.base} does not equal IHI part-number base ${partInfo.base}`
    );
  }

  /*
   * ------------------------------------------------------------------------
   * ACCEPTED SUFFIX / ENDING RELATIONSHIP
   * ------------------------------------------------------------------------
   */

  if (descriptionInfo) {
    const expectedEnding =
      expectedEndingForSuffix(
        descriptionInfo.suffix
      );

    if (!expectedEnding) {
      reasons.push(
        `Unsupported Century suffix "${descriptionInfo.suffix}"`
      );
    }

    if (
      partInfo &&
      expectedEnding &&
      partInfo.ending !==
        expectedEnding
    ) {
      reasons.push(
        `Century suffix ${descriptionInfo.suffix} requires IHI ending ${expectedEnding}, but row has ending ${partInfo.ending}`
      );
    }
  }

  /*
   * ------------------------------------------------------------------------
   * STORED PROJECTION METADATA
   * ------------------------------------------------------------------------
   */

  if (
    descriptionInfo &&
    storedBase !==
      descriptionInfo.base
  ) {
    reasons.push(
      `Stored V9 base "${storedBase}" does not equal description base "${descriptionInfo.base}"`
    );
  }

  if (
    descriptionInfo &&
    storedSuffix !==
      descriptionInfo.suffix
  ) {
    reasons.push(
      `Stored V9 suffix "${storedSuffix}" does not equal description suffix "${descriptionInfo.suffix}"`
    );
  }

  if (
    partInfo &&
    storedEnding !==
      partInfo.ending
  ) {
    reasons.push(
      `Stored V9 IHI ending "${storedEnding}" does not equal parsed ending "${partInfo.ending}"`
    );
  }

  /*
   * ------------------------------------------------------------------------
   * MCN RE-DERIVATION
   * ------------------------------------------------------------------------
   */

  if (descriptionInfo) {
    const independentlyExpectedMcn =
      expectedMcn(
        descriptionInfo.base,
        descriptionInfo.suffix
      );

    if (
      normalized(projectedMcn) !==
      normalized(
        independentlyExpectedMcn
      )
    ) {
      reasons.push(
        `Projected MCN "${projectedMcn}" does not equal independently derived Century catalog number "${independentlyExpectedMcn}"`
      );
    }
  }

  /*
   * ------------------------------------------------------------------------
   * PRIOR CANDIDATE
   * ------------------------------------------------------------------------
   *
   * These were clean-candidate rows before v9.
   * The old candidate must still be the IHI internal part number.
   */

  if (
    normalized(priorCandidate) !==
    normalized(partNumber)
  ) {
    reasons.push(
      `Prior candidate "${priorCandidate}" does not equal IHI part number "${partNumber}"`
    );
  }

  /*
   * ------------------------------------------------------------------------
   * HARD REJECTION OF THE FIVE KNOWN ANOMALOUS RELATIONSHIPS
   * ------------------------------------------------------------------------
   *
   * Even if future edits somehow cause one to enter this file, reject it.
   */

  if (
    descriptionInfo &&
    partInfo
  ) {
    const relationship =
      `${descriptionInfo.suffix}->${partInfo.ending}`;

    if (
      relationship !== "A->10" &&
      relationship !== "C->30"
    ) {
      reasons.push(
        `Rejected Century suffix/encoding relationship ${relationship}`
      );
    }
  }

  if (reasons.length) {
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
      `Century Spring ${projectedMcn} passed independent suffix, IHI encoding, base-number, and catalog-format validation`,
    ],
  };
}

function addAuditFields(
  row,
  validation
) {
  return {
    ...row,

    "V9 Validation Bucket":
      validation.bucket,

    "V9 Validation Notes":
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
      `V9 projected promotion file not found:\n${INPUT_PATH}`
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
      "V9 projected promotion file contains no rows."
    );
  }

  /*
   * ------------------------------------------------------------------------
   * REQUIRED COLUMNS
   * ------------------------------------------------------------------------
   */

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
    "V9 Century Base",
    "V9 Century Suffix",
    "V9 IHI Ending",
    "V9 Evidence Type",
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
   * ------------------------------------------------------------------------
   * STRUCTURAL DUPLICATE SAFETY
   * ------------------------------------------------------------------------
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
      `Duplicate Internal IDs detected in v9 projections: ${duplicateIds
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
      `Duplicate IHI Part Numbers detected in v9 projections: ${duplicateParts
        .slice(0, 10)
        .map(
          ([part]) => part
        )
        .join(", ")}`
    );
  }

  /*
   * ------------------------------------------------------------------------
   * VALIDATE
   * ------------------------------------------------------------------------
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
   * ------------------------------------------------------------------------
   * WRITE AUDIT FILES
   * ------------------------------------------------------------------------
   */

  const auditHeaders = [
    ...parsed.headers,

    "V9 Validation Bucket",

    "V9 Validation Notes",
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
   * ------------------------------------------------------------------------
   * BUILD MERGE-READY OVERRIDE ADDITIONS
   * ------------------------------------------------------------------------
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
   * ------------------------------------------------------------------------
   * SUMMARY
   * ------------------------------------------------------------------------
   */

  const summary = {
    version:
      "MCN-v9-validation",

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

    safeBySuffix:
      countBy(
        safe,
        "V9 Century Suffix"
      ),

    safeByEnding:
      countBy(
        safe,
        "V9 IHI Ending"
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

  /*
   * ------------------------------------------------------------------------
   * TERMINAL OUTPUT
   * ------------------------------------------------------------------------
   */

  console.log("");
  console.log(
    "===== MCN V9 CENTURY SPRING A/C VALIDATION SUMMARY ====="
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
    "Safe promotions by suffix:"
  );

  console.table(
    summary.safeBySuffix
  );

  console.log("");

  console.log(
    "Safe promotions by IHI ending:"
  );

  console.table(
    summary.safeByEnding
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

  console.log("");

  if (
    summary.inputRows === 51 &&
    summary.safePromotions === 51 &&
    summary.conflicts === 0 &&
    summary.unresolved === 0 &&
    summary.safeBySuffix.A === 25 &&
    summary.safeBySuffix.C === 26 &&
    summary.safeByEnding["10"] === 25 &&
    summary.safeByEnding["30"] === 26
  ) {
    console.log(
      "✅ All 51 Century Spring v9 projections passed deterministic validation."
    );

    console.log(
      "✅ 25 A-series + 26 C-series overrides are ready for merge preview."
    );
  } else {
    console.log(
      `⚠️ ${summary.conflicts + summary.unresolved} v9 rows still require review.`
    );

    console.log(
      "Do not merge v9 into the permanent override file yet."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v9 validation failed:",
    err
  );

  process.exit(1);
}
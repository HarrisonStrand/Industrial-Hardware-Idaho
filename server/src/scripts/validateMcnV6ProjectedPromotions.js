// server/src/scripts/validateMcnV6ProjectedPromotions.js
//
// Validates MCN v6 Hindley projected promotions.
//
// Input:
//   tmp/IHI_MCN_v6_projected_promotions.csv
//
// Outputs:
//   tmp/IHI_MCN_v6_safe_promotions.csv
//   tmp/IHI_MCN_v6_conflicts.csv
//   tmp/IHI_MCN_v6_unresolved.csv
//   tmp/IHI_MCN_v6_override_additions.csv
//   tmp/IHI_MCN_v6_validation_summary.json
//
// Expected current batch:
//   Hindley: 161

import fs from "fs";
import path from "path";

const INPUT_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "IHI_MCN_v6_projected_promotions.csv"
);

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "tmp"
);

const SAFE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v6_safe_promotions.csv"
);

const CONFLICT_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v6_conflicts.csv"
);

const UNRESOLVED_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v6_unresolved.csv"
);

const OVERRIDE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v6_override_additions.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v6_validation_summary.json"
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
 * Only extract five-digit #numbers.
 *
 * We intentionally ignore:
 *
 *   #6
 *   #8
 *   #10
 *
 * because those can be screw sizes, gauges, etc.
 */
function extractFiveDigitHashNumbers(description = "") {
  const matches = [];

  const regex =
    /#\s*(\d{5})\b/g;

  let match;

  while (
    (match = regex.exec(description)) !== null
  ) {
    matches.push(match[1]);
  }

  return matches;
}

function getSingleDescriptionCatalogNumber(description = "") {
  const matches =
    extractFiveDigitHashNumbers(
      description
    );

  if (matches.length !== 1) {
    return "";
  }

  return matches[0];
}

function isValidHindleyCatalogNumber(value = "") {
  const candidate =
    clean(value);

  if (!/^\d{5}$/.test(candidate)) {
    return false;
  }

  const numeric =
    Number(candidate);

  return (
    Number.isInteger(numeric) &&
    numeric >= 10000 &&
    numeric <= 14999
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

  const evidenceType =
    clean(
      row[
        "V6 Evidence Type"
      ]
    );

  /*
   * ------------------------------------------------------------
   * REQUIRED IDENTITY FIELDS
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
   * MANUFACTURER
   * ------------------------------------------------------------
   */

  if (
    manufacturer !== "Hindley"
  ) {
    reasons.push(
      `Manufacturer hint is "${manufacturer}", expected Hindley`
    );
  }

  /*
   * ------------------------------------------------------------
   * RULE
   * ------------------------------------------------------------
   */

  if (
    rule !==
    "hindley-description-five-digit-catalog-number"
  ) {
    reasons.push(
      `Unexpected MCN rule "${rule}"`
    );
  }

  /*
   * ------------------------------------------------------------
   * PROJECTED STATUS
   * ------------------------------------------------------------
   */

  if (
    projectedStatus !==
    "verified-description-catalog-number"
  ) {
    reasons.push(
      `Unexpected projected status "${projectedStatus}"`
    );
  }

  /*
   * ------------------------------------------------------------
   * PRIOR STATUS
   * ------------------------------------------------------------
   */

  if (
    ![
      "unverified-clean-candidate",
      "possible-secondary-token",
      "needs-review",
    ].includes(
      priorStatus
    )
  ) {
    reasons.push(
      `Unexpected prior review status "${priorStatus}"`
    );
  }

  /*
   * ------------------------------------------------------------
   * CATALOG NUMBER SHAPE
   * ------------------------------------------------------------
   */

  if (
    !isValidHindleyCatalogNumber(
      projected
    )
  ) {
    reasons.push(
      `Projected Hindley MCN "${projected}" is not a valid five-digit 10000–14999 catalog number`
    );
  }

  /*
   * ------------------------------------------------------------
   * DESCRIPTION EVIDENCE
   * ------------------------------------------------------------
   *
   * Every v6 promotion MUST have exactly one five-digit #number
   * in the description, and that number must equal the projected MCN.
   */

  const descriptionCatalog =
    getSingleDescriptionCatalogNumber(
      description
    );

  if (!descriptionCatalog) {
    reasons.push(
      "Description does not contain exactly one five-digit #catalog number"
    );
  } else if (
    normalized(descriptionCatalog) !==
    normalized(projected)
  ) {
    reasons.push(
      `Description catalog #${descriptionCatalog} does not equal projected MCN ${projected}`
    );
  }

  /*
   * ------------------------------------------------------------
   * EVIDENCE-TYPE VALIDATION
   * ------------------------------------------------------------
   */

  if (
    evidenceType ===
    "description-and-ihi-suffix"
  ) {
    if (
      !normalized(partNumber).endsWith(
        normalized(projected)
      )
    ) {
      reasons.push(
        `Evidence says IHI part number ends with ${projected}, but part number is "${partNumber}"`
      );
    }
  }

  else if (
    evidenceType ===
    "description-and-prior-candidate"
  ) {
    if (
      normalized(priorCandidate) !==
      normalized(projected)
    ) {
      reasons.push(
        `Prior candidate ${priorCandidate || "(blank)"} does not equal projected MCN ${projected}`
      );
    }
  }

  else if (
    evidenceType ===
    "explicit-description-catalog-number"
  ) {
    /*
     * Description evidence alone is allowed here because
     * the explicit #catalog number is our primary evidence.
     */
  }

  else {
    reasons.push(
      `Unknown V6 evidence type "${evidenceType || "(blank)"}"`
    );
  }

  /*
   * ------------------------------------------------------------
   * CONFLICT CHECK
   * ------------------------------------------------------------
   *
   * If the old system already proposed a candidate and that
   * candidate conflicts with the explicit Hindley description
   * catalog number, we do NOT automatically reject it.
   *
   * The old candidate may simply have been the IHI/internal number.
   *
   * However, when the row was specifically classified as
   * description-and-prior-candidate, they must agree.
   */

  const conflictingPriorCandidate =
    priorCandidate &&
    normalized(priorCandidate) !==
      normalized(projected);

  if (
    conflictingPriorCandidate &&
    evidenceType ===
      "description-and-prior-candidate"
  ) {
    return {
      bucket:
        "conflict",

      reasons: [
        ...reasons,

        `Projected Hindley MCN ${projected} conflicts with prior candidate ${priorCandidate}`,
      ],
    };
  }

  /*
   * ------------------------------------------------------------
   * RESULT
   * ------------------------------------------------------------
   */

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
      `Explicit Hindley description catalog #${projected} passed deterministic v6 validation`,
    ],
  };
}

function addAuditFields(
  row,
  validation
) {
  return {
    ...row,

    "V6 Validation Bucket":
      validation.bucket,

    "V6 Validation Notes":
      validation.reasons.join(
        "; "
      ),
  };
}

function countBy(rows, field) {
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

function findDuplicates(rows, field) {
  const map =
    new Map();

  for (
    let i = 0;
    i < rows.length;
    i += 1
  ) {
    const value =
      normalized(
        rows[i][field]
      );

    if (!value) {
      continue;
    }

    if (!map.has(value)) {
      map.set(
        value,
        []
      );
    }

    map.get(
      value
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
      `V6 projected promotion file not found:\n${INPUT_PATH}`
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
      "V6 projected promotion file contains no data rows."
    );
  }

  /*
   * ------------------------------------------------------------
   * REQUIRED COLUMNS
   * ------------------------------------------------------------
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
    "V6 Evidence Type",
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
      `Duplicate Internal IDs detected in v6 projections: ${duplicateIds
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
      `Duplicate IHI Part Numbers detected in v6 projections: ${duplicateParts
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
   * WRITE VALIDATION OUTPUTS
   * ------------------------------------------------------------
   */

  const auditHeaders = [
    ...parsed.headers,

    "V6 Validation Bucket",

    "V6 Validation Notes",
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
      "MCN-v6-Hindley-validation",

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

    safeByEvidenceType:
      countBy(
        safe,
        "V6 Evidence Type"
      ),

    conflictsByEvidenceType:
      countBy(
        conflicts,
        "V6 Evidence Type"
      ),

    unresolvedByEvidenceType:
      countBy(
        unresolved,
        "V6 Evidence Type"
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
   * ------------------------------------------------------------
   * TERMINAL OUTPUT
   * ------------------------------------------------------------
   */

  console.log("");
  console.log(
    "===== MCN V6 HINDLEY VALIDATION SUMMARY ====="
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
    "Safe promotions by evidence:"
  );

  console.table(
    summary.safeByEvidenceType
  );

  console.log("");

  console.log(
    "Conflicts by evidence:"
  );

  console.table(
    summary.conflictsByEvidenceType
  );

  console.log("");

  console.log(
    "Unresolved by evidence:"
  );

  console.table(
    summary.unresolvedByEvidenceType
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
    summary.inputRows === 161 &&
    summary.safePromotions === 161 &&
    summary.conflicts === 0 &&
    summary.unresolved === 0
  ) {
    console.log("");
    console.log(
      "✅ All 161 Hindley v6 projections passed deterministic validation."
    );

    console.log(
      "✅ V6 override additions are ready for merge preview."
    );
  } else {
    console.log("");
    console.log(
      `⚠️ ${summary.conflicts + summary.unresolved} v6 rows still require review.`
    );

    console.log(
      "Do not merge v6 into the permanent override file yet."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v6 validation failed:",
    err
  );

  process.exit(1);
}
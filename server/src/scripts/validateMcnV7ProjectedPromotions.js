// server/src/scripts/validateMcnV7ProjectedPromotions.js
//
// Validates MCN v7 exact-catalog projected promotions.
//
// Input:
//   tmp/IHI_MCN_v7_projected_promotions.csv
//
// Outputs:
//   tmp/IHI_MCN_v7_safe_promotions.csv
//   tmp/IHI_MCN_v7_conflicts.csv
//   tmp/IHI_MCN_v7_unresolved.csv
//   tmp/IHI_MCN_v7_override_additions.csv
//   tmp/IHI_MCN_v7_validation_summary.json
//
// Expected batch:
//   Hillsdale Terminal: 49
//   Hindley:             4
//   TOTAL:              53

import fs from "fs";
import path from "path";

const INPUT_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "IHI_MCN_v7_projected_promotions.csv"
);

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "tmp"
);

const SAFE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v7_safe_promotions.csv"
);

const CONFLICT_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v7_conflicts.csv"
);

const UNRESOLVED_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v7_unresolved.csv"
);

const OVERRIDE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v7_override_additions.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v7_validation_summary.json"
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

  if (
    /[",\r\n]/.test(text)
  ) {
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
 * =============================================================================
 * VERIFIED V7 CATALOG SETS
 * =============================================================================
 */

const HILLSDALE_VERIFIED_CATALOG_NUMBERS =
  new Set([
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

const HINDLEY_VERIFIED_ROWS =
  new Map([
    [
      "EYBL020 11101",
      {
        mcn: "11101",

        expectedPriorStatus:
          "possible-secondary-token",

        expectedPriorCandidate:
          "11101",

        descriptionPattern:
          /EYE LAG.*1\/4X3-3\/4/i,
      },
    ],

    [
      "EYBL040 11104",
      {
        mcn: "11104",

        expectedPriorStatus:
          "possible-secondary-token",

        expectedPriorCandidate:
          "11104",

        descriptionPattern:
          /EYE LAG.*5\/16X4/i,
      },
    ],

    [
      "EYBL080 11095",
      {
        mcn: "11095",

        expectedPriorStatus:
          "possible-secondary-token",

        expectedPriorCandidate:
          "11095",

        descriptionPattern:
          /EYE LAG.*3\/8X6/i,
      },
    ],

    [
      "SSEYB 14322",
      {
        mcn: "14322",

        expectedPriorStatus:
          "needs-review",

        expectedPriorCandidate:
          "",

        descriptionPattern:
          /S\/S EYE BOLT.*3\/8X4/i,
      },
    ],
  ]);

/*
 * =============================================================================
 * HILLSDALE VALIDATION
 * =============================================================================
 */

function validateHillsdale(row) {
  const reasons = [];

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

  const evidenceType =
    clean(
      row[
        "V7 Evidence Type"
      ]
    );

  if (
    sourceVendor !==
    "Greenlite / Hillsdale"
  ) {
    reasons.push(
      `Source vendor is "${sourceVendor}", expected Greenlite / Hillsdale`
    );
  }

  if (
    manufacturer !==
    "Hillsdale Terminal"
  ) {
    reasons.push(
      `Manufacturer hint is "${manufacturer}", expected Hillsdale Terminal`
    );
  }

  if (
    status !==
    "verified-current-manufacturer-number"
  ) {
    reasons.push(
      `Unexpected projected status "${status}"`
    );
  }

  if (
    rule !==
    "hillsdale-published-catalog-whitelist"
  ) {
    reasons.push(
      `Unexpected Hillsdale rule "${rule}"`
    );
  }

  if (
    evidenceType !==
    "exact-published-manufacturer-number"
  ) {
    reasons.push(
      `Unexpected evidence type "${evidenceType}"`
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
    normalized(priorCandidate) !==
    normalized(partNumber)
  ) {
    reasons.push(
      `Prior candidate "${priorCandidate}" does not equal IHI part number "${partNumber}"`
    );
  }

  if (
    normalized(projected) !==
    normalized(partNumber)
  ) {
    reasons.push(
      `Projected MCN "${projected}" does not equal exact IHI catalog number "${partNumber}"`
    );
  }

  if (
    !HILLSDALE_VERIFIED_CATALOG_NUMBERS.has(
      normalized(projected)
    )
  ) {
    reasons.push(
      `Projected Hillsdale MCN "${projected}" is not in the verified v7 whitelist`
    );
  }

  return reasons;
}

/*
 * =============================================================================
 * HINDLEY VALIDATION
 * =============================================================================
 */

function validateHindley(row) {
  const reasons = [];

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

  const description =
    clean(
      row[
        "IHI Description"
      ]
    );

  const evidenceType =
    clean(
      row[
        "V7 Evidence Type"
      ]
    );

  const definition =
    HINDLEY_VERIFIED_ROWS.get(
      normalized(partNumber)
    );

  if (!definition) {
    reasons.push(
      `IHI part number "${partNumber}" is not one of the four verified Hindley v7 rows`
    );

    return reasons;
  }

  if (
    sourceVendor !==
    "Hindley"
  ) {
    reasons.push(
      `Source vendor is "${sourceVendor}", expected Hindley`
    );
  }

  if (
    manufacturer !==
    "Hindley"
  ) {
    reasons.push(
      `Manufacturer hint is "${manufacturer}", expected Hindley`
    );
  }

  if (
    status !==
    "verified-secondary-token"
  ) {
    reasons.push(
      `Unexpected projected status "${status}"`
    );
  }

  if (
    rule !==
    "hindley-published-catalog-whitelist"
  ) {
    reasons.push(
      `Unexpected Hindley rule "${rule}"`
    );
  }

  if (
    evidenceType !==
    "exact-published-manufacturer-number"
  ) {
    reasons.push(
      `Unexpected evidence type "${evidenceType}"`
    );
  }

  if (
    normalized(projected) !==
    normalized(definition.mcn)
  ) {
    reasons.push(
      `Projected MCN "${projected}" does not equal verified Hindley MCN "${definition.mcn}"`
    );
  }

  if (
    priorStatus !==
    definition.expectedPriorStatus
  ) {
    reasons.push(
      `Prior status "${priorStatus}" does not equal expected "${definition.expectedPriorStatus}"`
    );
  }

  if (
    normalized(priorCandidate) !==
    normalized(
      definition.expectedPriorCandidate
    )
  ) {
    reasons.push(
      `Prior candidate "${priorCandidate}" does not equal expected "${definition.expectedPriorCandidate}"`
    );
  }

  if (
    !definition.descriptionPattern.test(
      description
    )
  ) {
    reasons.push(
      `IHI description does not match expected Hindley dimensions for ${definition.mcn}`
    );
  }

  return reasons;
}

/*
 * =============================================================================
 * ROW VALIDATION
 * =============================================================================
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

  const projected =
    clean(
      row["Projected MCN"]
    );

  const manufacturer =
    clean(
      row[
        "Manufacturer Match Hint"
      ]
    );

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

  let manufacturerReasons = [];

  if (
    manufacturer ===
    "Hillsdale Terminal"
  ) {
    manufacturerReasons =
      validateHillsdale(row);
  }

  else if (
    manufacturer ===
    "Hindley"
  ) {
    manufacturerReasons =
      validateHindley(row);
  }

  else {
    manufacturerReasons.push(
      `Unknown v7 manufacturer "${manufacturer || "(blank)"}"`
    );
  }

  reasons.push(
    ...manufacturerReasons
  );

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
      `V7 exact catalog validation passed for ${manufacturer} MCN ${projected}`,
    ],
  };
}

function addAuditFields(
  row,
  validation
) {
  return {
    ...row,

    "V7 Validation Bucket":
      validation.bucket,

    "V7 Validation Notes":
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
      `V7 projected promotion file not found:\n${INPUT_PATH}`
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
      "V7 projected promotion file contains no rows."
    );
  }

  /*
   * --------------------------------------------------------------------------
   * REQUIRED COLUMNS
   * --------------------------------------------------------------------------
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
    "V7 Evidence Type",
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
   * --------------------------------------------------------------------------
   * DUPLICATE SAFETY
   * --------------------------------------------------------------------------
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
      `Duplicate Internal IDs detected in v7 projections: ${duplicateIds
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
      `Duplicate IHI Part Numbers detected in v7 projections: ${duplicateParts
        .slice(0, 10)
        .map(
          ([part]) => part
        )
        .join(", ")}`
    );
  }

  /*
   * --------------------------------------------------------------------------
   * VALIDATE
   * --------------------------------------------------------------------------
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
   * --------------------------------------------------------------------------
   * WRITE VALIDATION FILES
   * --------------------------------------------------------------------------
   */

  const auditHeaders = [
    ...parsed.headers,

    "V7 Validation Bucket",

    "V7 Validation Notes",
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
   * --------------------------------------------------------------------------
   * BUILD PERMANENT OVERRIDE ADDITIONS
   * --------------------------------------------------------------------------
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
   * --------------------------------------------------------------------------
   * SUMMARY
   * --------------------------------------------------------------------------
   */

  const summary = {
    version:
      "MCN-v7-validation",

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

    unresolvedByManufacturer:
      countBy(
        unresolved,
        "Manufacturer Match Hint"
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
   * --------------------------------------------------------------------------
   * TERMINAL OUTPUT
   * --------------------------------------------------------------------------
   */

  console.log("");
  console.log(
    "===== MCN V7 VALIDATION SUMMARY ====="
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
    "Unresolved by manufacturer:"
  );

  console.table(
    summary.unresolvedByManufacturer
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
    summary.inputRows === 53 &&
    summary.safePromotions === 53 &&
    summary.conflicts === 0 &&
    summary.unresolved === 0 &&
    summary.safeByManufacturer[
      "Hillsdale Terminal"
    ] === 49 &&
    summary.safeByManufacturer[
      "Hindley"
    ] === 4
  ) {
    console.log("");

    console.log(
      "✅ All 53 v7 projections passed deterministic validation."
    );

    console.log(
      "✅ 49 Hillsdale + 4 Hindley overrides are ready for merge preview."
    );
  } else {
    console.log("");

    console.log(
      `⚠️ ${summary.conflicts + summary.unresolved} v7 rows still require review.`
    );

    console.log(
      "Do not merge v7 into the permanent override file yet."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v7 validation failed:",
    err
  );

  process.exit(1);
}
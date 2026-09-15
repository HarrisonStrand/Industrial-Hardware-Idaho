// server/src/scripts/validateMcnV5ProjectedPromotions.js
//
// Validates the conservative MCN v5 projected promotion batch.
//
// Input:
//   tmp/IHI_MCN_v5_projected_promotions.csv
//
// Outputs:
//   tmp/IHI_MCN_v5_safe_promotions.csv
//   tmp/IHI_MCN_v5_conflicts.csv
//   tmp/IHI_MCN_v5_unresolved.csv
//   tmp/IHI_MCN_v5_override_additions.csv
//   tmp/IHI_MCN_v5_validation_summary.json
//
// Expected current batch:
//   CGW                  154
//   Century Spring Corp.  94
//   DeWalt/Powers          20
//   Vega                   19
//   TOTAL                 287

import fs from "fs";
import path from "path";

const INPUT_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "IHI_MCN_v5_projected_promotions.csv"
);

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "tmp"
);

const SAFE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v5_safe_promotions.csv"
);

const CONFLICT_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v5_conflicts.csv"
);

const UNRESOLVED_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v5_unresolved.csv"
);

const OVERRIDE_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v5_override_additions.csv"
);

const SUMMARY_PATH = path.join(
  OUTPUT_DIR,
  "IHI_MCN_v5_validation_summary.json"
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

function extractHashTokens(description = "") {
  const tokens = [];

  const regex =
    /#\s*([A-Z0-9][A-Z0-9._/-]*)/gi;

  let match;

  while (
    (match = regex.exec(description)) !== null
  ) {
    tokens.push(
      clean(match[1])
    );
  }

  return tokens;
}

function getSingleFiveDigitHash(description = "") {
  const tokens =
    extractHashTokens(description);

  if (tokens.length !== 1) {
    return "";
  }

  if (!/^\d{5}$/.test(tokens[0])) {
    return "";
  }

  return tokens[0];
}

function getSingleHash(description = "") {
  const tokens =
    extractHashTokens(description);

  if (tokens.length !== 1) {
    return "";
  }

  return tokens[0];
}

const DEWALT_DROPIN_POWERS_NUMBERS =
  new Set([
    "06204",
    "06206",
    "06208",
    "06210",

    "06304",
    "06306",
    "06308",
    "06312",
    "06320",

    "06305",
    "06307",
    "06309",
    "06311",
    "06313",

    "06322",
    "06335",

    "06323",
    "06336",
  ]);

const DEWALT_ACCU_BITS =
  new Set([
    "DWA5491",
    "DWA5492",
  ]);

function validateCgw(row) {
  const projected =
    clean(
      row["Projected MCN"]
    );

  const description =
    clean(
      row["IHI Description"]
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

  const reasons = [];

  if (
    manufacturer !== "CGW"
  ) {
    reasons.push(
      `Manufacturer hint is "${manufacturer}", expected CGW`
    );
  }

  if (
    status !==
    "verified-description-catalog-number"
  ) {
    reasons.push(
      `Unexpected projected status "${status}"`
    );
  }

  if (
    !/^\d{5}$/.test(projected)
  ) {
    reasons.push(
      `Projected CGW MCN "${projected}" is not exactly five digits`
    );
  }

  const descriptionCatalog =
    getSingleFiveDigitHash(
      description
    );

  if (!descriptionCatalog) {
    reasons.push(
      "Description does not contain exactly one five-digit #catalog number"
    );
  } else if (
    normalized(
      descriptionCatalog
    ) !==
    normalized(projected)
  ) {
    reasons.push(
      `Description catalog #${descriptionCatalog} does not equal projected MCN ${projected}`
    );
  }

  return reasons;
}

function validateCenturySpring(row) {
  const projected =
    clean(
      row["Projected MCN"]
    );

  const partNumber =
    clean(
      row["IHI Part Number"]
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

  const priorCandidate =
    clean(
      row[
        "Prior MCN Candidate"
      ]
    );

  const reasons = [];

  if (
    manufacturer !==
    "Century Spring Corp."
  ) {
    reasons.push(
      `Manufacturer hint is "${manufacturer}", expected Century Spring Corp.`
    );
  }

  if (
    status !==
    "verified-manufacturer-family"
  ) {
    reasons.push(
      `Unexpected projected status "${status}"`
    );
  }

  if (
    !/^C-\d+$/i.test(projected)
  ) {
    reasons.push(
      `Projected Century Spring MCN "${projected}" does not match C-### family`
    );
  }

  if (
    normalized(projected) !==
    normalized(partNumber)
  ) {
    reasons.push(
      `Projected MCN ${projected} does not equal IHI part number ${partNumber}`
    );
  }

  /*
   * Because these started as clean candidates,
   * their prior candidate should normally be the
   * same C-### number.
   */
  if (
    priorCandidate &&
    normalized(priorCandidate) !==
      normalized(projected)
  ) {
    reasons.push(
      `Prior candidate ${priorCandidate} disagrees with Century Spring projected MCN ${projected}`
    );
  }

  return reasons;
}

function validateVega(row) {
  const projected =
    clean(
      row["Projected MCN"]
    );

  const description =
    clean(
      row["IHI Description"]
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

  const priorCandidate =
    clean(
      row[
        "Prior MCN Candidate"
      ]
    );

  const reasons = [];

  if (
    manufacturer !== "Vega"
  ) {
    reasons.push(
      `Manufacturer hint is "${manufacturer}", expected Vega`
    );
  }

  if (
    status !==
    "verified-description-catalog-number"
  ) {
    reasons.push(
      `Unexpected projected status "${status}"`
    );
  }

  if (!projected) {
    reasons.push(
      "Projected Vega MCN is blank"
    );
  }

  if (
    normalized(priorCandidate) !==
    normalized(projected)
  ) {
    reasons.push(
      `Prior candidate ${priorCandidate || "(blank)"} does not equal projected Vega MCN ${projected}`
    );
  }

  const hash =
    getSingleHash(
      description
    );

  if (!hash) {
    reasons.push(
      "Vega description does not contain exactly one #catalog token"
    );
  } else if (
    normalized(hash) !==
    normalized(projected)
  ) {
    reasons.push(
      `Description #catalog ${hash} does not equal projected Vega MCN ${projected}`
    );
  }

  return reasons;
}

function validateDewaltDropin(row) {
  const projected =
    clean(
      row["Projected MCN"]
    );

  const partNumber =
    clean(
      row["IHI Part Number"]
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

  const reasons = [];

  if (
    manufacturer !==
    "DeWalt/Powers"
  ) {
    reasons.push(
      `Manufacturer hint is "${manufacturer}", expected DeWalt/Powers`
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

  const match =
    partNumber.match(
      /^DI\s+(\d{5})$/i
    );

  if (!match) {
    reasons.push(
      `IHI part number "${partNumber}" does not match DI ##### format`
    );

    return reasons;
  }

  const base =
    match[1];

  if (
    !DEWALT_DROPIN_POWERS_NUMBERS.has(
      base
    )
  ) {
    reasons.push(
      `DeWalt/Powers base number ${base} is not in the verified Dropin whitelist`
    );
  }

  const expected =
    `${base}-PWR`;

  if (
    normalized(projected) !==
    normalized(expected)
  ) {
    reasons.push(
      `Projected MCN ${projected} does not equal expected ${expected}`
    );
  }

  return reasons;
}

function validateDewaltAccuBit(row) {
  const projected =
    clean(
      row["Projected MCN"]
    );

  const partNumber =
    clean(
      row["IHI Part Number"]
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

  const reasons = [];

  if (
    manufacturer !==
    "DeWalt/Powers"
  ) {
    reasons.push(
      `Manufacturer hint is "${manufacturer}", expected DeWalt/Powers`
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

  const match =
    partNumber.match(
      /^DI\s+(DWA549[12])$/i
    );

  if (!match) {
    reasons.push(
      `IHI part number "${partNumber}" does not match DI DWA5491/DWA5492 format`
    );

    return reasons;
  }

  const expected =
    match[1].toUpperCase();

  if (
    !DEWALT_ACCU_BITS.has(
      expected
    )
  ) {
    reasons.push(
      `${expected} is not in the verified DEWALT Accu-Bit whitelist`
    );
  }

  if (
    normalized(projected) !==
    normalized(expected)
  ) {
    reasons.push(
      `Projected MCN ${projected} does not equal expected ${expected}`
    );
  }

  /*
   * These numbers intentionally do NOT get -PWR.
   */
  if (
    /-PWR$/i.test(projected)
  ) {
    reasons.push(
      "DEWALT DWA5491/DWA5492 Accu-Bit MCNs must not receive -PWR suffix"
    );
  }

  return reasons;
}

function validateRow(row) {
  const rule =
    clean(
      row["MCN Rule"]
    );

  const projected =
    clean(
      row["Projected MCN"]
    );

  const priorStatus =
    clean(
      row[
        "Prior MCN Match Status"
      ]
    );

  const basicReasons = [];

  if (!projected) {
    basicReasons.push(
      "Projected MCN is blank"
    );
  }

  if (
    !clean(
      row["Internal ID"]
    )
  ) {
    basicReasons.push(
      "Internal ID is blank"
    );
  }

  if (
    !clean(
      row["IHI Part Number"]
    )
  ) {
    basicReasons.push(
      "IHI Part Number is blank"
    );
  }

  if (
    ![
      "unverified-clean-candidate",
      "possible-secondary-token",
      "needs-review",
    ].includes(
      priorStatus
    )
  ) {
    basicReasons.push(
      `Unexpected prior review status "${priorStatus}"`
    );
  }

  let ruleReasons = [];

  switch (rule) {
    case "cgw-description-five-digit-catalog-number":
      ruleReasons =
        validateCgw(row);
      break;

    case "century-spring-c-series":
      ruleReasons =
        validateCenturySpring(row);
      break;

    case "vega-description-catalog-number":
      ruleReasons =
        validateVega(row);
      break;

    case "dewalt-powers-current-dropin-catalog":
      ruleReasons =
        validateDewaltDropin(row);
      break;

    case "dewalt-current-accubit-catalog":
      ruleReasons =
        validateDewaltAccuBit(row);
      break;

    default:
      ruleReasons.push(
        `Unknown v5 validation rule "${rule || "(blank)"}"`
      );
      break;
  }

  const reasons = [
    ...basicReasons,
    ...ruleReasons,
  ];

  /*
   * Century Spring and Vega should normally agree
   * with their previous candidate.
   *
   * A disagreement there is treated as a conflict.
   *
   * CGW and DeWalt may intentionally supersede a
   * weak prior candidate, so disagreements are not
   * automatically conflicts for those rules.
   */
  const priorCandidate =
    clean(
      row[
        "Prior MCN Candidate"
      ]
    );

  const priorDisagreement =
    priorCandidate &&
    normalized(priorCandidate) !==
      normalized(projected);

  const priorShouldAgree =
    [
      "century-spring-c-series",
      "vega-description-catalog-number",
    ].includes(rule);

  if (
    priorDisagreement &&
    priorShouldAgree
  ) {
    return {
      bucket:
        "conflict",

      reasons: [
        ...reasons,
        `Projected MCN ${projected} conflicts with prior candidate ${priorCandidate}`,
      ],
    };
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
      `V5 rule ${rule} passed deterministic validation`,
    ],
  };
}

function addAuditFields(
  row,
  validation
) {
  return {
    ...row,

    "V5 Validation Bucket":
      validation.bucket,

    "V5 Validation Notes":
      validation.reasons.join("; "),
  };
}

function countBy(rows, key) {
  const counts = {};

  for (const row of rows) {
    const value =
      clean(row[key]) ||
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

function checkDuplicates(rows) {
  const ids =
    new Map();

  const parts =
    new Map();

  for (const row of rows) {
    const id =
      normalized(
        row["Internal ID"]
      );

    const part =
      normalized(
        row[
          "IHI Part Number"
        ]
      );

    if (id) {
      if (!ids.has(id)) {
        ids.set(id, []);
      }

      ids.get(id).push(row);
    }

    if (part) {
      if (!parts.has(part)) {
        parts.set(part, []);
      }

      parts.get(part).push(row);
    }
  }

  const duplicateIds =
    Array.from(
      ids.entries()
    ).filter(
      ([, values]) =>
        values.length > 1
    );

  const duplicateParts =
    Array.from(
      parts.entries()
    ).filter(
      ([, values]) =>
        values.length > 1
    );

  return {
    duplicateIds,
    duplicateParts,
  };
}

function main() {
  if (
    !fs.existsSync(
      INPUT_PATH
    )
  ) {
    throw new Error(
      `Input file not found:\n${INPUT_PATH}`
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
      "V5 projected promotion file contains no data rows."
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

  /*
   * ------------------------------------------------------------
   * DUPLICATE SAFETY CHECK
   * ------------------------------------------------------------
   */

  const duplicates =
    checkDuplicates(
      parsed.rows
    );

  if (
    duplicates
      .duplicateIds
      .length
  ) {
    const ids =
      duplicates
        .duplicateIds
        .slice(0, 10)
        .map(
          ([id]) =>
            id
        )
        .join(", ");

    throw new Error(
      `Duplicate Internal IDs detected in v5 projections: ${ids}`
    );
  }

  if (
    duplicates
      .duplicateParts
      .length
  ) {
    const parts =
      duplicates
        .duplicateParts
        .slice(0, 10)
        .map(
          ([part]) =>
            part
        )
        .join(", ");

    throw new Error(
      `Duplicate IHI Part Numbers detected in v5 projections: ${parts}`
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
    } else if (
      validation.bucket ===
      "conflict"
    ) {
      conflicts.push(
        audited
      );
    } else {
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
    "V5 Validation Bucket",
    "V5 Validation Notes",
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
      "MCN-v5-validation",

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

    safeByRule:
      countBy(
        safe,
        "MCN Rule"
      ),

    conflictsByManufacturer:
      countBy(
        conflicts,
        "Manufacturer Match Hint"
      ),

    unresolvedByManufacturer:
      countBy(
        unresolved,
        "Manufacturer Match Hint"
      ),

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
   * TERMINAL SUMMARY
   * ------------------------------------------------------------
   */

  console.log("");
  console.log(
    "===== MCN V5 VALIDATION SUMMARY ====="
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
    "Safe promotions by rule:"
  );

  console.table(
    summary.safeByRule
  );

  console.log("");
  console.log(
    "Conflicts by manufacturer:"
  );

  console.table(
    summary.conflictsByManufacturer
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
    summary.conflicts === 0 &&
    summary.unresolved === 0
  ) {
    console.log("");
    console.log(
      "✅ All v5 projected MCNs passed deterministic validation."
    );

    console.log(
      "✅ V5 override additions are ready for merge into the permanent MCN override file."
    );
  } else {
    console.log("");
    console.log(
      `⚠️ ${summary.conflicts + summary.unresolved} v5 rows still require review before merge.`
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v5 validation failed:",
    err
  );

  process.exit(1);
}
import fs from "fs";
import path from "path";

const DEFAULT_INPUT = path.resolve(
  process.cwd(),
  "tmp",
  "IHI_MCN_v4_projected_promotions.csv"
);

const inputPath = path.resolve(process.argv[2] || DEFAULT_INPUT);
const outputDir = path.resolve(process.argv[3] || path.dirname(inputPath));

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

  return rows.filter((r) =>
    r.some((value) => clean(value) !== "")
  );
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

function rowsToObjects(rows) {
  if (!rows.length) return [];

  const headers = rows[0].map(clean);

  return rows.slice(1).map((values) => {
    const obj = {};

    for (let i = 0; i < headers.length; i += 1) {
      obj[headers[i]] = values[i] ?? "";
    }

    return obj;
  });
}

function tokenAppears(haystack = "", needle = "") {
  const source = normalized(haystack);
  const target = normalized(needle);

  if (!source || !target) return false;

  const escaped = target.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const regex = new RegExp(
    `(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`,
    "i"
  );

  return regex.test(source);
}

function canonicalCandidate(value = "", row = {}) {
  let candidate = normalized(value)
    .replace(/^#/, "");

  const rule = clean(
    row["MCN Rule"] ||
    row["V4 Rule"] ||
    row["Rule"] ||
    row["Promotion Rule"] ||
    row["Projected Rule"] ||
    ""
  ).toLowerCase();

  const manufacturer = clean(
    row["Manufacturer Match Hint"]
  ).toLowerCase();

  /*
   * Marson Fishbowl/internal numbers may contain
   * an IHI-side M prefix such as M47350.
   *
   * The actual manufacturer catalog number is 47350.
   */
  if (
    (
      rule.startsWith("marson-") ||
      manufacturer === "marson"
    ) &&
    /^M\d{5}$/.test(candidate)
  ) {
    candidate = candidate.slice(1);
  }

  return candidate;
}

function getEffectiveRule(row = {}) {
  const explicitRule = clean(
    row["MCN Rule"] ||
    row["V4 Rule"] ||
    row["Rule"] ||
    row["Promotion Rule"] ||
    row["Projected Rule"] ||
    ""
  );

  if (explicitRule) {
    return explicitRule;
  }

  const status = clean(
    row["Projected MCN Match Status"]
  );

  if (
    status ===
    "verified-description-catalog-number"
  ) {
    return "description-catalog-number";
  }

  if (
    status ===
    "verified-secondary-token"
  ) {
    return "secondary-token";
  }

  if (
    status ===
    "verified-manufacturer-family"
  ) {
    return "manufacturer-family";
  }

  if (
    status ===
    "verified-manufacturer-pass-through"
  ) {
    return "manufacturer-pass-through";
  }

  return status || "v4-projected-promotion";
}

function isVerifiedStatus(value = "") {
  return clean(value)
    .toLowerCase()
    .startsWith("verified-");
}

function isWeakPriorStatus(value = "") {
  const status = clean(value).toLowerCase();

  return [
    "",
    "needs-review",
    "possible-secondary-token",
    "unverified-clean-candidate",
  ].includes(status);
}

function isWrightMetricCatalogMatch(row = {}) {
  const manufacturer = clean(
    row["Manufacturer Match Hint"]
  ).toLowerCase();

  if (manufacturer !== "wright tool") {
    return false;
  }

  const projected = clean(
    row["Projected MCN"]
  );

  const description = clean(
    row["IHI Description"]
  );

  /*
   * Wright metric catalog examples:
   *
   * 38-16mm
   * 38-51mm
   *
   * Fishbowl descriptions may only contain:
   *
   * 38-16
   * 38-51
   *
   * even though the proper manufacturer catalog
   * number includes the trailing "mm".
   */
  const match = projected.match(
    /^(\d{2}-\d{2})mm$/i
  );

  if (!match) {
    return false;
  }

  const baseCatalogNumber = match[1];

  return tokenAppears(
    description,
    baseCatalogNumber
  );
}

function validateEvidence(row) {
  const projected = clean(
    row["Projected MCN"]
  );

  const status = clean(
    row["Projected MCN Match Status"]
  );

  const partNumber = clean(
    row["IHI Part Number"]
  );

  const description = clean(
    row["IHI Description"]
  );

  const prior = clean(
    row["Prior MCN Candidate"]
  );

  const priorStatus = clean(
    row["Prior MCN Match Status"]
  );

  const manufacturer = clean(
    row["Manufacturer Match Hint"]
  );

  const rule = getEffectiveRule(row);

  const reasons = [];
  let evidenceOk = true;

  if (!projected) {
    evidenceOk = false;
    reasons.push(
      "Projected MCN is blank"
    );
  }

  if (!manufacturer) {
    evidenceOk = false;
    reasons.push(
      "Manufacturer Match Hint is blank"
    );
  }

  /*
   * ------------------------------------------------
   * DESCRIPTION CATALOG NUMBER
   * ------------------------------------------------
   */
  if (
    status ===
    "verified-description-catalog-number"
  ) {
    const directDescriptionMatch =
      tokenAppears(
        description,
        projected
      );

    const wrightMetricMatch =
      isWrightMetricCatalogMatch(row);

    if (
      !directDescriptionMatch &&
      !wrightMetricMatch
    ) {
      evidenceOk = false;

      reasons.push(
        "Projected MCN is not supported by the description"
      );
    }

    if (
      wrightMetricMatch &&
      !directDescriptionMatch
    ) {
      reasons.push(
        "Accepted Wright metric catalog normalization: Fishbowl description omits trailing mm"
      );
    }
  }

  /*
   * ------------------------------------------------
   * SECONDARY TOKEN
   * ------------------------------------------------
   */
  else if (
    status === "verified-secondary-token"
  ) {
    if (
      !tokenAppears(
        partNumber,
        projected
      ) &&
      !tokenAppears(
        description,
        projected
      )
    ) {
      evidenceOk = false;

      reasons.push(
        "Projected MCN is not found as a token in part number or description"
      );
    }
  }

  /*
   * ------------------------------------------------
   * MANUFACTURER FAMILY
   * ------------------------------------------------
   */
  else if (
    status ===
    "verified-manufacturer-family"
  ) {
    if (
      normalized(projected) !==
      normalized(partNumber)
    ) {
      evidenceOk = false;

      reasons.push(
        "Manufacturer-family MCN does not equal the clean IHI part number"
      );
    }
  }

  /*
   * ------------------------------------------------
   * OTHER VERIFIED STATUSES
   * ------------------------------------------------
   */
  else if (!isVerifiedStatus(status)) {
    evidenceOk = false;

    reasons.push(
      `Projected status is not verified (${status || "blank"})`
    );
  }

  const projectedCanonical =
    canonicalCandidate(
      projected,
      row
    );

  const priorCanonical =
    canonicalCandidate(
      prior,
      row
    );

  /*
   * ------------------------------------------------
   * CANDIDATE PRECEDENCE
   * ------------------------------------------------
   *
   * A verified manufacturer/catalog result should
   * supersede a weaker old heuristic candidate.
   *
   * Wright example:
   *
   * projected:
   *   3400
   *
   * old candidate:
   *   3750 DR.RATCHET
   *
   *
   * DeWalt / Powers example:
   *
   * projected:
   *   09340-PWR
   *
   * old candidate:
   *   09340
   *
   *
   * Tru-Cut example:
   *
   * projected:
   *   PM75018
   *
   * old candidate:
   *   MDSDSMAXPM75018
   */
  if (
    projectedCanonical &&
    priorCanonical &&
    projectedCanonical !== priorCanonical
  ) {
    if (
      isVerifiedStatus(status) &&
      isWeakPriorStatus(priorStatus)
    ) {
      reasons.push(
        `Verified projected MCN supersedes weak prior candidate ${priorCanonical}`
      );
    } else {
      reasons.push(
        `Conflicting candidate evidence: projected ${projectedCanonical} vs prior ${priorCanonical}`
      );

      return {
        bucket: "conflict",
        reasons,
        projectedCanonical,
        priorCanonical,
      };
    }
  }

  if (!evidenceOk) {
    return {
      bucket: "unresolved",
      reasons,
      projectedCanonical,
      priorCanonical,
    };
  }

  return {
    bucket: "safe",

    reasons: [
      ...reasons,
      `Verified v4.2 evidence passed using rule: ${rule}`,
    ],

    projectedCanonical,
    priorCanonical,
  };
}

function addAuditFields(
  row,
  validation
) {
  return {
    ...row,

    "V4.1 Bucket":
      validation.bucket,

    "V4.1 Validation Notes":
      validation.reasons.join("; "),

    "V4.1 Canonical Projected MCN":
      validation.projectedCanonical,

    "V4.1 Canonical Prior Candidate":
      validation.priorCanonical,
  };
}

function countBy(rows, key) {
  const counts = {};

  for (const row of rows) {
    const value =
      clean(row[key]) || "(blank)";

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

function countByEffectiveRule(rows) {
  const counts = {};

  for (const row of rows) {
    const rule =
      getEffectiveRule(row);

    counts[rule] =
      (counts[rule] || 0) + 1;
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
  /*
   * ------------------------------------------------
   * VERIFY INPUT
   * ------------------------------------------------
   */

  if (!fs.existsSync(inputPath)) {
    console.error(
      `❌ Input file not found: ${inputPath}`
    );

    console.error(
      "Usage: node src/scripts/buildMcnV41Buckets.js [input.csv] [output-directory]"
    );

    process.exit(1);
  }

  fs.mkdirSync(
    outputDir,
    {
      recursive: true,
    }
  );

  /*
   * ------------------------------------------------
   * LOAD CSV
   * ------------------------------------------------
   */

  const raw = fs.readFileSync(
    inputPath,
    "utf8"
  );

  const parsedRows =
    parseCsv(raw);

  const rows =
    rowsToObjects(parsedRows);

  if (!rows.length) {
    throw new Error(
      "CSV has no data rows"
    );
  }

  /*
   * ------------------------------------------------
   * REQUIRED COLUMNS
   * ------------------------------------------------
   *
   * We intentionally DO NOT require a rule column.
   *
   * Older v4 exports may not have:
   *
   * MCN Rule
   * V4 Rule
   *
   * In that case the rule can be derived from the
   * projected match status.
   */

  const requiredHeaders = [
    "Internal ID",
    "IHI Part Number",
    "Projected MCN",
    "Projected MCN Match Status",
    "Manufacturer Match Hint",
    "IHI Description",
    "Prior MCN Match Status",
    "Prior MCN Candidate",
  ];

  const actualHeaders =
    Object.keys(rows[0]);

  const missingHeaders =
    requiredHeaders.filter(
      (header) =>
        !actualHeaders.includes(header)
    );

  if (missingHeaders.length) {
    throw new Error(
      `Missing required CSV columns: ${missingHeaders.join(", ")}`
    );
  }

  /*
   * ------------------------------------------------
   * VALIDATE ROWS
   * ------------------------------------------------
   */

  const safe = [];
  const conflicts = [];
  const unresolved = [];

  for (const row of rows) {
    const validation =
      validateEvidence(row);

    const audited =
      addAuditFields(
        row,
        validation
      );

    if (
      validation.bucket === "safe"
    ) {
      safe.push(audited);
    } else if (
      validation.bucket === "conflict"
    ) {
      conflicts.push(audited);
    } else {
      unresolved.push(audited);
    }
  }

  /*
   * ------------------------------------------------
   * OUTPUT COLUMNS
   * ------------------------------------------------
   */

  const auditHeaders = [
    ...actualHeaders,

    "V4.1 Bucket",

    "V4.1 Validation Notes",

    "V4.1 Canonical Projected MCN",

    "V4.1 Canonical Prior Candidate",
  ];

  /*
   * ------------------------------------------------
   * OUTPUT PATHS
   * ------------------------------------------------
   */

  const safePath = path.join(
    outputDir,
    "IHI_MCN_v4_1_safe_promotions.csv"
  );

  const conflictPath = path.join(
    outputDir,
    "IHI_MCN_v4_1_conflicts.csv"
  );

  const unresolvedPath = path.join(
    outputDir,
    "IHI_MCN_v4_1_unresolved.csv"
  );

  const overridePath = path.join(
    outputDir,
    "IHI_MCN_v4_1_override_additions.csv"
  );

  const summaryPath = path.join(
    outputDir,
    "IHI_MCN_v4_1_summary.json"
  );

  /*
   * ------------------------------------------------
   * WRITE AUDIT FILES
   * ------------------------------------------------
   */

  writeCsv(
    safePath,
    auditHeaders,
    safe
  );

  writeCsv(
    conflictPath,
    auditHeaders,
    conflicts
  );

  writeCsv(
    unresolvedPath,
    auditHeaders,
    unresolved
  );

  /*
   * ------------------------------------------------
   * BUILD CLEAN OVERRIDE ADDITIONS
   * ------------------------------------------------
   *
   * Only SAFE rows enter this file.
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
    safe.map((row) => ({
      "Internal ID":
        row["Internal ID"],

      "IHI Part Number":
        row["IHI Part Number"],

      MCN:
        row[
          "V4.1 Canonical Projected MCN"
        ] ||
        row["Projected MCN"],

      "Manufacturer / Match Hint":
        row[
          "Manufacturer Match Hint"
        ],

      "MCN Match Status":
        row[
          "Projected MCN Match Status"
        ],

      Rule:
        getEffectiveRule(row),

      "IHI Description":
        row["IHI Description"],
    }));

  writeCsv(
    overridePath,
    overrideHeaders,
    overrideRows
  );

  /*
   * ------------------------------------------------
   * SUMMARY
   * ------------------------------------------------
   */

  const summary = {
    version:
      "MCN-v4.2-validation",

    inputFile:
      inputPath,

    totalRows:
      rows.length,

    safePromotions:
      safe.length,

    conflicts:
      conflicts.length,

    unresolved:
      unresolved.length,

    safeRate:
      rows.length
        ? Number(
            (
              (safe.length /
                rows.length) *
              100
            ).toFixed(2)
          )
        : 0,

    safeByManufacturer:
      countBy(
        safe,
        "Manufacturer Match Hint"
      ),

    safeByRule:
      countByEffectiveRule(safe),

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
        safePath,

      conflicts:
        conflictPath,

      unresolved:
        unresolvedPath,

      overrideAdditions:
        overridePath,
    },
  };

  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify(
      summary,
      null,
      2
    )}\n`,
    "utf8"
  );

  /*
   * ------------------------------------------------
   * TERMINAL SUMMARY
   * ------------------------------------------------
   */

  console.log("");
  console.log(
    "===== MCN V4.2 VALIDATION SUMMARY ====="
  );

  console.log(
    `Input rows:       ${summary.totalRows}`
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
  console.log("Outputs:");

  console.log(
    summary.outputs
  );

  console.log("");
  console.log(
    `Summary: ${summaryPath}`
  );

  if (
    summary.conflicts === 0 &&
    summary.unresolved === 0
  ) {
    console.log("");
    console.log(
      "✅ All projected v4 MCNs passed v4.2 validation."
    );

    console.log(
      "✅ Override additions are ready for the next merge/review step."
    );
  } else {
    console.log("");
    console.log(
      `⚠️ ${summary.conflicts + summary.unresolved} rows still require review.`
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v4.2 bucketing failed:",
    err
  );

  process.exit(1);
}
import fs from "fs";
import path from "path";

const MASTER_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "manufacturer-matching-overrides.csv"
);

const ADDITIONS_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "IHI_MCN_v4_1_override_additions.csv"
);

const PREVIEW_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "manufacturer-matching-overrides-v4_2-preview.csv"
);

const AUDIT_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "manufacturer-matching-overrides-v4_2-merge-audit.csv"
);

const SUMMARY_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "manufacturer-matching-overrides-v4_2-merge-summary.json"
);

function clean(value = "") {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value = "") {
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

function rowsToObjects(rows) {
  if (!rows.length) {
    return {
      headers: [],
      rows: [],
    };
  }

  const headers = rows[0].map(clean);

  const objects = rows.slice(1).map((values) => {
    const obj = {};

    for (let i = 0; i < headers.length; i += 1) {
      obj[headers[i]] = values[i] ?? "";
    }

    return obj;
  });

  return {
    headers,
    rows: objects,
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

function findHeader(headers, candidates = []) {
  for (const candidate of candidates) {
    const exact = headers.find(
      (header) =>
        header.toLowerCase() ===
        candidate.toLowerCase()
    );

    if (exact) {
      return exact;
    }
  }

  return "";
}

function requireHeader(
  headers,
  candidates,
  label
) {
  const header = findHeader(
    headers,
    candidates
  );

  if (!header) {
    throw new Error(
      `Could not find ${label} column.\n` +
      `Looked for: ${candidates.join(", ")}\n` +
      `Actual headers:\n${headers.join(" | ")}`
    );
  }

  return header;
}

function buildIndex(rows, header) {
  const map = new Map();

  if (!header) {
    return map;
  }

  for (let i = 0; i < rows.length; i += 1) {
    const value = normalize(
      rows[i][header]
    );

    if (!value) {
      continue;
    }

    if (!map.has(value)) {
      map.set(value, []);
    }

    map.get(value).push(i);
  }

  return map;
}

function cloneRows(rows) {
  return rows.map((row) => ({
    ...row,
  }));
}

function main() {
  console.log("");
  console.log(
    "===== MCN V4.2 MERGE PREVIEW ====="
  );
  console.log("");

  if (!fs.existsSync(MASTER_PATH)) {
    throw new Error(
      `Master override file not found:\n${MASTER_PATH}`
    );
  }

  if (!fs.existsSync(ADDITIONS_PATH)) {
    throw new Error(
      `V4.2 override additions file not found:\n${ADDITIONS_PATH}`
    );
  }

  const masterParsed =
    rowsToObjects(
      parseCsv(
        fs.readFileSync(
          MASTER_PATH,
          "utf8"
        )
      )
    );

  const additionsParsed =
    rowsToObjects(
      parseCsv(
        fs.readFileSync(
          ADDITIONS_PATH,
          "utf8"
        )
      )
    );

  const masterHeaders =
    masterParsed.headers;

  const masterRows =
    masterParsed.rows;

  const additionHeaders =
    additionsParsed.headers;

  const additions =
    additionsParsed.rows;

  /*
   * -----------------------------------------------
   * FIND MASTER FILE COLUMNS
   * -----------------------------------------------
   */

  const masterIdHeader =
    findHeader(
      masterHeaders,
      [
        "Internal ID",
        "InternalID",
        "internalId",
        "Product ID",
        "ProductID",
      ]
    );

  const masterPartHeader =
    requireHeader(
      masterHeaders,
      [
        "IHI Part Number",
        "Part Number",
        "PartNumber",
        "Fishbowl Part Number",
        "Fishbowl PartNum",
      ],
      "master part number"
    );

  const masterMcnHeader =
    requireHeader(
      masterHeaders,
      [
        "MCN",
        "Manufacturer Catalog Number",
        "Manufacturer Catalog #",
        "Manufacturer Catalog No",
        "Manufacturer Part Number",
        "Manufacturer Part #",
        "MCN Candidate",
      ],
      "master MCN"
    );

  const masterStatusHeader =
    requireHeader(
      masterHeaders,
      [
        "MCN Match Status",
        "MCN Status",
        "Match Status",
        "MCN Verification Status",
      ],
      "master MCN status"
    );

  const masterRuleHeader =
    findHeader(
      masterHeaders,
      [
        "MCN Rule",
        "Rule",
        "V4 Rule",
        "Promotion Rule",
      ]
    );

  /*
   * We deliberately DO NOT overwrite a generic
   * Vendor / Manufacturer column.
   *
   * If the master file contains a dedicated
   * manufacturer-match-hint field, we can update it.
   */

  const masterManufacturerHintHeader =
    findHeader(
      masterHeaders,
      [
        "Manufacturer Match Hint",
        "Manufacturer / Match Hint",
        "MCN Manufacturer Hint",
      ]
    );

  /*
   * -----------------------------------------------
   * VERIFY ADDITION COLUMNS
   * -----------------------------------------------
   */

  const additionIdHeader =
    requireHeader(
      additionHeaders,
      ["Internal ID"],
      "addition Internal ID"
    );

  const additionPartHeader =
    requireHeader(
      additionHeaders,
      ["IHI Part Number"],
      "addition IHI Part Number"
    );

  const additionMcnHeader =
    requireHeader(
      additionHeaders,
      ["MCN"],
      "addition MCN"
    );

  const additionStatusHeader =
    requireHeader(
      additionHeaders,
      ["MCN Match Status"],
      "addition MCN Match Status"
    );

  const additionManufacturerHeader =
    findHeader(
      additionHeaders,
      [
        "Manufacturer / Match Hint",
        "Manufacturer Match Hint",
      ]
    );

  const additionRuleHeader =
    findHeader(
      additionHeaders,
      [
        "Rule",
        "MCN Rule",
        "V4 Rule",
      ]
    );

  /*
   * -----------------------------------------------
   * PRINT DETECTED SCHEMA
   * -----------------------------------------------
   */

  console.log("Detected master columns:");

  console.log({
    internalId:
      masterIdHeader || "(not found)",
    partNumber:
      masterPartHeader,
    mcn:
      masterMcnHeader,
    status:
      masterStatusHeader,
    rule:
      masterRuleHeader || "(not found)",
    manufacturerHint:
      masterManufacturerHintHeader ||
      "(not found)",
  });

  console.log("");

  /*
   * -----------------------------------------------
   * BUILD LOOKUP INDEXES
   * -----------------------------------------------
   */

  const idIndex =
    buildIndex(
      masterRows,
      masterIdHeader
    );

  const partIndex =
    buildIndex(
      masterRows,
      masterPartHeader
    );

  const previewRows =
    cloneRows(masterRows);

  const auditRows = [];

  const summary = {
    masterRows:
      masterRows.length,

    additions:
      additions.length,

    matchedByInternalId: 0,

    matchedByPartNumber: 0,

    updated: 0,

    alreadySame: 0,

    unmatched: 0,

    ambiguous: 0,

    partNumberMismatches: 0,

    duplicateAdditionInternalIds: 0,

    duplicateAdditionPartNumbers: 0,
  };

  /*
   * -----------------------------------------------
   * CHECK DUPLICATES INSIDE ADDITION FILE
   * -----------------------------------------------
   */

  const additionIdCounts =
    new Map();

  const additionPartCounts =
    new Map();

  for (const addition of additions) {
    const id = normalize(
      addition[additionIdHeader]
    );

    const part = normalize(
      addition[additionPartHeader]
    );

    if (id) {
      additionIdCounts.set(
        id,
        (additionIdCounts.get(id) || 0) + 1
      );
    }

    if (part) {
      additionPartCounts.set(
        part,
        (additionPartCounts.get(part) || 0) + 1
      );
    }
  }

  summary.duplicateAdditionInternalIds =
    [...additionIdCounts.values()]
      .filter((count) => count > 1)
      .length;

  summary.duplicateAdditionPartNumbers =
    [...additionPartCounts.values()]
      .filter((count) => count > 1)
      .length;

  /*
   * -----------------------------------------------
   * PROCESS 534 VERIFIED PROMOTIONS
   * -----------------------------------------------
   */

  for (const addition of additions) {
    const internalId = clean(
      addition[additionIdHeader]
    );

    const partNumber = clean(
      addition[additionPartHeader]
    );

    const newMcn = clean(
      addition[additionMcnHeader]
    );

    const newStatus = clean(
      addition[additionStatusHeader]
    );

    const manufacturer =
      additionManufacturerHeader
        ? clean(
            addition[
              additionManufacturerHeader
            ]
          )
        : "";

    const rule =
      additionRuleHeader
        ? clean(
            addition[
              additionRuleHeader
            ]
          )
        : "";

    const normalizedId =
      normalize(internalId);

    const normalizedPart =
      normalize(partNumber);

    let targetIndexes = [];

    let matchMethod = "";

    /*
     * Internal ID is our preferred key.
     */

    if (
      masterIdHeader &&
      normalizedId &&
      idIndex.has(normalizedId)
    ) {
      targetIndexes =
        idIndex.get(normalizedId);

      matchMethod =
        "internal-id";
    }

    /*
     * Fall back to exact IHI part number.
     */

    if (
      !targetIndexes.length &&
      normalizedPart &&
      partIndex.has(normalizedPart)
    ) {
      targetIndexes =
        partIndex.get(normalizedPart);

      matchMethod =
        "part-number";
    }

    if (!targetIndexes.length) {
      summary.unmatched += 1;

      auditRows.push({
        "Internal ID":
          internalId,

        "IHI Part Number":
          partNumber,

        "Match Method":
          "",

        Result:
          "UNMATCHED",

        "Old MCN":
          "",

        "New MCN":
          newMcn,

        "Old Status":
          "",

        "New Status":
          newStatus,

        Manufacturer:
          manufacturer,

        Rule:
          rule,

        Notes:
          "No matching row found in master overrides",
      });

      continue;
    }

    if (targetIndexes.length > 1) {
      summary.ambiguous += 1;

      auditRows.push({
        "Internal ID":
          internalId,

        "IHI Part Number":
          partNumber,

        "Match Method":
          matchMethod,

        Result:
          "AMBIGUOUS",

        "Old MCN":
          "",

        "New MCN":
          newMcn,

        "Old Status":
          "",

        "New Status":
          newStatus,

        Manufacturer:
          manufacturer,

        Rule:
          rule,

        Notes:
          `Matched ${targetIndexes.length} master rows`,
      });

      continue;
    }

    const targetIndex =
      targetIndexes[0];

    const existing =
      previewRows[targetIndex];

    const masterPartNumber =
      clean(
        existing[masterPartHeader]
      );

    /*
     * If Internal ID matched but the part number
     * disagrees, stop instead of silently changing it.
     */

    if (
      matchMethod === "internal-id" &&
      normalizedPart &&
      normalize(masterPartNumber) !==
        normalizedPart
    ) {
      summary.partNumberMismatches += 1;

      auditRows.push({
        "Internal ID":
          internalId,

        "IHI Part Number":
          partNumber,

        "Match Method":
          matchMethod,

        Result:
          "PART-NUMBER-MISMATCH",

        "Old MCN":
          clean(
            existing[
              masterMcnHeader
            ]
          ),

        "New MCN":
          newMcn,

        "Old Status":
          clean(
            existing[
              masterStatusHeader
            ]
          ),

        "New Status":
          newStatus,

        Manufacturer:
          manufacturer,

        Rule:
          rule,

        Notes:
          `Master part number is "${masterPartNumber}"`,
      });

      continue;
    }

    if (
      matchMethod === "internal-id"
    ) {
      summary.matchedByInternalId += 1;
    } else {
      summary.matchedByPartNumber += 1;
    }

    const oldMcn =
      clean(
        existing[
          masterMcnHeader
        ]
      );

    const oldStatus =
      clean(
        existing[
          masterStatusHeader
        ]
      );

    const same =
      normalize(oldMcn) ===
        normalize(newMcn) &&
      normalize(oldStatus) ===
        normalize(newStatus);

    /*
     * Apply changes ONLY to preview copy.
     *
     * MASTER FILE IS NOT TOUCHED.
     */

    existing[
      masterMcnHeader
    ] = newMcn;

    existing[
      masterStatusHeader
    ] = newStatus;

    if (
      masterRuleHeader &&
      rule
    ) {
      existing[
        masterRuleHeader
      ] = rule;
    }

    if (
      masterManufacturerHintHeader &&
      manufacturer
    ) {
      existing[
        masterManufacturerHintHeader
      ] = manufacturer;
    }

    if (same) {
      summary.alreadySame += 1;
    } else {
      summary.updated += 1;
    }

    auditRows.push({
      "Internal ID":
        internalId,

      "IHI Part Number":
        partNumber,

      "Match Method":
        matchMethod,

      Result:
        same
          ? "ALREADY-SAME"
          : "UPDATED",

      "Old MCN":
        oldMcn,

      "New MCN":
        newMcn,

      "Old Status":
        oldStatus,

      "New Status":
        newStatus,

      Manufacturer:
        manufacturer,

      Rule:
        rule,

      Notes:
        "",
    });
  }

  /*
   * -----------------------------------------------
   * WRITE PREVIEW FILE
   * -----------------------------------------------
   */

  writeCsv(
    PREVIEW_PATH,
    masterHeaders,
    previewRows
  );

  const auditHeaders = [
    "Internal ID",
    "IHI Part Number",
    "Match Method",
    "Result",
    "Old MCN",
    "New MCN",
    "Old Status",
    "New Status",
    "Manufacturer",
    "Rule",
    "Notes",
  ];

  writeCsv(
    AUDIT_PATH,
    auditHeaders,
    auditRows
  );

  fs.writeFileSync(
    SUMMARY_PATH,
    `${JSON.stringify(
      {
        ...summary,

        files: {
          master:
            MASTER_PATH,

          additions:
            ADDITIONS_PATH,

          preview:
            PREVIEW_PATH,

          audit:
            AUDIT_PATH,
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  /*
   * -----------------------------------------------
   * TERMINAL RESULTS
   * -----------------------------------------------
   */

  console.log(
    "===== MERGE PREVIEW SUMMARY ====="
  );

  console.table(summary);

  console.log("");

  console.log(
    `Preview file:\n${PREVIEW_PATH}`
  );

  console.log("");

  console.log(
    `Audit file:\n${AUDIT_PATH}`
  );

  console.log("");

  console.log(
    `Summary file:\n${SUMMARY_PATH}`
  );

  console.log("");

  if (
    summary.additions === 534 &&
    summary.unmatched === 0 &&
    summary.ambiguous === 0 &&
    summary.partNumberMismatches === 0 &&
    summary.duplicateAdditionInternalIds === 0
  ) {
    console.log(
      "✅ Merge preview passed structural validation."
    );

    console.log(
      "✅ All 534 verified promotions were matched safely."
    );

    console.log(
      "ℹ️ The original manufacturer-matching-overrides.csv has NOT been modified."
    );
  } else {
    console.log(
      "⚠️ Merge preview requires review before replacing the master override file."
    );

    console.log(
      "ℹ️ The original manufacturer-matching-overrides.csv has NOT been modified."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ V4.2 merge preview failed:",
    err
  );

  process.exit(1);
}
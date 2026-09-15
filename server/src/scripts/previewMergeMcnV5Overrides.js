// server/src/scripts/previewMergeMcnV5Overrides.js
//
// Safely previews merging the validated v5 MCN additions into the
// permanent verified MCN override file.
//
// Existing:
//   tmp/manufacturer-matching-mcn-overrides.csv
//
// New validated additions:
//   tmp/IHI_MCN_v5_override_additions.csv
//
// Outputs:
//   tmp/manufacturer-matching-mcn-overrides-v5-preview.csv
//   tmp/manufacturer-matching-mcn-overrides-v5-merge-audit.csv
//   tmp/manufacturer-matching-mcn-overrides-v5-merge-summary.json
//
// IMPORTANT:
// This script DOES NOT modify manufacturer-matching-mcn-overrides.csv.

import fs from "fs";
import path from "path";

const MASTER_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "manufacturer-matching-mcn-overrides.csv"
);

const ADDITIONS_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "IHI_MCN_v5_override_additions.csv"
);

const PREVIEW_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "manufacturer-matching-mcn-overrides-v5-preview.csv"
);

const AUDIT_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "manufacturer-matching-mcn-overrides-v5-merge-audit.csv"
);

const SUMMARY_PATH = path.resolve(
  process.cwd(),
  "tmp",
  "manufacturer-matching-mcn-overrides-v5-merge-summary.json"
);

const REQUIRED_HEADERS = [
  "Internal ID",
  "IHI Part Number",
  "MCN",
  "Manufacturer / Match Hint",
  "MCN Match Status",
  "Rule",
  "IHI Description",
];

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

function rowsToObjects(parsedRows) {
  if (!parsedRows.length) {
    return {
      headers: [],
      rows: [],
    };
  }

  const headers = parsedRows[0].map(clean);

  const rows = parsedRows.slice(1).map((values) => {
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

function loadCsv(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} file not found:\n${filePath}`
    );
  }

  const parsed = rowsToObjects(
    parseCsv(
      fs.readFileSync(
        filePath,
        "utf8"
      )
    )
  );

  if (!parsed.rows.length) {
    throw new Error(
      `${label} contains no data rows:\n${filePath}`
    );
  }

  const missingHeaders =
    REQUIRED_HEADERS.filter(
      (header) =>
        !parsed.headers.includes(header)
    );

  if (missingHeaders.length) {
    throw new Error(
      `${label} is missing required columns: ${missingHeaders.join(", ")}`
    );
  }

  return parsed;
}

function buildIndex(rows, field) {
  const map = new Map();

  for (let i = 0; i < rows.length; i += 1) {
    const key = normalize(
      rows[i][field]
    );

    if (!key) {
      continue;
    }

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(i);
  }

  return map;
}

function findDuplicateKeys(index) {
  return Array.from(
    index.entries()
  )
    .filter(
      ([, indexes]) =>
        indexes.length > 1
    )
    .map(
      ([key, indexes]) => ({
        key,
        count:
          indexes.length,
        indexes,
      })
    );
}

function sameMcn(a, b) {
  return (
    normalize(a["MCN"]) ===
    normalize(b["MCN"])
  );
}

function sameIdentity(a, b) {
  return (
    normalize(
      a["Internal ID"]
    ) ===
      normalize(
        b["Internal ID"]
      ) &&
    normalize(
      a["IHI Part Number"]
    ) ===
      normalize(
        b["IHI Part Number"]
      )
  );
}

function sameOverride(a, b) {
  return (
    sameIdentity(a, b) &&
    sameMcn(a, b) &&
    normalize(
      a["MCN Match Status"]
    ) ===
      normalize(
        b["MCN Match Status"]
      ) &&
    normalize(
      a["Rule"]
    ) ===
      normalize(
        b["Rule"]
      )
  );
}

function makeAuditRow({
  addition,
  existing = {},
  result,
  notes = "",
}) {
  return {
    "Internal ID":
      clean(
        addition["Internal ID"]
      ),

    "IHI Part Number":
      clean(
        addition["IHI Part Number"]
      ),

    Result:
      result,

    "Existing MCN":
      clean(
        existing["MCN"]
      ),

    "New MCN":
      clean(
        addition["MCN"]
      ),

    "Existing Status":
      clean(
        existing[
          "MCN Match Status"
        ]
      ),

    "New Status":
      clean(
        addition[
          "MCN Match Status"
        ]
      ),

    "Existing Rule":
      clean(
        existing["Rule"]
      ),

    "New Rule":
      clean(
        addition["Rule"]
      ),

    "Manufacturer / Match Hint":
      clean(
        addition[
          "Manufacturer / Match Hint"
        ]
      ),

    Notes:
      notes,
  };
}

function main() {
  console.log("");
  console.log(
    "===== MCN V5 MERGE PREVIEW ====="
  );
  console.log("");

  const master =
    loadCsv(
      MASTER_PATH,
      "Permanent MCN override"
    );

  const additions =
    loadCsv(
      ADDITIONS_PATH,
      "V5 override additions"
    );

  /*
   * ------------------------------------------------------------
   * INITIAL STRUCTURAL CHECKS
   * ------------------------------------------------------------
   */

  const masterIdIndex =
    buildIndex(
      master.rows,
      "Internal ID"
    );

  const masterPartIndex =
    buildIndex(
      master.rows,
      "IHI Part Number"
    );

  const additionIdIndex =
    buildIndex(
      additions.rows,
      "Internal ID"
    );

  const additionPartIndex =
    buildIndex(
      additions.rows,
      "IHI Part Number"
    );

  const duplicateMasterIds =
    findDuplicateKeys(
      masterIdIndex
    );

  const duplicateMasterParts =
    findDuplicateKeys(
      masterPartIndex
    );

  const duplicateAdditionIds =
    findDuplicateKeys(
      additionIdIndex
    );

  const duplicateAdditionParts =
    findDuplicateKeys(
      additionPartIndex
    );

  if (
    duplicateMasterIds.length
  ) {
    throw new Error(
      `Permanent MCN override file contains ${duplicateMasterIds.length} duplicate Internal ID(s). First examples: ${duplicateMasterIds
        .slice(0, 10)
        .map(
          (item) =>
            item.key
        )
        .join(", ")}`
    );
  }

  if (
    duplicateMasterParts.length
  ) {
    throw new Error(
      `Permanent MCN override file contains ${duplicateMasterParts.length} duplicate IHI Part Number(s). First examples: ${duplicateMasterParts
        .slice(0, 10)
        .map(
          (item) =>
            item.key
        )
        .join(", ")}`
    );
  }

  if (
    duplicateAdditionIds.length
  ) {
    throw new Error(
      `V5 additions contain ${duplicateAdditionIds.length} duplicate Internal ID(s). First examples: ${duplicateAdditionIds
        .slice(0, 10)
        .map(
          (item) =>
            item.key
        )
        .join(", ")}`
    );
  }

  if (
    duplicateAdditionParts.length
  ) {
    throw new Error(
      `V5 additions contain ${duplicateAdditionParts.length} duplicate IHI Part Number(s). First examples: ${duplicateAdditionParts
        .slice(0, 10)
        .map(
          (item) =>
            item.key
        )
        .join(", ")}`
    );
  }

  /*
   * ------------------------------------------------------------
   * BUILD PREVIEW
   * ------------------------------------------------------------
   */

  const previewRows =
    master.rows.map(
      (row) => ({
        ...row,
      })
    );

  const previewById =
    new Map(
      Array.from(
        masterIdIndex.entries()
      ).map(
        ([key, indexes]) => [
          key,
          indexes[0],
        ]
      )
    );

  const previewByPart =
    new Map(
      Array.from(
        masterPartIndex.entries()
      ).map(
        ([key, indexes]) => [
          key,
          indexes[0],
        ]
      )
    );

  const auditRows = [];

  const summary = {
    existingOverrides:
      master.rows.length,

    newAdditions:
      additions.rows.length,

    added:
      0,

    alreadySame:
      0,

    conflicts:
      0,

    identityConflicts:
      0,

    mcnConflicts:
      0,

    ambiguousMatches:
      0,

    finalPreviewRows:
      0,
  };

  for (
    const addition
    of additions.rows
  ) {
    const idKey =
      normalize(
        addition["Internal ID"]
      );

    const partKey =
      normalize(
        addition[
          "IHI Part Number"
        ]
      );

    const idMatchIndex =
      idKey &&
      previewById.has(
        idKey
      )
        ? previewById.get(
            idKey
          )
        : null;

    const partMatchIndex =
      partKey &&
      previewByPart.has(
        partKey
      )
        ? previewByPart.get(
            partKey
          )
        : null;

    /*
     * ----------------------------------------------------------
     * BOTH ID + PART MATCH EXIST
     * ----------------------------------------------------------
     */

    if (
      idMatchIndex !== null &&
      partMatchIndex !== null
    ) {
      if (
        idMatchIndex !==
        partMatchIndex
      ) {
        summary.conflicts += 1;
        summary.ambiguousMatches += 1;

        auditRows.push(
          makeAuditRow({
            addition,

            result:
              "AMBIGUOUS",

            notes:
              "Internal ID and IHI Part Number point to different existing override rows.",
          })
        );

        continue;
      }

      const existing =
        previewRows[
          idMatchIndex
        ];

      if (
        sameOverride(
          existing,
          addition
        )
      ) {
        summary.alreadySame += 1;

        auditRows.push(
          makeAuditRow({
            addition,
            existing,

            result:
              "ALREADY-SAME",

            notes:
              "Exact verified override already exists.",
          })
        );

        continue;
      }

      if (
        sameIdentity(
          existing,
          addition
        ) &&
        !sameMcn(
          existing,
          addition
        )
      ) {
        summary.conflicts += 1;
        summary.mcnConflicts += 1;

        auditRows.push(
          makeAuditRow({
            addition,
            existing,

            result:
              "MCN-CONFLICT",

            notes:
              "Same Internal ID and IHI Part Number already exist with a different MCN.",
          })
        );

        continue;
      }

      /*
       * Same identity + same MCN but metadata differs.
       *
       * Since both values are verified, do not silently overwrite
       * the permanent historical rule/status metadata.
       */
      summary.conflicts += 1;

      auditRows.push(
        makeAuditRow({
          addition,
          existing,

          result:
            "METADATA-CONFLICT",

          notes:
            "Existing identity and MCN agree, but status/rule metadata differs.",
        })
      );

      continue;
    }

    /*
     * ----------------------------------------------------------
     * INTERNAL ID MATCH ONLY
     * ----------------------------------------------------------
     */

    if (
      idMatchIndex !== null
    ) {
      const existing =
        previewRows[
          idMatchIndex
        ];

      summary.conflicts += 1;
      summary.identityConflicts += 1;

      auditRows.push(
        makeAuditRow({
          addition,
          existing,

          result:
            "INTERNAL-ID-CONFLICT",

          notes:
            `Internal ID already belongs to IHI Part Number "${clean(
              existing[
                "IHI Part Number"
              ]
            )}".`,
        })
      );

      continue;
    }

    /*
     * ----------------------------------------------------------
     * PART NUMBER MATCH ONLY
     * ----------------------------------------------------------
     */

    if (
      partMatchIndex !== null
    ) {
      const existing =
        previewRows[
          partMatchIndex
        ];

      summary.conflicts += 1;
      summary.identityConflicts += 1;

      auditRows.push(
        makeAuditRow({
          addition,
          existing,

          result:
            "PART-NUMBER-CONFLICT",

          notes:
            `IHI Part Number already belongs to Internal ID "${clean(
              existing[
                "Internal ID"
              ]
            )}".`,
        })
      );

      continue;
    }

    /*
     * ----------------------------------------------------------
     * BRAND-NEW VERIFIED OVERRIDE
     * ----------------------------------------------------------
     */

    const newRow = {};

    for (
      const header
      of REQUIRED_HEADERS
    ) {
      newRow[header] =
        clean(
          addition[header]
        );
    }

    const newIndex =
      previewRows.length;

    previewRows.push(
      newRow
    );

    if (idKey) {
      previewById.set(
        idKey,
        newIndex
      );
    }

    if (partKey) {
      previewByPart.set(
        partKey,
        newIndex
      );
    }

    summary.added += 1;

    auditRows.push(
      makeAuditRow({
        addition,

        result:
          "ADDED",

        notes:
          "New verified v5 MCN override added to preview.",
      })
    );
  }

  summary.finalPreviewRows =
    previewRows.length;

  /*
   * ------------------------------------------------------------
   * FINAL PREVIEW DUPLICATE CHECK
   * ------------------------------------------------------------
   */

  const finalIdIndex =
    buildIndex(
      previewRows,
      "Internal ID"
    );

  const finalPartIndex =
    buildIndex(
      previewRows,
      "IHI Part Number"
    );

  const finalDuplicateIds =
    findDuplicateKeys(
      finalIdIndex
    );

  const finalDuplicateParts =
    findDuplicateKeys(
      finalPartIndex
    );

  if (
    finalDuplicateIds.length ||
    finalDuplicateParts.length
  ) {
    throw new Error(
      `Merged preview produced duplicate identities. ` +
        `Duplicate IDs: ${finalDuplicateIds.length}. ` +
        `Duplicate part numbers: ${finalDuplicateParts.length}.`
    );
  }

  /*
   * ------------------------------------------------------------
   * WRITE PREVIEW
   * ------------------------------------------------------------
   */

  writeCsv(
    PREVIEW_PATH,
    REQUIRED_HEADERS,
    previewRows
  );

  /*
   * ------------------------------------------------------------
   * WRITE AUDIT
   * ------------------------------------------------------------
   */

  const auditHeaders = [
    "Internal ID",
    "IHI Part Number",
    "Result",
    "Existing MCN",
    "New MCN",
    "Existing Status",
    "New Status",
    "Existing Rule",
    "New Rule",
    "Manufacturer / Match Hint",
    "Notes",
  ];

  writeCsv(
    AUDIT_PATH,
    auditHeaders,
    auditRows
  );

  /*
   * ------------------------------------------------------------
   * SUMMARY
   * ------------------------------------------------------------
   */

  const passed =
    summary.conflicts === 0 &&
    summary.finalPreviewRows ===
      (
        summary.existingOverrides +
        summary.added
      );

  const fullSummary = {
    version:
      "MCN-v5-merge-preview",

    passed,

    ...summary,

    expectedCurrentBatch: {
      existingOverrides:
        534,

      newAdditions:
        287,

      expectedFinal:
        821,
    },

    structuralChecks: {
      duplicateMasterInternalIds:
        duplicateMasterIds.length,

      duplicateMasterPartNumbers:
        duplicateMasterParts.length,

      duplicateAdditionInternalIds:
        duplicateAdditionIds.length,

      duplicateAdditionPartNumbers:
        duplicateAdditionParts.length,

      duplicateFinalInternalIds:
        finalDuplicateIds.length,

      duplicateFinalPartNumbers:
        finalDuplicateParts.length,
    },

    files: {
      permanentMaster:
        MASTER_PATH,

      additions:
        ADDITIONS_PATH,

      preview:
        PREVIEW_PATH,

      audit:
        AUDIT_PATH,
    },
  };

  fs.writeFileSync(
    SUMMARY_PATH,
    `${JSON.stringify(
      fullSummary,
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

  console.log(
    "===== MCN V5 MERGE PREVIEW SUMMARY ====="
  );

  console.log(
    `Existing verified overrides: ${summary.existingOverrides}`
  );

  console.log(
    `New v5 additions:            ${summary.newAdditions}`
  );

  console.log(
    `✅ Added:                     ${summary.added}`
  );

  console.log(
    `ℹ️ Already same:              ${summary.alreadySame}`
  );

  console.log(
    `⚠️ Conflicts:                 ${summary.conflicts}`
  );

  console.log(
    `   Identity conflicts:        ${summary.identityConflicts}`
  );

  console.log(
    `   MCN conflicts:             ${summary.mcnConflicts}`
  );

  console.log(
    `   Ambiguous matches:         ${summary.ambiguousMatches}`
  );

  console.log(
    `Final preview rows:           ${summary.finalPreviewRows}`
  );

  console.log("");

  console.log(
    "Structural duplicate checks:"
  );

  console.log(
    `Master duplicate IDs:         ${duplicateMasterIds.length}`
  );

  console.log(
    `Master duplicate parts:       ${duplicateMasterParts.length}`
  );

  console.log(
    `Addition duplicate IDs:       ${duplicateAdditionIds.length}`
  );

  console.log(
    `Addition duplicate parts:     ${duplicateAdditionParts.length}`
  );

  console.log(
    `Final duplicate IDs:          ${finalDuplicateIds.length}`
  );

  console.log(
    `Final duplicate parts:        ${finalDuplicateParts.length}`
  );

  console.log("");

  console.log(
    `Preview: ${PREVIEW_PATH}`
  );

  console.log(
    `Audit:   ${AUDIT_PATH}`
  );

  console.log(
    `Summary: ${SUMMARY_PATH}`
  );

  console.log("");

  if (
    passed &&
    summary.existingOverrides === 534 &&
    summary.newAdditions === 287 &&
    summary.added === 287 &&
    summary.finalPreviewRows === 821
  ) {
    console.log(
      "✅ V5 merge preview passed perfectly."
    );

    console.log(
      "✅ 534 existing + 287 new = 821 verified MCN overrides."
    );

    console.log(
      "✅ No duplicate identities or contradictory MCNs were detected."
    );

    console.log(
      "ℹ️ Permanent manufacturer-matching-mcn-overrides.csv has NOT been modified."
    );
  } else if (passed) {
    console.log(
      "✅ Merge preview passed structural validation."
    );

    console.log(
      "ℹ️ Counts differ from the expected 534 + 287 checkpoint, so review before promotion."
    );

    console.log(
      "ℹ️ Permanent manufacturer-matching-mcn-overrides.csv has NOT been modified."
    );
  } else {
    console.log(
      "⚠️ Merge preview contains conflicts. Do NOT replace the permanent MCN override file."
    );

    console.log(
      "ℹ️ Permanent manufacturer-matching-mcn-overrides.csv has NOT been modified."
    );
  }
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN v5 merge preview failed:",
    err
  );

  process.exit(1);
}
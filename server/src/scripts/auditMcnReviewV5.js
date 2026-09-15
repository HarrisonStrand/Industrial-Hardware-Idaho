// server/src/scripts/auditMcnReviewV5.js
//
// Audits the CURRENT MCN review population after v4.2 verified overrides.
//
// Input:
//   server/tmp/manufacturer-matching-mcn-review-v4.csv
//
// Outputs:
//   server/tmp/mcn-review-v5-status-summary.csv
//   server/tmp/mcn-review-v5-vendor-summary.csv
//   server/tmp/mcn-review-v5-priority-groups.csv
//   server/tmp/mcn-review-v5-samples.csv
//   server/tmp/mcn-review-v5-summary.json

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

function clean(value = "") {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(text) {
  const rows = [];

  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quoted) {
      if (
        ch === '"' &&
        text[i + 1] === '"'
      ) {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }

      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(
        cell.replace(/\r$/, "")
      );

      rows.push(row);

      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (
    cell.length ||
    row.length
  ) {
    row.push(
      cell.replace(/\r$/, "")
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
    parsed.slice(1).map(
      (values) => {
        const row = {};

        for (
          let i = 0;
          i < headers.length;
          i += 1
        ) {
          row[
            headers[i]
          ] =
            values[i] ?? "";
        }

        return row;
      }
    );

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

    ...rows.map(
      (row) =>
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

function increment(
  map,
  key,
  amount = 1
) {
  map.set(
    key,
    (map.get(key) || 0) +
      amount
  );
}

function sortedCounts(map) {
  return Array.from(
    map.entries()
  )
    .map(
      ([value, count]) => ({
        value,
        count,
      })
    )
    .sort(
      (a, b) =>
        b.count -
          a.count ||
        a.value.localeCompare(
          b.value
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
      `Review file not found:\n${INPUT_PATH}`
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

  const rows =
    parsed.rows;

  if (!rows.length) {
    throw new Error(
      "Review CSV contains no rows."
    );
  }

  const required = [
    "Internal ID",
    "IHI Part Number",
    "MCN",
    "MCN Candidate",
    "MCN Match Status",
    "IHI Description",
    "Vendor / Manufacturer",
    "Category",
    "Subcategory",
  ];

  const missing =
    required.filter(
      (header) =>
        !parsed.headers.includes(
          header
        )
    );

  if (missing.length) {
    throw new Error(
      `Missing required columns: ${missing.join(", ")}`
    );
  }

  /*
   * --------------------------------------------------------------------------
   * STATUS COUNTS
   * --------------------------------------------------------------------------
   */

  const statusCounts =
    new Map();

  for (const row of rows) {
    const status =
      clean(
        row[
          "MCN Match Status"
        ]
      ) || "(blank)";

    increment(
      statusCounts,
      status
    );
  }

  const statusSummary =
    sortedCounts(
      statusCounts
    ).map(
      (item) => ({
        Status:
          item.value,

        Count:
          item.count,

        Percent:
          Number(
            (
              item.count /
              rows.length *
              100
            ).toFixed(2)
          ),
      })
    );

  /*
   * --------------------------------------------------------------------------
   * VENDOR SUMMARY
   * --------------------------------------------------------------------------
   */

  const vendors =
    new Map();

  function getVendorBucket(
    vendor
  ) {
    const key =
      clean(vendor) ||
      "(blank)";

    if (
      !vendors.has(key)
    ) {
      vendors.set(
        key,
        {
          vendor: key,

          total: 0,

          unverifiedClean: 0,

          possibleSecondary: 0,

          needsReview: 0,

          other: 0,

          candidatePresent: 0,

          candidateMissing: 0,

          categories:
            new Set(),

          subcategories:
            new Set(),

          hints:
            new Set(),
        }
      );
    }

    return vendors.get(
      key
    );
  }

  for (const row of rows) {
    const vendor =
      clean(
        row[
          "Vendor / Manufacturer"
        ]
      ) || "(blank)";

    const status =
      clean(
        row[
          "MCN Match Status"
        ]
      );

    const candidate =
      clean(
        row[
          "MCN Candidate"
        ]
      );

    const bucket =
      getVendorBucket(
        vendor
      );

    bucket.total += 1;

    if (
      status ===
      "unverified-clean-candidate"
    ) {
      bucket.unverifiedClean +=
        1;
    } else if (
      status ===
      "possible-secondary-token"
    ) {
      bucket.possibleSecondary +=
        1;
    } else if (
      status ===
      "needs-review"
    ) {
      bucket.needsReview +=
        1;
    } else {
      bucket.other +=
        1;
    }

    if (candidate) {
      bucket.candidatePresent +=
        1;
    } else {
      bucket.candidateMissing +=
        1;
    }

    const category =
      clean(
        row.Category
      );

    const subcategory =
      clean(
        row.Subcategory
      );

    const hint =
      clean(
        row[
          "Manufacturer Match Hint"
        ]
      );

    if (category) {
      bucket.categories.add(
        category
      );
    }

    if (subcategory) {
      bucket.subcategories.add(
        subcategory
      );
    }

    if (hint) {
      bucket.hints.add(
        hint
      );
    }
  }

  const vendorSummary =
    Array.from(
      vendors.values()
    )
      .map(
        (bucket) => ({
          "Vendor / Manufacturer":
            bucket.vendor,

          "Total Review":
            bucket.total,

          "Unverified Clean":
            bucket.unverifiedClean,

          "Possible Secondary":
            bucket.possibleSecondary,

          "Needs Review":
            bucket.needsReview,

          Other:
            bucket.other,

          "Candidate Present":
            bucket.candidatePresent,

          "Candidate Missing":
            bucket.candidateMissing,

          Categories:
            Array.from(
              bucket.categories
            )
              .sort()
              .join(" | "),

          Subcategories:
            Array.from(
              bucket.subcategories
            )
              .sort()
              .join(" | "),

          "Manufacturer Hints":
            Array.from(
              bucket.hints
            )
              .sort()
              .join(" | "),
        })
      )
      .sort(
        (a, b) =>
          b["Total Review"] -
            a["Total Review"] ||
          a[
            "Vendor / Manufacturer"
          ].localeCompare(
            b[
              "Vendor / Manufacturer"
            ]
          )
      );

  /*
   * --------------------------------------------------------------------------
   * VENDOR + STATUS PRIORITY GROUPS
   * --------------------------------------------------------------------------
   */

  const groupMap =
    new Map();

  for (const row of rows) {
    const vendor =
      clean(
        row[
          "Vendor / Manufacturer"
        ]
      ) || "(blank)";

    const status =
      clean(
        row[
          "MCN Match Status"
        ]
      ) || "(blank)";

    const key =
      `${vendor}|||${status}`;

    if (
      !groupMap.has(key)
    ) {
      groupMap.set(
        key,
        {
          vendor,
          status,
          count: 0,
          candidatePresent: 0,
          candidateMissing: 0,
          categories:
            new Set(),
          subcategories:
            new Set(),
          samples: [],
        }
      );
    }

    const group =
      groupMap.get(key);

    group.count += 1;

    if (
      clean(
        row[
          "MCN Candidate"
        ]
      )
    ) {
      group.candidatePresent +=
        1;
    } else {
      group.candidateMissing +=
        1;
    }

    if (
      clean(row.Category)
    ) {
      group.categories.add(
        clean(row.Category)
      );
    }

    if (
      clean(row.Subcategory)
    ) {
      group.subcategories.add(
        clean(
          row.Subcategory
        )
      );
    }

    if (
      group.samples.length <
      5
    ) {
      group.samples.push(
        row
      );
    }
  }

  const groups =
    Array.from(
      groupMap.values()
    )
      .sort(
        (a, b) =>
          b.count -
            a.count ||
          a.vendor.localeCompare(
            b.vendor
          ) ||
          a.status.localeCompare(
            b.status
          )
      );

  const priorityGroups =
    groups.map(
      (group) => ({
        "Vendor / Manufacturer":
          group.vendor,

        "MCN Match Status":
          group.status,

        Count:
          group.count,

        "Candidate Present":
          group.candidatePresent,

        "Candidate Missing":
          group.candidateMissing,

        Categories:
          Array.from(
            group.categories
          )
            .sort()
            .join(" | "),

        Subcategories:
          Array.from(
            group.subcategories
          )
            .sort()
            .join(" | "),
      })
    );

  /*
   * --------------------------------------------------------------------------
   * SAMPLES
   * --------------------------------------------------------------------------
   *
   * Keep five representative rows from each of
   * the largest 75 vendor/status groups.
   */

  const sampleRows = [];

  for (
    const group
    of groups.slice(
      0,
      75
    )
  ) {
    for (
      const row
      of group.samples
    ) {
      sampleRows.push({
        "Vendor / Manufacturer":
          group.vendor,

        "MCN Match Status":
          group.status,

        "Group Count":
          group.count,

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

        "MCN Candidate":
          clean(
            row[
              "MCN Candidate"
            ]
          ),

        "IHI Description":
          clean(
            row[
              "IHI Description"
            ]
          ),

        Category:
          clean(
            row.Category
          ),

        Subcategory:
          clean(
            row.Subcategory
          ),

        "Manufacturer Match Hint":
          clean(
            row[
              "Manufacturer Match Hint"
            ]
          ),

        "MCN Rule":
          clean(
            row[
              "MCN Rule"
            ]
          ),
      });
    }
  }

  /*
   * --------------------------------------------------------------------------
   * WRITE OUTPUTS
   * --------------------------------------------------------------------------
   */

  const statusPath =
    path.join(
      OUTPUT_DIR,
      "mcn-review-v5-status-summary.csv"
    );

  const vendorPath =
    path.join(
      OUTPUT_DIR,
      "mcn-review-v5-vendor-summary.csv"
    );

  const groupPath =
    path.join(
      OUTPUT_DIR,
      "mcn-review-v5-priority-groups.csv"
    );

  const samplePath =
    path.join(
      OUTPUT_DIR,
      "mcn-review-v5-samples.csv"
    );

  const jsonPath =
    path.join(
      OUTPUT_DIR,
      "mcn-review-v5-summary.json"
    );

  writeCsv(
    statusPath,
    [
      "Status",
      "Count",
      "Percent",
    ],
    statusSummary
  );

  writeCsv(
    vendorPath,
    [
      "Vendor / Manufacturer",
      "Total Review",
      "Unverified Clean",
      "Possible Secondary",
      "Needs Review",
      "Other",
      "Candidate Present",
      "Candidate Missing",
      "Categories",
      "Subcategories",
      "Manufacturer Hints",
    ],
    vendorSummary
  );

  writeCsv(
    groupPath,
    [
      "Vendor / Manufacturer",
      "MCN Match Status",
      "Count",
      "Candidate Present",
      "Candidate Missing",
      "Categories",
      "Subcategories",
    ],
    priorityGroups
  );

  writeCsv(
    samplePath,
    [
      "Vendor / Manufacturer",
      "MCN Match Status",
      "Group Count",
      "Internal ID",
      "IHI Part Number",
      "MCN Candidate",
      "IHI Description",
      "Category",
      "Subcategory",
      "Manufacturer Match Hint",
      "MCN Rule",
    ],
    sampleRows
  );

  const summary = {
    totalReviewRows:
      rows.length,

    statusSummary,

    topVendors:
      vendorSummary.slice(
        0,
        50
      ),

    topPriorityGroups:
      priorityGroups.slice(
        0,
        100
      ),

    outputs: {
      statusSummary:
        statusPath,

      vendorSummary:
        vendorPath,

      priorityGroups:
        groupPath,

      samples:
        samplePath,
    },
  };

  fs.writeFileSync(
    jsonPath,
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
    "===== MCN REVIEW V5 AUDIT ====="
  );

  console.log(
    `Total review rows: ${rows.length}`
  );

  console.log("");
  console.log(
    "STATUS SUMMARY"
  );

  console.table(
    statusSummary
  );

  console.log("");
  console.log(
    "TOP 25 VENDORS"
  );

  console.table(
    vendorSummary
      .slice(
        0,
        25
      )
      .map(
        (row) => ({
          Vendor:
            row[
              "Vendor / Manufacturer"
            ],

          Total:
            row[
              "Total Review"
            ],

          Clean:
            row[
              "Unverified Clean"
            ],

          Secondary:
            row[
              "Possible Secondary"
            ],

          NeedsReview:
            row[
              "Needs Review"
            ],
        })
      )
  );

  console.log("");
  console.log(
    "TOP 30 VENDOR / STATUS GROUPS"
  );

  console.table(
    priorityGroups
      .slice(
        0,
        30
      )
      .map(
        (row) => ({
          Vendor:
            row[
              "Vendor / Manufacturer"
            ],

          Status:
            row[
              "MCN Match Status"
            ],

          Count:
            row.Count,

          WithCandidate:
            row[
              "Candidate Present"
            ],
        })
      )
  );

  console.log("");
  console.log("Outputs:");
  console.log(
    `Status:   ${statusPath}`
  );
  console.log(
    `Vendors:  ${vendorPath}`
  );
  console.log(
    `Groups:   ${groupPath}`
  );
  console.log(
    `Samples:  ${samplePath}`
  );
  console.log(
    `JSON:     ${jsonPath}`
  );
}

try {
  main();
} catch (err) {
  console.error(
    "❌ MCN review v5 audit failed:",
    err
  );

  process.exit(1);
}
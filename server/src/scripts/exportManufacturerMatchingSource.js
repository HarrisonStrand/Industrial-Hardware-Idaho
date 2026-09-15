// server/src/scripts/exportManufacturerMatchingSource.js
// Manufacturer-matching export for IHI — v4.2 conservative verified MCN resolver.
//
// Key identifier rules:
//   Internal ID     = Fishbowl partId when available, otherwise Mongo Product _id.
//   IHI Part Number = IHI/Fishbowl part number exactly as stored by IHI.
//   MCN             = manufacturer catalog number ONLY when it can be resolved safely.
//
// The exporter intentionally does NOT copy the IHI Part Number into MCN by default.
// Unverified possibilities are placed in MCN Candidate and flagged for review instead.
//
// -----------------------------------------------------------------------------
// VENDOR / TAXONOMY OVERRIDES
// -----------------------------------------------------------------------------
//
// Optional current-catalog override file:
//
//   MANUFACTURER_MATCHING_OVERRIDES=/absolute/path/to/manufacturer-matching-overrides.csv
//
// or place it at:
//
//   server/tmp/manufacturer-matching-overrides.csv
//
// Expected columns:
//
//   IHI Part Number
//   Vendor / Manufacturer
//   Category
//   Subcategory
//
// -----------------------------------------------------------------------------
// VERIFIED MCN OVERRIDES
// -----------------------------------------------------------------------------
//
// Optional verified MCN override file:
//
//   MANUFACTURER_MATCHING_MCN_OVERRIDES=/absolute/path/to/manufacturer-matching-mcn-overrides.csv
//
// or place it at:
//
//   server/tmp/manufacturer-matching-mcn-overrides.csv
//
// Expected columns:
//
//   Internal ID
//   IHI Part Number
//   MCN
//   Manufacturer / Match Hint
//   MCN Match Status
//   Rule
//   IHI Description
//
// Verified MCN overrides take precedence over heuristic/rule-based MCN resolution.
//
// Matching precedence:
//
//   1. Internal ID + matching IHI Part Number
//   2. Exact IHI Part Number
//   3. Existing automatic MCN resolver
//   4. Existing manufacturerMcnRules.js verified rules

import "../config/env.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

import {
  applyVerifiedMcnRules,
  V4_IMPORT_READY_STATUSES,
} from "../services/catalog/manufacturerMcnRules.js";

function clean(value = "") {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value = "") {
  return clean(value).toLowerCase();
}

function csvCell(value) {
  const text =
    value === null || value === undefined
      ? ""
      : String(value);

  return `"${text.replace(/"/g, '""')}"`;
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

  return rows;
}

/*
 * =============================================================================
 * VENDOR / CATEGORY / SUBCATEGORY OVERRIDES
 * =============================================================================
 */

function loadOverrides() {
  const configured = clean(
    process.env.MANUFACTURER_MATCHING_OVERRIDES
  );

  const defaultPath = path.resolve(
    process.cwd(),
    "tmp",
    "manufacturer-matching-overrides.csv"
  );

  const overridePath =
    configured
      ? path.resolve(configured)
      : defaultPath;

  if (
    !fs.existsSync(overridePath)
  ) {
    console.log(
      `ℹ️ No manufacturer-matching override CSV found at ${overridePath}`
    );

    return {
      path: "",
      map: new Map(),
    };
  }

  const parsed = parseCsv(
    fs.readFileSync(
      overridePath,
      "utf8"
    )
  );

  if (
    parsed.length < 2
  ) {
    console.warn(
      `⚠️ Override CSV is empty: ${overridePath}`
    );

    return {
      path: overridePath,
      map: new Map(),
    };
  }

  const header =
    parsed[0].map(
      (value) => clean(value)
    );

  const indexOf = (...names) => {
    for (const name of names) {
      const idx =
        header.findIndex(
          (value) =>
            value.toLowerCase() ===
            name.toLowerCase()
        );

      if (idx >= 0) {
        return idx;
      }
    }

    return -1;
  };

  const partIdx =
    indexOf(
      "IHI Part Number",
      "Part Number"
    );

  const vendorIdx =
    indexOf(
      "Vendor / Manufacturer",
      "Vendor",
      "Website Vendor"
    );

  const categoryIdx =
    indexOf("Category");

  const subcategoryIdx =
    indexOf("Subcategory");

  if (partIdx < 0) {
    throw new Error(
      `Override CSV is missing an IHI Part Number column: ${overridePath}`
    );
  }

  const map = new Map();

  for (
    const row
    of parsed.slice(1)
  ) {
    const partNumber =
      clean(row[partIdx]);

    if (!partNumber) {
      continue;
    }

    map.set(
      partNumber.toLowerCase(),
      {
        vendor:
          vendorIdx >= 0
            ? clean(row[vendorIdx])
            : "",

        category:
          categoryIdx >= 0
            ? clean(row[categoryIdx])
            : "",

        subcategory:
          subcategoryIdx >= 0
            ? clean(row[subcategoryIdx])
            : "",
      }
    );
  }

  console.log(
    `✅ Loaded ${map.size} manufacturer-matching overrides from ${overridePath}`
  );

  return {
    path: overridePath,
    map,
  };
}

/*
 * =============================================================================
 * VERIFIED MCN OVERRIDES
 * =============================================================================
 */

function loadMcnOverrides() {
  const configured = clean(
    process.env.MANUFACTURER_MATCHING_MCN_OVERRIDES
  );

  const defaultPath = path.resolve(
    process.cwd(),
    "tmp",
    "manufacturer-matching-mcn-overrides.csv"
  );

  const overridePath =
    configured
      ? path.resolve(configured)
      : defaultPath;

  if (
    !fs.existsSync(overridePath)
  ) {
    console.log(
      `ℹ️ No verified MCN override CSV found at ${overridePath}`
    );

    return {
      path: "",
      rows: [],
      byInternalId: new Map(),
      byPartNumber: new Map(),
    };
  }

  const parsed = parseCsv(
    fs.readFileSync(
      overridePath,
      "utf8"
    )
  );

  if (
    parsed.length < 2
  ) {
    console.warn(
      `⚠️ Verified MCN override CSV is empty: ${overridePath}`
    );

    return {
      path: overridePath,
      rows: [],
      byInternalId: new Map(),
      byPartNumber: new Map(),
    };
  }

  const header =
    parsed[0].map(
      (value) => clean(value)
    );

  const indexOf = (...names) => {
    for (const name of names) {
      const idx =
        header.findIndex(
          (value) =>
            value.toLowerCase() ===
            name.toLowerCase()
        );

      if (idx >= 0) {
        return idx;
      }
    }

    return -1;
  };

  const internalIdIdx =
    indexOf(
      "Internal ID",
      "InternalID",
      "Product ID"
    );

  const partIdx =
    indexOf(
      "IHI Part Number",
      "Part Number"
    );

  const mcnIdx =
    indexOf(
      "MCN",
      "Manufacturer Catalog Number"
    );

  const statusIdx =
    indexOf(
      "MCN Match Status",
      "MCN Status"
    );

  const manufacturerIdx =
    indexOf(
      "Manufacturer / Match Hint",
      "Manufacturer Match Hint"
    );

  const ruleIdx =
    indexOf(
      "Rule",
      "MCN Rule",
      "V4 Rule"
    );

  const descriptionIdx =
    indexOf(
      "IHI Description",
      "Description"
    );

  if (
    partIdx < 0 ||
    mcnIdx < 0
  ) {
    throw new Error(
      `Verified MCN override CSV must contain IHI Part Number and MCN columns: ${overridePath}`
    );
  }

  const rows = [];

  const byInternalId =
    new Map();

  const byPartNumber =
    new Map();

  /*
   * Do not allow two different MCNs to be registered
   * against the same Internal ID or IHI Part Number.
   */
  function register(
    map,
    key,
    entry,
    label
  ) {
    if (!key) {
      return;
    }

    const existing =
      map.get(key);

    if (!existing) {
      map.set(
        key,
        entry
      );

      return;
    }

    if (
      normalizeKey(existing.mcn) !==
        normalizeKey(entry.mcn) ||
      normalizeKey(existing.partNumber) !==
        normalizeKey(entry.partNumber)
    ) {
      throw new Error(
        `Conflicting verified MCN overrides for ${label} '${key}': ` +
          `'${existing.mcn}' vs '${entry.mcn}'`
      );
    }
  }

  for (
    const row
    of parsed.slice(1)
  ) {
    const internalId =
      internalIdIdx >= 0
        ? clean(
            row[internalIdIdx]
          )
        : "";

    const partNumber =
      clean(
        row[partIdx]
      );

    const mcn =
      clean(
        row[mcnIdx]
      );

    if (
      !partNumber ||
      !mcn
    ) {
      continue;
    }

    const entry = {
      rowIndex:
        rows.length,

      internalId,

      partNumber,

      mcn,

      status:
        statusIdx >= 0
          ? clean(
              row[statusIdx]
            )
          : "",

      manufacturerMatchHint:
        manufacturerIdx >= 0
          ? clean(
              row[
                manufacturerIdx
              ]
            )
          : "",

      rule:
        ruleIdx >= 0
          ? clean(
              row[ruleIdx]
            )
          : "",

      description:
        descriptionIdx >= 0
          ? clean(
              row[
                descriptionIdx
              ]
            )
          : "",
    };

    rows.push(entry);

    if (internalId) {
      register(
        byInternalId,
        normalizeKey(
          internalId
        ),
        entry,
        "Internal ID"
      );
    }

    register(
      byPartNumber,
      normalizeKey(
        partNumber
      ),
      entry,
      "IHI Part Number"
    );
  }

  console.log(
    `✅ Loaded ${rows.length} verified MCN overrides from ${overridePath}`
  );

  return {
    path:
      overridePath,

    rows,

    byInternalId,

    byPartNumber,
  };
}

/*
 * Match verified MCN overrides safely.
 *
 * Preferred:
 *   Internal ID + matching IHI part number
 *
 * Fallback:
 *   exact IHI part number
 *
 * An Internal ID match whose part number disagrees
 * is never blindly accepted.
 */
function findMcnOverride({
  internalId,
  partNumber,
  mcnOverrides,
}) {
  const idKey =
    normalizeKey(
      internalId
    );

  const partKey =
    normalizeKey(
      partNumber
    );

  const idMatch =
    idKey &&
    mcnOverrides.byInternalId.has(
      idKey
    )
      ? mcnOverrides.byInternalId.get(
          idKey
        )
      : null;

  if (idMatch) {
    if (
      !idMatch.partNumber ||
      normalizeKey(
        idMatch.partNumber
      ) === partKey
    ) {
      return {
        override:
          idMatch,

        matchMethod:
          "internal-id",

        internalIdPartNumberMismatch:
          null,
      };
    }

    /*
     * Internal ID matched but the part number did not.
     *
     * Before rejecting it entirely, see whether the
     * exact current IHI part number has its own override.
     */
    const partMatch =
      partKey
        ? mcnOverrides.byPartNumber.get(
            partKey
          ) || null
        : null;

    if (partMatch) {
      return {
        override:
          partMatch,

        matchMethod:
          "part-number",

        internalIdPartNumberMismatch: {
          internalId,

          currentPartNumber:
            partNumber,

          overridePartNumber:
            idMatch.partNumber,
        },
      };
    }

    return {
      override:
        null,

      matchMethod:
        "",

      internalIdPartNumberMismatch: {
        internalId,

        currentPartNumber:
          partNumber,

        overridePartNumber:
          idMatch.partNumber,
      },
    };
  }

  const partMatch =
    partKey
      ? mcnOverrides.byPartNumber.get(
          partKey
        ) || null
      : null;

  if (partMatch) {
    return {
      override:
        partMatch,

      matchMethod:
        "part-number",

      internalIdPartNumberMismatch:
        null,
    };
  }

  return {
    override:
      null,

    matchMethod:
      "",

    internalIdPartNumberMismatch:
      null,
  };
}

function resolutionFromMcnOverride(
  entry,
  matchMethod
) {
  const rule =
    clean(entry?.rule) ||
    "verified-mcn-override";

  const status =
    clean(entry?.status) ||
    "verified-mcn-override";

  return {
    mcn:
      clean(entry?.mcn),

    mcnCandidate:
      clean(entry?.mcn),

    status,

    source:
      `verified MCN override (${matchMethod})`,

    notes:
      `Verified MCN override applied before heuristic resolution. Rule: ${rule}.`,

    mcnConfidence:
      "high",

    mcnRule:
      rule,

    manufacturerMatchHint:
      clean(
        entry?.manufacturerMatchHint
      ),
  };
}

/*
 * =============================================================================
 * EXISTING MCN RESOLUTION SUPPORT
 * =============================================================================
 */

const COMPANY_SUFFIXES =
  /\b(?:incorporated|inc\.?|llc|ltd\.?|company|co\.?|corp\.?|corporation|manufacturing|mfg\.?|products|tools|tool)\b/gi;

const STATIC_VENDOR_ALIASES = [
  "3M",
  "Milwaukee",
  "Auveco",
  "Bosch",
  "Diablo",
  "Makita",
  "DeWalt",
  "Dewalt",
  "Powers",
  "Dorman",
  "Knaack",
  "WeatherGuard",
  "Weather Guard",
  "Werner",
  "Permatex",
  "CRC",
  "DAP",
  "Loctite",
  "Gorilla Glue",
  "Gorilla",
  "Stanley",
  "Channellock",
  "Greenlee",
  "Klein",
  "Leviton",
  "Wright",
  "Morse",
  "Lenox",
  "Norseman",
  "Aervoe",
  "Oetiker",
  "Ideal Tridon",
  "Huyett",
  "Marson",
  "Helicoil",
  "Krylon",
  "Band-It",
  "Master Lock",
  "Sika",
  "Lufkin",
  "Empire",
  "Razor-Back",
  "Red Devil",
  "Truecraft",
  "LPS",
  "Haydon",
  "Vega",
  "Walter",
  "CGW",
  "Knaack",
  "Durham",
  "Brighton Best",
  "Brighton",
  "Star Stainless",
  "Tru-Cut Galaxy",
  "Tru Cut Galaxy",
  "Tru-Cut",
  "Tru Cut",
  "Galaxy",
  "Greenlite",
  "Hillsdale",
  "Greendale",
  "Scott",
  "Knaack",
  "Continental Western",
  "TC International",
  "Ideal",
];

const ABBREVIATED_VENDOR_PREFIXES =
  new Map([
    [
      "wg",
      "WeatherGuard",
    ],
  ]);

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function simplifyVendorName(
  value
) {
  return clean(value)
    .replace(
      COMPANY_SUFFIXES,
      " "
    )
    .replace(
      /[()]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function vendorAliases(
  ...values
) {
  const aliases =
    new Set(
      STATIC_VENDOR_ALIASES
    );

  for (const raw of values) {
    const value =
      clean(raw);

    if (!value) {
      continue;
    }

    aliases.add(value);

    const simplified =
      simplifyVendorName(
        value
      );

    if (
      simplified.length >= 2
    ) {
      aliases.add(
        simplified
      );
    }

    for (
      const part
      of value.split(
        /\s*(?:\/|\||,|&|\b(?:and)\b)\s*/i
      )
    ) {
      const cleanedPart =
        simplifyVendorName(
          part
        );

      if (
        cleanedPart.length >= 2
      ) {
        aliases.add(
          cleanedPart
        );
      }
    }
  }

  return [
    ...aliases,
  ]
    .map(
      (value) =>
        clean(value)
    )
    .filter(
      (value) =>
        value.length >= 2
    )
    .sort(
      (a, b) =>
        b.length -
        a.length
    );
}

function looksLikeCatalogNumber(
  value
) {
  const v =
    clean(value);

  if (
    !v ||
    v.length < 2 ||
    v.length > 80
  ) {
    return false;
  }

  if (
    !/[0-9]/.test(v)
  ) {
    return false;
  }

  if (
    /^(?:unknown|n\/a|na|null|none)$/i.test(
      v
    )
  ) {
    return false;
  }

  return true;
}

function stripVendorPrefix(
  partNumber,
  aliases
) {
  const original =
    clean(partNumber);

  if (!original) {
    return null;
  }

  for (
    const alias
    of aliases
  ) {
    const aliasPattern =
      escapeRegex(alias)
        .replace(
          /\s+/g,
          "\\s+"
        );

    const match =
      original.match(
        new RegExp(
          `^${aliasPattern}(?:\\s+|\\s*[:#]\\s*|\\s+-\\s+)(.+)$`,
          "i"
        )
      );

    if (!match) {
      continue;
    }

    const remainder =
      clean(
        match[1]
      )
        .replace(
          /^[#:\-\s]+/,
          ""
        )
        .trim();

    if (
      !looksLikeCatalogNumber(
        remainder
      )
    ) {
      continue;
    }

    return {
      mcn:
        remainder,

      strippedAlias:
        alias,
    };
  }

  const firstSpace =
    original.indexOf(" ");

  if (
    firstSpace > 0
  ) {
    const firstToken =
      original
        .slice(
          0,
          firstSpace
        )
        .toLowerCase();

    const mapped =
      ABBREVIATED_VENDOR_PREFIXES.get(
        firstToken
      );

    if (mapped) {
      const remainder =
        clean(
          original.slice(
            firstSpace + 1
          )
        );

      if (
        looksLikeCatalogNumber(
          remainder
        )
      ) {
        return {
          mcn:
            remainder,

          strippedAlias:
            mapped,
        };
      }
    }
  }

  return null;
}

function explicitManufacturerNumber(
  enrichment = {}
) {
  const attrs =
    enrichment?.attributes ||
    {};

  const candidates = [
    [
      "attributes.manufacturerPartNumber",
      attrs?.manufacturerPartNumber,
    ],
    [
      "attributes.manufacturer_part_number",
      attrs?.manufacturer_part_number,
    ],
    [
      "attributes.mcn",
      attrs?.mcn,
    ],
    [
      "attributes.manufacturerSku",
      attrs?.manufacturerSku,
    ],
    [
      "attributes.manufacturerSKU",
      attrs?.manufacturerSKU,
    ],
    [
      "attributes.mfgPartNumber",
      attrs?.mfgPartNumber,
    ],
    [
      "attributes.mfrPartNumber",
      attrs?.mfrPartNumber,
    ],
    [
      "attributes.vendorPartNumber",
      attrs?.vendorPartNumber,
    ],
    [
      "attributes.vendorPartNum",
      attrs?.vendorPartNum,
    ],
  ];

  for (
    const [
      source,
      value,
    ]
    of candidates
  ) {
    const candidate =
      clean(value);

    if (
      looksLikeCatalogNumber(
        candidate
      )
    ) {
      return {
        value:
          candidate,

        source,
      };
    }
  }

  const imagePartNumbers = [
    ...new Set(
      (
        enrichment?.images ||
        []
      )
        .map(
          (image) =>
            clean(
              image?.sourcePartNumber
            )
        )
        .filter(
          (value) =>
            looksLikeCatalogNumber(
              value
            )
        )
    ),
  ];

  if (
    imagePartNumbers.length === 1
  ) {
    return {
      value:
        imagePartNumbers[0],

      source:
        "images.sourcePartNumber",
    };
  }

  return null;
}

function secondaryTokenCandidate(
  partNumber
) {
  const original =
    clean(partNumber);

  const pieces =
    original
      .split(/\s+/)
      .filter(Boolean);

  if (
    pieces.length < 2
  ) {
    return "";
  }

  const first =
    pieces[0];

  const remainder =
    pieces
      .slice(1)
      .join(" ");

  const firstLooksInternal =
    /^[A-Z]{1,10}\d{1,8}[A-Z0-9-]*$/i.test(
      first
    );

  if (
    !firstLooksInternal ||
    !looksLikeCatalogNumber(
      remainder
    )
  ) {
    return "";
  }

  return remainder;
}

function resolveMcn({
  partNumber,
  enrichment,
  vendor,
  brand,
  websiteVendor,
  websiteBrand,
}) {
  const explicit =
    explicitManufacturerNumber(
      enrichment
    );

  if (explicit) {
    return {
      mcn:
        explicit.value,

      mcnCandidate:
        explicit.value,

      status:
        "explicit-manufacturer-field",

      source:
        explicit.source,

      notes:
        "Manufacturer catalog number came from explicit enrichment/source data.",
    };
  }

  const aliases =
    vendorAliases(
      vendor,
      brand,
      websiteVendor,
      websiteBrand
    );

  const stripped =
    stripVendorPrefix(
      partNumber,
      aliases
    );

  if (stripped) {
    return {
      mcn:
        stripped.mcn,

      mcnCandidate:
        stripped.mcn,

      status:
        "vendor-prefix-stripped",

      source:
        `IHI Part Number after stripping '${stripped.strippedAlias}'`,

      notes:
        "High-confidence cleanup: a recognized manufacturer/vendor prefix was removed from the IHI part number.",
    };
  }

  const original =
    clean(partNumber);

  if (
    original &&
    !/\s/.test(
      original
    ) &&
    looksLikeCatalogNumber(
      original
    )
  ) {
    return {
      mcn:
        "",

      mcnCandidate:
        original,

      status:
        "unverified-clean-candidate",

      source:
        "IHI Part Number",

      notes:
        "The IHI part number is already a single clean token, but it has not been proven to be the manufacturer's catalog number.",
    };
  }

  const second =
    secondaryTokenCandidate(
      original
    );

  if (second) {
    return {
      mcn:
        "",

      mcnCandidate:
        second,

      status:
        "possible-secondary-token",

      source:
        "IHI Part Number trailing token(s)",

      notes:
        "The IHI part number appears to contain an IHI/internal code followed by another catalog-like value. Review before import.",
    };
  }

  return {
    mcn:
      "",

    mcnCandidate:
      "",

    status:
      "needs-review",

    source:
      "",

    notes:
      "No responsible manufacturer catalog number could be derived automatically from the current IHI data.",
  };
}

/*
 * =============================================================================
 * EXPORT
 * =============================================================================
 */

async function main() {
  await mongoose.connect(
    process.env.MONGO_URI
  );

  console.log(
    "✅ MongoDB connected"
  );

  /*
   * Vendor / taxonomy overrides.
   */
  const {
    path:
      overridePath,

    map:
      overrideMap,
  } = loadOverrides();

  /*
   * Verified MCN overrides.
   */
  const mcnOverrides =
    loadMcnOverrides();

  const mcnOverrideStats = {
    appliedByInternalId:
      0,

    appliedByPartNumber:
      0,

    internalIdPartNumberMismatches:
      0,
  };

  const usedMcnOverrideRows =
    new Set();

  const mcnOverrideMismatchSamples =
    [];

  /*
   * ---------------------------------------------------------------------------
   * LOAD PRODUCTS
   * ---------------------------------------------------------------------------
   */

  const products =
    await Product.find(
      {
        isActive: {
          $ne: false,
        },
      },

      {
        _id: 1,

        sku: 1,

        internalPartNumber: 1,

        vendor: 1,

        brand: 1,

        isActive: 1,

        isPublished: 1,

        "review.status": 1,

        "fishbowl.partId": 1,

        "fishbowl.partNum": 1,

        "fishbowl.description": 1,
      }
    ).lean();

  const productIds =
    products.map(
      (product) =>
        product._id
    );

  /*
   * ---------------------------------------------------------------------------
   * LOAD ENRICHMENTS
   * ---------------------------------------------------------------------------
   */

  const enrichments =
    await ProductEnrichment.find(
      {
        productId: {
          $in: productIds,
        },
      },

      {
        productId: 1,

        title: 1,

        websiteBrand: 1,

        websiteVendor: 1,

        category: 1,

        subcategory: 1,

        attributes: 1,

        "images.sourcePartNumber": 1,

        "images.sourceVendor": 1,

        "images.isPrimary": 1,
      }
    ).lean();

  const enrichmentMap =
    new Map(
      enrichments.map(
        (enrichment) => [
          String(
            enrichment.productId
          ),
          enrichment,
        ]
      )
    );

  /*
   * ---------------------------------------------------------------------------
   * BUILD EXPORT ROWS
   * ---------------------------------------------------------------------------
   */

  const rows =
    products.map(
      (product) => {
        const enrichment =
          enrichmentMap.get(
            String(
              product._id
            )
          ) || {};

        const attrs =
          enrichment.attributes ||
          {};

        const ihiPartNumber =
          clean(
            product?.fishbowl?.partNum ||
            product?.sku
          );

        /*
         * Vendor/category override remains separate
         * from the verified MCN override system.
         */
        const override =
          overrideMap.get(
            ihiPartNumber.toLowerCase()
          ) || {};

        const vendor =
          clean(
            override?.vendor ||
            enrichment?.websiteVendor ||
            product?.vendor
          );

        const brand =
          clean(
            enrichment?.websiteBrand ||
            product?.brand
          );

        const category =
          clean(
            override?.category ||
            enrichment?.category
          );

        const subcategory =
          clean(
            override?.subcategory ||
            enrichment?.subcategory
          );

        const description =
          clean(
            product?.fishbowl?.description
          );

        /*
         * Fishbowl partId is the preferred Internal ID,
         * matching how this exporter historically built
         * the manufacturer-matching source file.
         */
        const fishbowlPartId =
          clean(
            product?.fishbowl?.partId
          );

        const internalId =
          fishbowlPartId ||
          String(
            product?._id ||
            ""
          );

        const internalIdSource =
          fishbowlPartId
            ? "fishbowl.partId"
            : "mongo._id";

        /*
         * ---------------------------------------------------------------------
         * VERIFIED OVERRIDE LOOKUP
         * ---------------------------------------------------------------------
         *
         * This happens BEFORE any heuristic MCN logic.
         */
        const overrideLookup =
          findMcnOverride({
            internalId,

            partNumber:
              ihiPartNumber,

            mcnOverrides,
          });

        /*
         * Record mismatched Internal ID / IHI Part Number
         * situations instead of blindly applying them.
         */
        if (
          overrideLookup
            .internalIdPartNumberMismatch
        ) {
          mcnOverrideStats
            .internalIdPartNumberMismatches +=
            1;

          if (
            mcnOverrideMismatchSamples.length <
            10
          ) {
            mcnOverrideMismatchSamples.push(
              overrideLookup
                .internalIdPartNumberMismatch
            );
          }
        }

        let mcn;

        /*
         * ---------------------------------------------------------------------
         * PATH A — VERIFIED MCN OVERRIDE
         * ---------------------------------------------------------------------
         */
        if (
          overrideLookup.override
        ) {
          mcn =
            resolutionFromMcnOverride(
              overrideLookup.override,
              overrideLookup.matchMethod
            );

          usedMcnOverrideRows.add(
            overrideLookup
              .override
              .rowIndex
          );

          if (
            overrideLookup.matchMethod ===
            "internal-id"
          ) {
            mcnOverrideStats
              .appliedByInternalId +=
              1;
          } else if (
            overrideLookup.matchMethod ===
            "part-number"
          ) {
            mcnOverrideStats
              .appliedByPartNumber +=
              1;
          }
        }

        /*
         * ---------------------------------------------------------------------
         * PATH B — NORMAL AUTOMATIC RESOLUTION
         * ---------------------------------------------------------------------
         */
        else {
          const baseMcn =
            resolveMcn({
              partNumber:
                ihiPartNumber,

              enrichment,

              vendor:
                clean(
                  product?.vendor
                ),

              brand:
                clean(
                  product?.brand
                ),

              websiteVendor:
                vendor,

              websiteBrand:
                brand,
            });

          mcn =
            applyVerifiedMcnRules({
              baseResolution:
                baseMcn,

              partNumber:
                ihiPartNumber,

              description,

              vendor,

              brand,

              category,

              subcategory,
            });
        }

        return {
          internalId,

          internalIdSource,

          ihiPartNumber,

          mcn:
            mcn.mcn,

          mcnCandidate:
            mcn.mcnCandidate,

          mcnMatchStatus:
            mcn.status,

          mcnSource:
            mcn.source,

          mcnNotes:
            mcn.notes,

          mcnConfidence:
            mcn.mcnConfidence ||
            (
              mcn.mcn
                ? "high"
                : "review"
            ),

          mcnRule:
            mcn.mcnRule ||
            mcn.status,

          manufacturerMatchHint:
            mcn.manufacturerMatchHint ||
            "",

          description,

          vendor,

          brand,

          category,

          subcategory,

          websiteTitle:
            clean(
              enrichment?.title
            ),

          familyType:
            clean(
              attrs?.familyType ||
              attrs?.fastenerTypeCanonical ||
              attrs?.fastenerType
            ),

          measurementSystem:
            clean(
              attrs?.measurementSystem
            ),

          size:
            clean(
              attrs?.size
            ),

          diameter:
            clean(
              attrs?.diameter
            ),

          threadPitch:
            clean(
              attrs?.threadPitch
            ),

          threadSeries:
            clean(
              attrs?.threadSeries ||
              attrs?.thread_series
            ),

          length:
            clean(
              attrs?.length
            ),

          material:
            clean(
              attrs?.material
            ),

          finish:
            clean(
              attrs?.finish
            ),

          grade:
            clean(
              attrs?.grade
            ),

          driveType:
            clean(
              attrs?.driveType ||
              attrs?.drive_type
            ),

          washerStandard:
            clean(
              attrs?.washerStandard
            ),

          active:
            product?.isActive !==
            false,

          published:
            !!product?.isPublished,

          reviewStatus:
            clean(
              product
                ?.review
                ?.status
            ),
        };
      }
    );

  /*
   * ---------------------------------------------------------------------------
   * SORT
   * ---------------------------------------------------------------------------
   */

  rows.sort(
    (a, b) =>
      a.ihiPartNumber.localeCompare(
        b.ihiPartNumber,
        undefined,
        {
          numeric:
            true,

          sensitivity:
            "base",
        }
      )
  );

  /*
   * ---------------------------------------------------------------------------
   * EXPORT SCHEMA
   * ---------------------------------------------------------------------------
   */

  const headers = [
    "Internal ID",
    "Internal ID Source",
    "IHI Part Number",
    "MCN",
    "MCN Candidate",
    "MCN Match Status",
    "MCN Source",
    "MCN Notes",
    "MCN Confidence",
    "MCN Rule",
    "Manufacturer Match Hint",
    "IHI Description",
    "Vendor / Manufacturer",
    "Brand",
    "Category",
    "Subcategory",
    "Website Title",
    "Family Type",
    "Measurement System",
    "Size",
    "Diameter",
    "Thread Pitch",
    "Thread Series",
    "Length",
    "Material",
    "Finish",
    "Grade",
    "Drive Type",
    "Washer Standard",
    "Active",
    "Published",
    "Review Status",
  ];

  const keys = [
    "internalId",
    "internalIdSource",
    "ihiPartNumber",
    "mcn",
    "mcnCandidate",
    "mcnMatchStatus",
    "mcnSource",
    "mcnNotes",
    "mcnConfidence",
    "mcnRule",
    "manufacturerMatchHint",
    "description",
    "vendor",
    "brand",
    "category",
    "subcategory",
    "websiteTitle",
    "familyType",
    "measurementSystem",
    "size",
    "diameter",
    "threadPitch",
    "threadSeries",
    "length",
    "material",
    "finish",
    "grade",
    "driveType",
    "washerStandard",
    "active",
    "published",
    "reviewStatus",
  ];

  /*
   * ---------------------------------------------------------------------------
   * OUTPUT PATHS
   * ---------------------------------------------------------------------------
   */

  const outputDir =
    path.resolve(
      process.cwd(),
      "tmp"
    );

  fs.mkdirSync(
    outputDir,
    {
      recursive:
        true,
    }
  );

  const csvPath =
    path.join(
      outputDir,
      "manufacturer-matching-source-v4.csv"
    );

  const jsonPath =
    path.join(
      outputDir,
      "manufacturer-matching-source-v4.json"
    );

  const readyPath =
    path.join(
      outputDir,
      "manufacturer-matching-import-ready-v4.csv"
    );

  const reviewPath =
    path.join(
      outputDir,
      "manufacturer-matching-mcn-review-v4.csv"
    );

  /*
   * ---------------------------------------------------------------------------
   * CSV BUILDER
   * ---------------------------------------------------------------------------
   */

  const toCsv =
    (items) => [
      headers
        .map(csvCell)
        .join(","),

      ...items.map(
        (row) =>
          keys
            .map(
              (key) =>
                csvCell(
                  row[key]
                )
            )
            .join(",")
      ),
    ].join("\n");

  /*
   * ---------------------------------------------------------------------------
   * IMPORT-READY CLASSIFICATION
   * ---------------------------------------------------------------------------
   *
   * Existing verified statuses remain valid.
   *
   * Additionally, anything whose source begins with
   * "verified MCN override" is considered import-ready
   * because those rows passed the separate v4.2 validation pass.
   */

  const isVerifiedOverrideRow =
    (row) =>
      clean(
        row.mcnSource
      )
        .toLowerCase()
        .startsWith(
          "verified mcn override"
        );

  const isImportReady =
    (row) =>
      Boolean(
        clean(
          row.mcn
        )
      ) &&
      (
        isVerifiedOverrideRow(
          row
        ) ||
        V4_IMPORT_READY_STATUSES.has(
          row.mcnMatchStatus
        )
      );

  const importReady =
    rows.filter(
      isImportReady
    );

  const needsReview =
    rows.filter(
      (row) =>
        !isImportReady(
          row
        )
    );

  /*
   * ---------------------------------------------------------------------------
   * WRITE OUTPUTS
   * ---------------------------------------------------------------------------
   */

  fs.writeFileSync(
    csvPath,
    toCsv(rows),
    "utf8"
  );

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      rows,
      null,
      2
    ),
    "utf8"
  );

  fs.writeFileSync(
    readyPath,
    toCsv(
      importReady
    ),
    "utf8"
  );

  fs.writeFileSync(
    reviewPath,
    toCsv(
      needsReview
    ),
    "utf8"
  );

  /*
   * ---------------------------------------------------------------------------
   * STATUS COUNTS
   * ---------------------------------------------------------------------------
   */

  const statusCounts =
    rows.reduce(
      (
        acc,
        row
      ) => {
        acc[
          row.mcnMatchStatus
        ] =
          (
            acc[
              row.mcnMatchStatus
            ] ||
            0
          ) + 1;

        return acc;
      },
      {}
    );

  /*
   * ---------------------------------------------------------------------------
   * VERIFIED OVERRIDE SUMMARY
   * ---------------------------------------------------------------------------
   */

  const appliedMcnOverrides =
    mcnOverrideStats
      .appliedByInternalId +
    mcnOverrideStats
      .appliedByPartNumber;

  const unusedMcnOverrides =
    mcnOverrides.rows.length -
    usedMcnOverrideRows.size;

  if (
    mcnOverrides.path
  ) {
    console.log("");

    console.log(
      "===== VERIFIED MCN OVERRIDE SUMMARY ====="
    );

    console.log(
      `Verified MCN override rows: ${mcnOverrides.rows.length}`
    );

    console.log(
      `✅ Applied by Internal ID: ${mcnOverrideStats.appliedByInternalId}`
    );

    console.log(
      `✅ Applied by Part Number: ${mcnOverrideStats.appliedByPartNumber}`
    );

    console.log(
      `✅ Total applied: ${appliedMcnOverrides}`
    );

    console.log(
      `⚠️ Unused override rows: ${unusedMcnOverrides}`
    );

    console.log(
      `⚠️ Internal-ID / part-number mismatches: ${mcnOverrideStats.internalIdPartNumberMismatches}`
    );

    if (
      mcnOverrideMismatchSamples.length
    ) {
      console.log(
        "Mismatch samples:"
      );

      console.table(
        mcnOverrideMismatchSamples
      );
    }

    console.log(
      `MCN overrides: ${mcnOverrides.path}`
    );

    console.log("");
  }

  /*
   * ---------------------------------------------------------------------------
   * FINAL SUMMARY
   * ---------------------------------------------------------------------------
   */

  console.log(
    `✅ Exported ${rows.length} active product records`
  );

  console.log(
    `✅ Import-ready MCNs: ${importReady.length}`
  );

  console.log(
    `⚠️ MCN review rows: ${needsReview.length}`
  );

  console.log(
    "MCN status counts:",
    statusCounts
  );

  if (
    overridePath
  ) {
    console.log(
      `Overrides: ${overridePath}`
    );
  }

  console.log(
    `Full CSV:     ${csvPath}`
  );

  console.log(
    `Import ready: ${readyPath}`
  );

  console.log(
    `MCN review:   ${reviewPath}`
  );

  console.log(
    `JSON:         ${jsonPath}`
  );

  await mongoose.disconnect();
}

main().catch(
  async (err) => {
    console.error(
      "❌ Manufacturer matching export failed:",
      err
    );

    try {
      await mongoose.disconnect();
    } catch {}

    process.exit(1);
  }
);
// server/src/services/catalog/manufacturerMcnRules.js
// Conservative, evidence-backed MCN promotion rules for IHI manufacturer matching.
//
// IMPORTANT:
// - These rules are intentionally narrower than IHI's vendor/category rules.
// - A catalog/vendor assignment is NOT, by itself, proof that the IHI part number
//   is the manufacturer's catalog number.
// - Only promote values where we have strong source-pattern evidence.

function clean(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function upper(value = "") {
  return clean(value).toUpperCase();
}

function hasWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function candidateEchoedInDescription(candidate, description) {
  const c = clean(candidate);
  const d = clean(description);
  if (!c || !d) return false;
  return d.toLowerCase().includes(c.toLowerCase());
}

const READY_BASE_STATUSES = new Set([
  "explicit-manufacturer-field",
  "vendor-prefix-stripped",
]);

const BIG_TIMBER_FAMILY_PREFIXES = [
  "BTX",
  "CTX",
  "YTX",
  "WTX",
  "STX",
  "SCTX",
  "SWD",
  "BL",
  "GL",
  "RWH",
  "VEN",
  "CAB",
  "GDW",
];

const DESCRIPTION_MANUFACTURERS = [
  ["Milwaukee", ["MILWAUKEE"]],
  ["Makita", ["MAKITA"]],
  ["Diablo Tools", ["DIABLO"]],
  ["Werner", ["WERNER"]],
  ["Durham Manufacturing", ["DURHAM"]],
  ["Norseman", ["NORSEMAN"]],
  ["DAP", ["DAP"]],
  ["Permatex", ["PERMATEX"]],
  ["Bosch", ["BOSCH"]],
  ["Lenox", ["LENOX"]],
  ["Dorman", ["DORMAN"]],
  ["Knaack", ["KNAACK"]],
  ["WeatherGuard", ["WEATHERGUARD", "WEATHER GUARD"]],
  ["Auveco", ["AUVECO"]],
  ["3M", ["3M"]],
];

export function inferManufacturerMatchHint({ description, vendor, brand }) {
  const desc = upper(description);

  for (const [manufacturer, aliases] of DESCRIPTION_MANUFACTURERS) {
    if (aliases.some((alias) => hasWord(desc, alias))) {
      return manufacturer;
    }
  }

  return clean(brand || vendor);
}

function verified({ mcn, status, source, notes, manufacturer, rule }) {
  return {
    mcn: clean(mcn),
    mcnCandidate: clean(mcn),
    status,
    source,
    notes,
    manufacturerMatchHint: manufacturer,
    mcnConfidence: "high",
    mcnRule: rule,
  };
}


function extractWrightDescriptionCatalogNumber(description) {
  const d = clean(description);
  const dUpper = d.toUpperCase();

  // Wright's current catalog uses families such as 11-06mm, 38-06mm,
  // 9AB04, 3400, 1108, etc. IHI's TOO* rows often store the actual
  // Wright catalog number at the end of the description rather than
  // in the IHI Part Number field.
  const structuredPatterns = [
    /\b((?:11|12|16|25|38|39|41|42|46|48|49)-\d{2})(?:MM)?\b/gi,
    /\b(9A[BCG]\d{2})\b/gi,
    /\b(9C\d{3})\b/gi,
    /\b(11\d{2})\b/g,
  ];

  const found = [];

  for (const pattern of structuredPatterns) {
    for (const match of d.matchAll(pattern)) {
      let value = clean(match[1]);

      if (/^(?:11|12|16|25|38|39|41|42|46|48|49)-\d{2}$/i.test(value)) {
        // These are metric catalog families. Some old IHI descriptions omit
        // the trailing "mm" even though the Wright catalog includes it.
        value = `${value.toLowerCase()}mm`;
      }

      found.push({ index: match.index ?? -1, value });
    }
  }

  const trailingNumeric = dUpper.match(/(?:#\s*)?(\d{4,5})\s*$/);
  if (trailingNumeric) {
    found.push({
      index: dUpper.lastIndexOf(trailingNumeric[1]),
      value: trailingNumeric[1],
    });
  }

  if (!found.length) return "";
  found.sort((a, b) => a.index - b.index);
  return found[found.length - 1].value;
}

const DEWALT_POWERS_CURRENT_MCN = new Map([
  ["02346Z", "02346Z-PWR"],
  ["02346Z-PWR", "02346Z-PWR"],
  ["02350", "02350-PWR"],
  ["02350-PWR", "02350-PWR"],
  ["02355", "02355-PWR"],
  ["02355-PWR", "02355-PWR"],
  ["02356Z", "02356Z-PWR"],
  ["02356Z-PWR", "02356Z-PWR"],
  ["02363Z", "02363Z-PWR"],
  ["02363Z-PWR", "02363Z-PWR"],
  ["02364Z", "02364Z-PWR"],
  ["02364Z-PWR", "02364Z-PWR"],
  ["6407SD", "6407SD-PWR"],
  ["6407SD-PWR", "6407SD-PWR"],
  ["09340", "09340-PWR"],
  ["09340-PWR", "09340-PWR"],
  ["09343", "09343-PWR"],
  ["09343-PWR", "09343-PWR"],
  ["09350", "09350-PWR"],
  ["09350-PWR", "09350-PWR"],
  ["09420", "09420-PWR"],
  ["09420-PWR", "09420-PWR"],
  ["09440", "09440-PWR"],
  ["09440-PWR", "09440-PWR"],
]);

const VEGA_VERIFIED_CATALOG_NUMBERS = new Set([
  "125CG432A",
  "125CG532A",
  "125CG632A",
  "145MN07M",
  "165BE5S",
]);

const DRILLCO_VERIFIED_TAP_NUMBERS = new Set([
  "23A120CT",
  "23E132FT",
  "206A116CB",
]);

/**
 * Apply conservative v4 MCN rules on top of the v2/base resolver.
 *
 * baseResolution shape:
 *   { mcn, mcnCandidate, status, source, notes }
 */
export function applyVerifiedMcnRules({
  baseResolution,
  partNumber,
  description,
  vendor,
  brand,
  category,
  subcategory,
}) {
  const base = baseResolution || {};
  const pn = clean(partNumber);
  const desc = clean(description);
  const descUpper = upper(desc);
  const vendorClean = clean(vendor);
  const vendorUpper = upper(vendorClean);
  const subUpper = upper(subcategory);
  const candidate = clean(base.mcnCandidate);

  // Preserve explicit manufacturer data and already-safe prefix stripping.
  if (READY_BASE_STATUSES.has(base.status) && clean(base.mcn)) {
    return {
      ...base,
      manufacturerMatchHint: inferManufacturerMatchHint({
        description: desc,
        vendor: vendorClean,
        brand,
      }),
      mcnConfidence: "high",
      mcnRule: base.status,
    };
  }

  // MAKITA: model identifiers in the IHI clean-token records match Makita's
  // model-number format and descriptions explicitly identify Makita.
  if (
    base.status === "unverified-clean-candidate"
    && candidate
    && hasWord(descUpper, "MAKITA")
  ) {
    return verified({
      mcn: candidate,
      status: "verified-manufacturer-pass-through",
      source: "IHI Part Number; description explicitly identifies Makita",
      notes: "High-confidence v3 rule: clean model number with explicit Makita description.",
      manufacturer: "Makita",
      rule: "makita-description-pass-through",
    });
  }

  // WERNER: clean model numbers such as 6104 are manufacturer model numbers;
  // only apply where the description explicitly says Werner.
  if (
    base.status === "unverified-clean-candidate"
    && candidate
    && hasWord(descUpper, "WERNER")
  ) {
    return verified({
      mcn: candidate,
      status: "verified-manufacturer-pass-through",
      source: "IHI Part Number; description explicitly identifies Werner",
      notes: "High-confidence v3 rule: clean model number with explicit Werner description.",
      manufacturer: "Werner",
      rule: "werner-description-pass-through",
    });
  }

  // DURHAM: official Durham model numbers use values such as 013-95.
  // Only apply to clean-token candidates with explicit DURHAM text.
  if (
    base.status === "unverified-clean-candidate"
    && candidate
    && hasWord(descUpper, "DURHAM")
  ) {
    return verified({
      mcn: candidate,
      status: "verified-manufacturer-pass-through",
      source: "IHI Part Number; description explicitly identifies Durham",
      notes: "High-confidence v3 rule: clean Durham model number.",
      manufacturer: "Durham Manufacturing",
      rule: "durham-description-pass-through",
    });
  }

  // MILWAUKEE: clean Milwaukee model number with explicit Milwaukee description.
  if (
    base.status === "unverified-clean-candidate"
    && candidate
    && hasWord(descUpper, "MILWAUKEE")
  ) {
    return verified({
      mcn: candidate,
      status: "verified-manufacturer-pass-through",
      source: "IHI Part Number; description explicitly identifies Milwaukee",
      notes: "High-confidence v3 rule: clean Milwaukee model number.",
      manufacturer: "Milwaukee",
      rule: "milwaukee-description-pass-through",
    });
  }

  // DIABLO: require both explicit DIABLO branding AND the candidate repeated
  // in the description. This avoids promoting old generic blade codes merely
  // because the catalog's current vendor rule says Diablo.
  if (
    base.status === "unverified-clean-candidate"
    && candidate
    && hasWord(descUpper, "DIABLO")
    && candidateEchoedInDescription(candidate, desc)
  ) {
    return verified({
      mcn: candidate,
      status: "verified-description-catalog-number",
      source: "IHI Part Number repeated in an explicitly branded Diablo description",
      notes: "High-confidence v3 rule: Diablo description repeats the exact catalog/model number.",
      manufacturer: "Diablo Tools",
      rule: "diablo-description-number-echo",
    });
  }

  // BIG TIMBER: manufacturer documentation confirms these product-family
  // prefixes as catalog/model-number families. Avoid generic wood-screw codes.
  if (
    base.status === "unverified-clean-candidate"
    && candidate
    && vendorUpper === "BIG TIMBER"
    && BIG_TIMBER_FAMILY_PREFIXES.some((prefix) => candidate.toUpperCase().startsWith(prefix))
  ) {
    return verified({
      mcn: candidate,
      status: "verified-manufacturer-family",
      source: "IHI Part Number matches a verified Big Timber catalog family prefix",
      notes: "High-confidence v3 rule: recognized Big Timber manufacturer model family.",
      manufacturer: "Big Timber",
      rule: "big-timber-verified-family-prefix",
    });
  }

  // NORSEMAN clean/secondary numeric catalog numbers.
  if (hasWord(descUpper, "NORSEMAN")) {
    if (
      ["unverified-clean-candidate", "possible-secondary-token"].includes(base.status)
      && /^\d{5}$/.test(candidate)
    ) {
      return verified({
        mcn: candidate,
        status: base.status === "possible-secondary-token"
          ? "verified-secondary-token"
          : "verified-manufacturer-pass-through",
        source: base.source || "IHI Part Number",
        notes: "High-confidence v3 rule: 5-digit Norseman catalog number in an explicitly branded record.",
        manufacturer: "Norseman",
        rule: "norseman-five-digit-catalog-number",
      });
    }

    // Some IHI rows contain an internal code but the Norseman catalog number is
    // stated explicitly in the description as #01402, #45401, #41421, etc.
    const descriptionPartNumbers = [...desc.matchAll(/#(\d{5})\b/g)].map((match) => match[1]);
    if (descriptionPartNumbers.length) {
      const extracted = descriptionPartNumbers[descriptionPartNumbers.length - 1];
      return verified({
        mcn: extracted,
        status: "verified-description-catalog-number",
        source: "Norseman part number explicitly stated in IHI Description",
        notes: "High-confidence v3 rule: extracted a 5-digit Norseman catalog number from branded description text.",
        manufacturer: "Norseman",
        rule: "norseman-description-hash-number",
      });
    }
  }

  // AUVECO E-type retaining rings: these clean numeric IHI numbers are present
  // in Auveco catalog/reference data. Keep the rule tightly constrained to this
  // product family instead of trusting every clean Auveco-assigned number.
  if (
    base.status === "unverified-clean-candidate"
    && /^\d{3,5}$/.test(candidate)
    && vendorUpper === "AUVECO"
    && subUpper === "RETAINING RINGS"
    && /E[ -]?TYPE RETAINING RING/i.test(desc)
  ) {
    return verified({
      mcn: candidate,
      status: "verified-manufacturer-family",
      source: "IHI Part Number; verified Auveco E-type retaining-ring family",
      notes: "High-confidence v3 rule: numeric Auveco E-type retaining-ring catalog number.",
      manufacturer: "Auveco",
      rule: "auveco-e-type-retaining-ring",
    });
  }


  // ---------------------------------------------------------------------------
  // V4: WRIGHT TOOL
  // ---------------------------------------------------------------------------
  // The IHI TOO* family stores an IHI/internal code in the part-number field,
  // while the description contains the real Wright Tool catalog number.
  // Restrict this rule to the explicit Wright + TOO family and strict catalog
  // number formats to avoid promoting generic dimensions or quantities.
  if (
    vendorUpper === "WRIGHT"
    && pn.toUpperCase().startsWith("TOO")
  ) {
    const wrightMcn = extractWrightDescriptionCatalogNumber(desc);
    if (wrightMcn) {
      return verified({
        mcn: wrightMcn,
        status: "verified-description-catalog-number",
        source: "Wright Tool catalog number extracted from IHI Description",
        notes: "High-confidence v4 rule: TOO-family description contains a Wright catalog number.",
        manufacturer: "Wright Tool",
        rule: "wright-too-description-catalog-number",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // V4: DEWALT / POWERS
  // ---------------------------------------------------------------------------
  // Normalize a narrow, externally verified list of legacy/bare Powers numbers
  // to DEWALT's current -PWR catalog form. Do not apply this to all anchors.
  if (vendorUpper === "DEWALT/POWERS" && candidate) {
    const currentDewaltMcn = DEWALT_POWERS_CURRENT_MCN.get(candidate.toUpperCase());
    if (currentDewaltMcn) {
      return verified({
        mcn: currentDewaltMcn,
        status: "verified-current-manufacturer-number",
        source: "Verified DEWALT/Powers current catalog mapping",
        notes: "High-confidence v4 rule: known DEWALT/Powers anchor or setting-tool number normalized to current -PWR MCN.",
        manufacturer: "DeWalt/Powers",
        rule: "dewalt-powers-current-catalog-whitelist",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // V4: VEGA
  // ---------------------------------------------------------------------------
  // Only exact Vega catalog numbers that were independently verified are
  // promoted. Broad BIT/HK/TORX IHI codes remain review-only.
  if (
    vendorUpper === "VEGA"
    && candidate
    && VEGA_VERIFIED_CATALOG_NUMBERS.has(candidate.toUpperCase())
  ) {
    return verified({
      mcn: candidate.toUpperCase(),
      status: base.status === "possible-secondary-token"
        ? "verified-secondary-token"
        : "verified-manufacturer-family",
      source: base.source || "IHI Part Number",
      notes: "High-confidence v4 rule: exact Vega catalog number verified against Vega catalog data.",
      manufacturer: "Vega",
      rule: "vega-verified-catalog-number",
    });
  }

  // ---------------------------------------------------------------------------
  // V4: MARSON / RIVETKING
  // ---------------------------------------------------------------------------
  // Old IHI KLIK rows often put Marson's 5-digit catalog number after the IHI
  // family code. Constrain to KLIK + rivet-nut rows.
  if (
    vendorUpper === "MARSON"
    && pn.toUpperCase().startsWith("KLIK")
    && /^\d{5}$/.test(candidate)
    && /RIVET[- ]?NUT/i.test(desc)
  ) {
    return verified({
      mcn: candidate,
      status: "verified-secondary-token",
      source: base.source || "IHI Part Number trailing token",
      notes: "High-confidence v4 rule: Marson KLIK rivet-nut row contains a verified 5-digit catalog number.",
      manufacturer: "Marson",
      rule: "marson-klik-five-digit-catalog-number",
    });
  }

  // A second Marson family stores an M-prefixed secondary token, while the
  // description states the manufacturer number as #47250, #47310, etc.
  if (vendorUpper === "MARSON") {
    const descriptionNumbers = [...desc.matchAll(/#(\d{5})\b/g)].map((match) => match[1]);
    if (descriptionNumbers.length) {
      const descriptionMcn = descriptionNumbers[descriptionNumbers.length - 1];
      if (candidate.toUpperCase() === `M${descriptionMcn}`) {
        return verified({
          mcn: descriptionMcn,
          status: "verified-description-catalog-number",
          source: "Marson catalog number explicitly stated in IHI Description",
          notes: "High-confidence v4 rule: description #number agrees with the M-prefixed trailing token.",
          manufacturer: "Marson",
          rule: "marson-description-hash-number",
        });
      }
    }

    // RivetKing / Industrial Rivet IPB/IPN codes are manufacturer product codes.
    if (/^(?:10|25|31)[CF][12]IP[BN]$/i.test(candidate)) {
      return verified({
        mcn: candidate.toUpperCase(),
        status: "verified-manufacturer-family",
        source: "IHI Part Number matches verified RivetKing IPB/IPN catalog format",
        notes: "High-confidence v4 rule: verified RivetKing / Industrial Rivet IPB/IPN product code.",
        manufacturer: "RivetKing / Industrial Rivet",
        rule: "rivetking-ipb-ipn-catalog-code",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // V4: TRU-CUT MASONRY BITS
  // ---------------------------------------------------------------------------
  // The legacy IHI MD* number is internal, while the trailing H/SDS/A/PB/PM/F
  // token is the Tru-Cut manufacturer part number.
  if (
    vendorUpper === "TRU CUT"
    && /^(?:H|SDS|A|PB|PM|F)\d+(?:X\d+)?$/i.test(candidate)
  ) {
    return verified({
      mcn: candidate.toUpperCase(),
      status: "verified-secondary-token",
      source: base.source || "IHI Part Number trailing token",
      notes: "High-confidence v4 rule: recognized Tru-Cut masonry-bit catalog family.",
      manufacturer: "Tru-Cut",
      rule: "trucut-masonry-catalog-family",
    });
  }

  // Some SDS-MAX rows have no base candidate but state a PM-series Tru-Cut
  // number directly in the description.
  if (vendorUpper === "TRU CUT") {
    const pmNumbers = [...desc.matchAll(/\b(PM\d+)\b/gi)].map((match) => match[1]);
    if (pmNumbers.length) {
      return verified({
        mcn: pmNumbers[pmNumbers.length - 1].toUpperCase(),
        status: "verified-description-catalog-number",
        source: "Tru-Cut PM-series catalog number explicitly stated in IHI Description",
        notes: "High-confidence v4 rule: extracted Tru-Cut PM-series SDS-MAX catalog number.",
        manufacturer: "Tru-Cut",
        rule: "trucut-pm-description-catalog-number",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // V4: DRILLCO HIDING UNDER IHI'S TRU-CUT GALAXY SOURCING LABEL
  // ---------------------------------------------------------------------------
  // "Tru-Cut Galaxy" is an IHI sourcing/vendor rule for these product families;
  // it is not always the actual manufacturer. Nitro 350N mechanics drills and
  // the verified tap codes below are Drillco catalog numbers.
  if (
    vendorUpper === "TRU-CUT GALAXY"
    && /^350N\d+[A-Z0-9]*$/i.test(candidate)
    && /NITRO.*MECHANIC/i.test(desc)
  ) {
    return verified({
      mcn: candidate.toUpperCase(),
      status: "verified-manufacturer-family",
      source: "IHI Part Number matches verified Drillco 350N Nitro Mechanics series",
      notes: "High-confidence v4 rule: actual manufacturer is Drillco; IHI vendor remains a sourcing label.",
      manufacturer: "Drillco",
      rule: "drillco-350n-nitro-family",
    });
  }

  if (
    vendorUpper === "TRU-CUT GALAXY"
    && DRILLCO_VERIFIED_TAP_NUMBERS.has(candidate.toUpperCase())
  ) {
    return verified({
      mcn: candidate.toUpperCase(),
      status: "verified-manufacturer-family",
      source: "IHI Part Number matches an independently verified Drillco tap catalog number",
      notes: "High-confidence v4 rule: actual manufacturer is Drillco; IHI vendor remains a sourcing label.",
      manufacturer: "Drillco",
      rule: "drillco-verified-tap-catalog-number",
    });
  }

  // Everything else remains conservative.
  return {
    ...base,
    manufacturerMatchHint: inferManufacturerMatchHint({
      description: desc,
      vendor: vendorClean,
      brand,
    }),
    mcnConfidence: clean(base.mcn) ? "high" : "review",
    mcnRule: base.status || "needs-review",
  };
}

export const V4_IMPORT_READY_STATUSES = new Set([
  "explicit-manufacturer-field",
  "vendor-prefix-stripped",
  "verified-manufacturer-pass-through",
  "verified-description-catalog-number",
  "verified-manufacturer-family",
  "verified-secondary-token",
  "verified-current-manufacturer-number",
]);

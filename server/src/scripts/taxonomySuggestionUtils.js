export function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalize(value = "") {
  return clean(value).toLowerCase();
}

export function slugify(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productText(product = {}, enrichment = {}) {
  const attrs = enrichment?.attributes || {};
  return [
    product?.fishbowl?.partNum,
    product?.sku,
    product?.internalPartNumber,
    product?.fishbowl?.description,
    product?.brand,
    product?.vendor,
    enrichment?.title,
    enrichment?.description,
    enrichment?.websiteBrand,
    enrichment?.websiteVendor,
    attrs.familyType,
    attrs.productType,
  ]
    .map(clean)
    .filter(Boolean)
    .join(" ");
}

function has(text = "", pattern) {
  return pattern.test(text);
}

export function currentTaxonomy(enrichment = {}, product = {}) {
  return {
    category: clean(enrichment?.category || product?.categoryHints?.[0] || ""),
    subcategory: clean(enrichment?.subcategory || product?.categoryHints?.[1] || ""),
  };
}

function proposal(category, subcategory, reason, confidence = 0.8) {
  return { category, subcategory, reason, confidence };
}

export const TARGET_CATEGORIES = {
  bitsDrivers: {
    category: "bits & drivers",
    subcategories: [
      "drill bits",
      "driver bits",
      "nut setters",
      "hanger bolt drivers",
      "hole saws & arbors",
      "taps & dies",
    ],
  },
  chemicalsPaintsSealants: {
    category: "chemicals, paints & sealants",
    subcategories: [
      "spray paint",
      "sealants & caulk",
      "adhesives & threadlockers",
      "cleaners & degreasers",
      "lubricants & penetrants",
      "anti-seize",
      "cutting & tapping fluid",
    ],
  },
};

const PROTECTED_NON_TARGET_CATEGORIES = new Set([
  "bolts",
  "screws",
  "washers",
  "nuts",
  "pins",
  "threaded rod",
  "abrasives",
  "specialty hardware",
  "auveco",
  "au-ve-co",
  "wire hardware",
  "electrical",
  "hose & tubing",
  "strut",
]);

const TARGET_CATEGORY_NORMALIZED = new Set([
  "drill bits",
  "bits & drivers",
  "chemicals, paints & sealants",
  "paints-silicone",
  "paints & silicone",
  "paint & silicone",
]);

const BITS_DRIVERS_SUBCATEGORIES = new Set([
  "drill bits",
  "driver bits",
  "nut setters",
  "hanger bolt drivers",
  "hole saws & arbors",
  "taps & dies",
]);

const CHEMICALS_SUBCATEGORIES = new Set([
  "spray paint",
  "sealants & caulk",
  "adhesives & threadlockers",
  "cleaners & degreasers",
  "lubricants & penetrants",
  "anti-seize",
  "cutting & tapping fluid",
]);

function isUncategorizedTaxonomy(current = {}) {
  const cat = normalize(current.category);
  const sub = normalize(current.subcategory);
  return !cat || cat === "uncategorized" || sub === "needs classification";
}

function isTargetTaxonomy(current = {}) {
  return TARGET_CATEGORY_NORMALIZED.has(normalize(current.category));
}

function shouldProtectExistingClassification(current = {}) {
  const cat = normalize(current.category);
  if (isUncategorizedTaxonomy(current) || isTargetTaxonomy(current)) return false;
  return PROTECTED_NON_TARGET_CATEGORIES.has(cat);
}

function isKnownFalsePositiveText(lower = "") {
  return (
    /\b(?:glove|gloves|palm\s*glove|winter\s*lined|freezer\s*knit)\b/i.test(lower) ||
    /\b(?:tap\s*bolt|tap\s+\/|\btap\s*\/\s*|c\/s\s+.*\btap\b|cap\s*screw.*\btap\b|hex\s*cap\s*screw.*\btap\b)\b/i.test(lower) ||
    /\b(?:t-tap|inline\s*fuse\s*circuit\s*tap|wire\s*tap|quick\s*tap\s*connector)\b/i.test(lower) ||
    /\b(?:cement\s*board\s*screw|cement\s*finishing\s*brush)\b/i.test(lower) ||
    /\b(?:jack\s*nut|weatherstrip|battery\s*terminal\s*cleaner\s*brush|caulking\s*gun)\b/i.test(lower) ||
    /\bsilicone[-\s]*bronze\b/i.test(lower) ||
    /\b(?:sbhn|sbsms|sb\d+.*(?:cs|hn))\b/i.test(lower)
  );
}

function isCuttingFluid(lower = "") {
  return has(lower, /\b(?:cutting|cut|tapping|tap|drilling)\s*(?:oil|fluid)\b|\btap\s*magic\b|\brapid\s*tap\b|\bcutting\s*wax\b|\ba-9\s+alum\s+cutting\s+fluid\b/i);
}

function isThreadingTool(lower = "") {
  if (isCuttingFluid(lower)) return false;
  if (isKnownFalsePositiveText(lower)) return false;
  return has(lower, /\b(?:tap\s*and\s*die|tap\s*&\s*die|tap\s*\/\s*die|threading\s*tap|extension\s*tap|left\s*hand\s*tap|combo\s*drill\s*&\s*tap|drill\s*&\s*tap|adjustable\s*tap|taper\s*tap|plug\s*tap|bottoming\s*tap|hex\s*die|round\s*die|o\.d\.\s*die|die\s*set|tap\s*set)\b/i) ||
    has(lower, /\b\d+(?:\/\d+)?-\d+\s*x?\s*\d*(?:-\d+\/\d+)?\s*(?:tap|die)\b/i);
}

function isDrillBit(lower = "") {
  if (isKnownFalsePositiveText(lower)) return false;
  return has(lower, /\bdrill\s*bit\b|\bjobber\b|\bspade\s*bit\b|\bmasonry\s*bit\b|\bblack\s*oxide\s*drill\b|\bcobalt\s*drill\b|\btwist\s*drill\b|\bstep\s*drill\b|\bannular\s*cutter\b|\bcountersink\b|\bscrew\s*extractor\s*\/\s*drill\s*bit\b/i) ||
    has(lower, /\bsds\s*(?:plus|max)?\s*(?:rotary\s*hammer\s*)?(?:drill\s*)?bit\b|\brotary\s*hammer\s*bit\b/i);
}

function isHoleSawOrArbor(lower = "") {
  if (isKnownFalsePositiveText(lower)) return false;
  return has(lower, /\bhole\s*saw\b|\bhole\s*saw\s*arbor\b|\bhole\s*saw\s*extension\b|\bannular\s*pilot\s*bit\b|\bpilot\s*bit\b/i);
}

function isDriverBit(lower = "") {
  if (isKnownFalsePositiveText(lower)) return false;
  return has(lower, /\bdriver\s*bit\b|\binsert\s*bit\b|\bpower\s*bit\b|\bbit\s*holder\b|\bphillips\s*bit\b|\btorx\s*bit\b|\bsquare\s*bit\b|\bslotted\s*bit\b|\bimpact\s*bit\b|\bsocket\s*bit\s*holder\b/i);
}

function isNutSetter(lower = "") {
  return has(lower, /\bnut\s*setter\b|\bnutsetter\b|\bmagnetic\s*nut\s*setter\b|\bimpact\s*nutsetter\b/i);
}

function isAdhesive(lower = "") {
  if (isKnownFalsePositiveText(lower)) return false;
  return has(lower, /\bthread\s*locker\b|\bthreadlocker\b|\bloctite\b|\badhesive\b|\bepoxy\b|\bsuper\s*glue\b|\bwood\s*glue\b|\bcontact\s*cement\b|\bconstruction\s*adhesive\b|\bj-?b\s*weld\b/i);
}

function isSealant(lower = "") {
  if (isKnownFalsePositiveText(lower)) return false;
  return has(lower, /\bcaulk\b|\bsilicone\b|\bsealant\b|\bslnt\b|\brtv\b|\bgasket\s*maker\b|\burethane\b|\bfoam\s*sealant\b|\bfire\s*stop\b/i);
}

export function suggestTaxonomy(product = {}, enrichment = {}) {
  const text = productText(product, enrichment);
  const lower = normalize(text);
  const current = currentTaxonomy(enrichment, product);
  const currentCategory = normalize(current.category);
  const currentSubcategory = normalize(current.subcategory);

  // Do not let broad keywords pull already-classified fasteners/Auveco/etc. into these two cleanup categories.
  // The exception is existing target/old target categories and uncategorized products.
  if (shouldProtectExistingClassification(current)) return null;

  // If a product is already inside one of the final target category/subcategory pairs,
  // keep it there. This prevents follow-up audits from trying to collapse every
  // Bits & Drivers item back into Drill Bits just because the category is now
  // "bits & drivers".
  if (currentCategory === "bits & drivers" && BITS_DRIVERS_SUBCATEGORIES.has(currentSubcategory)) {
    return proposal("bits & drivers", currentSubcategory, "already aligned bits & drivers taxonomy", 0.99);
  }

  if (currentCategory === "chemicals, paints & sealants" && CHEMICALS_SUBCATEGORIES.has(currentSubcategory)) {
    return proposal("chemicals, paints & sealants", currentSubcategory, "already aligned chemicals taxonomy", 0.99);
  }

  // Most specific Bits & Drivers rules first.
  if (has(lower, /\bhanger\s*bolt\s*driver\b|\bhanger\s*bolt\s*driv/i)) {
    return proposal("bits & drivers", "hanger bolt drivers", "hanger bolt driver product", 0.98);
  }

  if (currentCategory === "drill bits" || currentSubcategory === "drill bits" || isDrillBit(lower)) {
    return proposal("bits & drivers", "drill bits", "drilling/cutting bit item or old drill bits category", 0.9);
  }

  if (isNutSetter(lower)) {
    return proposal("bits & drivers", "nut setters", "nut setter / hex driver accessory", 0.9);
  }

  if (isDriverBit(lower)) {
    return proposal("bits & drivers", "driver bits", "driver bit accessory", 0.88);
  }

  if (isHoleSawOrArbor(lower)) {
    return proposal("bits & drivers", "hole saws & arbors", "hole saw / arbor accessory", 0.84);
  }

  // Chemical fluids need to come before tap/die rules so Rapid Tap / Tap Magic don't become threading tools.
  if (isCuttingFluid(lower)) {
    return proposal("chemicals, paints & sealants", "cutting & tapping fluid", "cutting/tapping/drilling fluid", 0.94);
  }

  if (isThreadingTool(lower)) {
    return proposal("bits & drivers", "taps & dies", "tap or die cutting tool", 0.78);
  }

  // Chemicals, paints, and sealants category consolidation.
  if (currentCategory === "paints-silicone" || currentCategory === "paints & silicone" || currentCategory === "paint & silicone" || currentCategory === "chemicals, paints & sealants") {
    if (currentSubcategory === "spray-paint" || currentSubcategory === "spray paint") {
      return proposal("chemicals, paints & sealants", "spray paint", "old paints/silicone category", 0.95);
    }
    if (currentSubcategory === "caulk-silicone" || currentSubcategory === "caulk & silicone") {
      return proposal("chemicals, paints & sealants", "sealants & caulk", "old paints/silicone category", 0.95);
    }
  }

  if (has(lower, /\banti\s*-?\s*seize\b|\bnever\s*seez\b|\bneverseez\b/i)) {
    return proposal("chemicals, paints & sealants", "anti-seize", "anti-seize compound", 0.96);
  }

  if (has(lower, /\bbrake\s*clean(?:er)?\b|\bcontact\s*clean(?:er)?\b|\bcarb\s*clean(?:er)?\b|\bdegreaser\b|\bparts\s*clean(?:er)?\b|\belectrical\s*cleaner\b/i)) {
    return proposal("chemicals, paints & sealants", "cleaners & degreasers", "cleaner/degreaser product", 0.86);
  }

  if (has(lower, /\bcrc\b|\bwd-?40\b|\blubricant\b|\blube\b|\bpenetrant\b|\bpenetrating\s*oil\b|\bwhite\s*lithium\b|\bsilicone\s*spray\b|\bchain\s*lube\b/i)) {
    return proposal("chemicals, paints & sealants", "lubricants & penetrants", "lubricant/penetrant/CRC-type product", 0.82);
  }

  if (isAdhesive(lower)) {
    return proposal("chemicals, paints & sealants", "adhesives & threadlockers", "adhesive/threadlocker product", 0.86);
  }

  if (isSealant(lower)) {
    return proposal("chemicals, paints & sealants", "sealants & caulk", "sealant/caulk/silicone product", 0.88);
  }

  if (has(lower, /\bspray\s*paint\b|\bmarking\s*paint\b|\bconstruction\s*marking\s*paint\b|\bpaint\b|\bprimer\b|\benamel\b|\blacquer\b|\brust-?oleum\b|\bkrylon\b|\baervoe\b/i)) {
    return proposal("chemicals, paints & sealants", "spray paint", "paint/primer product", 0.84);
  }

  return null;
}

export function needsTaxonomyChange(current = {}, proposed = {}) {
  if (!proposed) return false;
  return normalize(current.category) !== normalize(proposed.category) || normalize(current.subcategory) !== normalize(proposed.subcategory);
}

export function matchesFamilyFilter(proposed = {}, familyFilter = "") {
  const family = normalize(familyFilter);
  if (!family) return true;

  const aliases = new Map([
    ["bits-drivers", "bits & drivers"],
    ["bits-and-drivers", "bits & drivers"],
    ["bits & drivers", "bits & drivers"],
    ["chemicals", "chemicals, paints & sealants"],
    ["chemicals-paints-sealants", "chemicals, paints & sealants"],
    ["chemicals-paints-and-sealants", "chemicals, paints & sealants"],
    ["chemicals, paints & sealants", "chemicals, paints & sealants"],
  ]);

  const normalizedFamily = normalize(aliases.get(family) || aliases.get(slugify(family)) || family);
  const cat = normalize(proposed?.category || "");
  const sub = normalize(proposed?.subcategory || "");
  const catSlug = slugify(proposed?.category || "");
  const subSlug = slugify(proposed?.subcategory || "");

  return cat === normalizedFamily || sub === normalizedFamily || catSlug === family || subSlug === family || catSlug === slugify(normalizedFamily) || subSlug === slugify(normalizedFamily);
}

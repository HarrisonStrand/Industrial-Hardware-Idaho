function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
  return clean(value).toLowerCase();
}

function slugify(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitle(value = "") {
  return clean(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((item) => clean(item)))];
}

function fractionFromScrewLengthCode(code = "") {
  const digits = String(code || "").replace(/\D/g, "");
  if (!digits) return "";

  // Screw codes in this data are typically 3 digits:
  // 004 = 0 + 4/16 = 1/4, 006 = 3/8, 100 = 1, 300 = 3.
  if (/^\d{3}$/.test(digits)) {
    const whole = Number(digits.slice(0, 1));
    const sixteenths = Number(digits.slice(1, 3));
    return formatWholeAndSixteenths(whole, sixteenths);
  }

  // Be tolerant of 4-digit bolt-style lengths if any anomalies show up.
  if (/^\d{4}$/.test(digits)) {
    const whole = Number(digits.slice(0, 2));
    const sixteenths = Number(digits.slice(2, 4));
    return formatWholeAndSixteenths(whole, sixteenths);
  }

  const numeric = Number(digits);
  if (!Number.isFinite(numeric)) return "";
  return String(numeric);
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

function formatWholeAndSixteenths(whole = 0, sixteenths = 0) {
  if (!Number.isFinite(whole) || !Number.isFinite(sixteenths)) return "";
  if (sixteenths === 0) return String(whole);

  const divisor = gcd(sixteenths, 16);
  const num = sixteenths / divisor;
  const den = 16 / divisor;

  return whole > 0 ? `${whole}-${num}/${den}` : `${num}/${den}`;
}

const MACHINE_HEADS = {
  MSP: { headType: "pan", familyLabel: "Machine Screw Pan" },
  MSF: { headType: "flat", familyLabel: "Machine Screw Flat" },
  MSO: { headType: "oval", familyLabel: "Machine Screw Oval" },
  MST: { headType: "truss", familyLabel: "Machine Screw Truss" },
  MSB: { headType: "binding", familyLabel: "Machine Screw Binding" },
  MSH: { headType: "hex", familyLabel: "Machine Screw Hex Head" },
  MSR: { headType: "round", familyLabel: "Machine Screw Round" },
};

const SHEET_METAL_HEADS = {
  SMSP: { headType: "pan", familyLabel: "Sheet Metal Screw Pan" },
  SMSF: { headType: "flat", familyLabel: "Sheet Metal Screw Flat" },
  SMST: { headType: "truss", familyLabel: "Sheet Metal Screw Truss" },
  SMSH: { headType: "hex", familyLabel: "Sheet Metal Screw Hex Head" },
  SSSMP: { headType: "pan", familyLabel: "Sheet Metal Screw Pan", stainless: true },
  SSSMF: { headType: "flat", familyLabel: "Sheet Metal Screw Flat", stainless: true },
  SSSMT: { headType: "truss", familyLabel: "Sheet Metal Screw Truss", stainless: true },
  SSSMH: { headType: "hex", familyLabel: "Sheet Metal Screw Hex Head", stainless: true },
};

const MACHINE_DIAMETERS = {
  "002": { diameter: "2", coarse: "56", fine: "64" },
  "003": { diameter: "3", coarse: "48", fine: "56" },
  "004": { diameter: "4", coarse: "40", fine: "48" },
  "006": { diameter: "6", coarse: "32", fine: "40" },
  "008": { diameter: "8", coarse: "32", fine: "36" },
  "010": { diameter: "10", coarse: "24", fine: "32" },
  "011": { diameter: "10", coarse: "32", fine: "32", defaultSeries: "fine" },
  "012": { diameter: "12", coarse: "24", fine: "28" },
  "040": { diameter: "1/4", coarse: "20", fine: "28" },
  "050": { diameter: "5/16", coarse: "18", fine: "24" },
  "060": { diameter: "3/8", coarse: "16", fine: "24" },
  "06": { diameter: "3/8", coarse: "16", fine: "24" },
  "080": { diameter: "1/2", coarse: "13", fine: "20" },
  "08": { diameter: "1/2", coarse: "13", fine: "20" },
  "100": { diameter: "5/8", coarse: "11", fine: "18" },
};


function findMachineDiameterByDisplay(diameter = "") {
  const target = clean(diameter).replace(/^#/, "");
  return Object.values(MACHINE_DIAMETERS).find((info) => info.diameter === target) || null;
}

function parseLengthFromDescriptionToken(value = "") {
  return clean(value).replace(/["']/g, "");
}

function inferThreadSeriesFromPitch(diaInfo = {}, pitch = "", description = "") {
  const pitchText = clean(pitch);
  if (!pitchText) {
    if (/\bSAE\b/i.test(description)) return "fine";
    if (/\bUSS\b/i.test(description)) return "coarse";
    return diaInfo.defaultSeries || "coarse";
  }

  if (pitchText === diaInfo.fine && pitchText !== diaInfo.coarse) return "fine";
  if (pitchText === diaInfo.coarse) return diaInfo.defaultSeries || "coarse";
  return pitchText === diaInfo.fine ? "fine" : "coarse";
}

function parseMachineScrewFromDescription(product = {}, context = {}) {
  const part = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  const raw = part.toUpperCase();
  const familyCode = context.familyCode || "";
  const head = MACHINE_HEADS[familyCode];
  if (!head || !description) return null;

  const numberedMatch = description.match(/\b(\d{1,2})-(\d{2})\s*[xX]\s*(\d+-\d+\/\d+|\d+\/\d+|\d+)\b/i);
  const fractionalMatch = description.match(/\b(\d+\/\d+)\s*[xX]\s*(\d+-\d+\/\d+|\d+\/\d+|\d+)\b/i);

  let diameter = "";
  let threadPitch = "";
  let length = "";
  let diaInfo = null;

  if (numberedMatch) {
    diameter = numberedMatch[1];
    threadPitch = numberedMatch[2];
    length = parseLengthFromDescriptionToken(numberedMatch[3]);
    diaInfo = findMachineDiameterByDisplay(diameter);
  } else if (fractionalMatch) {
    diameter = fractionalMatch[1];
    length = parseLengthFromDescriptionToken(fractionalMatch[2]);
    diaInfo = findMachineDiameterByDisplay(diameter);
    if (!diaInfo) return null;
    const inferredSeries = inferThreadSeriesFromPitch(diaInfo, "", description);
    threadPitch = inferredSeries === "fine" ? diaInfo.fine : diaInfo.coarse;
  }

  if (!diameter || !threadPitch || !length || !diaInfo) return null;

  const threadSeries = inferThreadSeriesFromPitch(diaInfo, threadPitch, description);
  const material = raw.startsWith("SS") || /\bs\/s\b|\bstainless\b/i.test(description)
    ? "stainless steel"
    : "steel";
  const finish = material === "stainless steel" ? "" : inferFinishFromDescription(`${part} ${description}`, material);
  const driveType = resolveMachineDriveType({
    familyCode,
    headType: head.headType,
    description,
    part,
  });
  const materialFinishLabel = materialFinish(material, finish);
  const grade = inferGradeFromDescription(description, material, finish);
  const headDetail = inferHeadDetailFromText(`${part} ${description}`);
  const size = `${diameter}-${threadPitch}`;

  const titleBits = [
    `${size} x ${length}`,
    head.familyLabel,
    headDetail ? toTitle(headDetail) : "",
    driveLabelForTitle({ headType: head.headType, driveType }),
    material === "stainless steel" ? "Stainless Steel" : toTitle(finish || material),
    threadSeries === "fine" ? "Fine Thread" : "",
  ].filter(Boolean);

  return {
    productKind: "machine",
    category: "screws",
    subcategory: "machine screws",
    familyType: "machine screw",
    fastenerType: "machine screw",
    familyCode,
    headType: head.headType,
    headDetail,
    driveType,
    measurementSystem: "imperial",
    diameter,
    threadPitch,
    threadSeries,
    length,
    size,
    material,
    finish,
    materialFinish: materialFinishLabel,
    grade,
    title: `${titleBits.join(" - ")}`.replace(" - Machine", " Machine"),
    shortTitle: `${size} x ${length} ${head.familyLabel}${headDetail ? ` ${toTitle(headDetail)}` : ""}`,
  };
}


function stripNonDriveSuffixMarkers(value = "") {
  let text = String(value || "").toUpperCase().trim();
  let changed = true;

  while (changed && text) {
    changed = false;
    for (const suffix of [
      "TEFLONCOATED",
      "TEFLONCT",
      "TEFLON",
      "SHARPIE",
      "SHARPPT",
      "SHARPPOINT",
      "SHARP",
      "UNDERCUT",
      "UN-CUT",
      "UNC",
      "UC",
      "WHITE",
      "WHT",
      "WH",
      "CLAY",
      "BEIGE",
      "TAN",
      "PLAIN",
      "BLK",
      "BG",
      "ZP",
      "NP",
      "TYPEB",
      "TYPE-B",
      "BLUNTTYPEB",
      "BLUNTB",
      "TB",
      "PX",
      "PT",
      "B",
      "F",
    ]) {
      if (text.endsWith(suffix) && text.length > suffix.length) {
        text = text.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }

  return text;
}

function inferDriveFromPartSuffix(part = "") {
  const raw = String(part || "").toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";

  // Direct explicit suffixes first.
  if (raw.endsWith("SQ")) return "square";
  if (raw.endsWith("UN")) return "unslotted";

  // Some malformed Fishbowl part numbers append inventory/finish/detail suffixes
  // after the actual drive suffix, e.g. MSB006012SNP, MSB006012SZP,
  // MSB006006SUC, or similar. Strip those non-drive markers and re-check.
  const stripped = stripNonDriveSuffixMarkers(raw);
  if (stripped.endsWith("SQ")) return "square";
  if (stripped.endsWith("UN")) return "unslotted";
  if (stripped.endsWith("P")) return "phillips";
  if (stripped.endsWith("S")) return "slotted";

  return "";
}

function fallbackDriveFromFamilyOrHead(familyCode = "", headType = "") {
  const code = clean(familyCode).toUpperCase();
  const head = normalize(headType);

  if (code === "MSB" || code === "MSR") return "slotted";
  if (head === "binding" || head === "round") return "slotted";
  if (code === "MSH" || code === "SMSH" || code === "SSSMH") return "hex";
  if (head === "hex") return "hex";

  return "";
}

function defaultMachineDriveForFamily(familyCode = "", headType = "") {
  return fallbackDriveFromFamilyOrHead(familyCode, headType);
}

function resolveMachineDriveType({ familyCode = "", headType = "", flags = {}, description = "", part = "" } = {}) {
  const text = `${part || ""} ${description || ""}`;
  const rawDriveType =
    flags.driveType ||
    inferDriveFromDescription(text) ||
    inferDriveFromPartSuffix(part) ||
    defaultMachineDriveForFamily(familyCode, headType) ||
    fallbackDriveFromFamilyOrHead(familyCode, headType);

  return normalizeHexDriveType(headType, rawDriveType);
}

function materialFinish(material = "", finish = "") {
  const mat = clean(material);
  const fin = clean(finish);
  if (!mat && !fin) return "";
  if (!fin) return mat;
  if (!mat) return fin;
  return `${mat} / ${fin}`;
}

function extractSuffix(raw = "", validDrive = true) {
  let suffix = String(raw || "").toUpperCase().replace(/[\s_-]+/g, "").trim();
  const flags = {
    driveType: "",
    threadSeries: "",
    threadType: "",
    finish: "",
    color: "",
    headDetail: "",
  };

  let changed = true;
  while (changed && suffix) {
    changed = false;

    const finishMarkers = [
      ["TEFLONCOATED", "teflon"],
      ["TEFLONCT", "teflon"],
      ["TEFLON", "teflon"],
      ["WHITE", "white"],
      ["WHT", "white"],
      ["WH", "white"],
      ["CLAY", "clay"],
      ["BEIGE", "beige"],
      ["TAN", "tan"],
      ["PLAIN", "plain"],
      ["BLK", "black"],
      ["BG", "beige"],
      ["ZP", "zinc"],
      ["NP", "zinc"],
    ];

    for (const [marker, finish] of finishMarkers) {
      if (suffix.endsWith(marker) && suffix.length > marker.length) {
        flags.finish = flags.finish || finish;
        flags.color = flags.color || finish;
        suffix = suffix.slice(0, -marker.length);
        changed = true;
        break;
      }
    }
    if (changed) continue;

    const detailMarkers = ["UNDERCUT", "UNC", "UC"];
    for (const marker of detailMarkers) {
      if (suffix.endsWith(marker) && suffix.length > marker.length) {
        flags.headDetail = flags.headDetail || "undercut";
        suffix = suffix.slice(0, -marker.length);
        changed = true;
        break;
      }
    }
    if (changed) continue;

    const threadMarkers = [
      ["SHARPIE", "sharp point"],
      ["SHARPPT", "sharp point"],
      ["SHARPPOINT", "sharp point"],
      ["SHARP", "sharp point"],
      ["TYPEB", "type b"],
      ["TYPE-B", "type b"],
      ["BLUNTTYPEB", "type b"],
      ["BLUNTB", "type b"],
      ["TB", "type b"],
    ];
    for (const [marker, threadType] of threadMarkers) {
      if (suffix.endsWith(marker) && suffix.length > marker.length) {
        flags.threadType = flags.threadType || threadType;
        suffix = suffix.slice(0, -marker.length);
        changed = true;
        break;
      }
    }
    if (changed) continue;

    // Some Fishbowl item numbers have loose trailing markers after the meaningful suffix.
    for (const marker of ["PX", "PT", "HD", "HWH", "STS", "CT", "COATED"]) {
      if (suffix.endsWith(marker) && suffix.length > marker.length) {
        suffix = suffix.slice(0, -marker.length);
        changed = true;
        break;
      }
    }
  }

  if (suffix.endsWith("SQ")) {
    flags.driveType = "square";
    suffix = suffix.slice(0, -2);
  }
  if (suffix.endsWith("UN")) {
    flags.driveType = "unslotted";
    suffix = suffix.slice(0, -2);
  }
  if (suffix.endsWith("B")) {
    flags.threadType = flags.threadType || "type b";
    suffix = suffix.slice(0, -1);
  }
  if (suffix.endsWith("F")) {
    flags.threadSeries = "fine";
    suffix = suffix.slice(0, -1);
  }

  if (validDrive && suffix.endsWith("P")) {
    flags.driveType = flags.driveType || "phillips";
    suffix = suffix.slice(0, -1);
  } else if (validDrive && suffix.endsWith("S")) {
    flags.driveType = flags.driveType || "slotted";
    suffix = suffix.slice(0, -1);
  }

  return { remaining: suffix, flags };
}

function inferDriveFromDescription(description = "") {
  const text = String(description || "");

  if (/\b(?:square|sq)\b/i.test(text)) return "square";
  if (/\b(?:torx|star[-\s]?drive|6[-\s]?lobe|six[-\s]?lobe)\b/i.test(text)) return "torx";
  if (/\b(?:un[-\s]?slotted|unslotted|un[-\s]?slot|unslot)\b/i.test(text)) return "unslotted";
  if (/\b(?:ph|phil|phillips|philips)\b/i.test(text)) return "phillips";
  if (/\b(?:sl|slot|slotted)\b/i.test(text)) return "slotted";

  return "";
}

function normalizeHexDriveType(headType = "", driveType = "") {
  const head = normalize(headType);
  const drive = normalize(driveType);

  if (head !== "hex") return clean(driveType);

  if (!drive || drive === "unslotted" || drive === "un-slotted" || drive === "hex") return "hex";
  if (drive === "slotted") return "hex/slotted";
  if (drive === "hex/slotted") return "hex/slotted";

  return drive.includes("hex") ? clean(driveType) : `hex/${drive}`;
}

function driveLabelForTitle(parsed = {}) {
  const drive = clean(parsed.driveType);
  const head = normalize(parsed.headType);

  if (!drive) return "";
  if (head === "hex" && normalize(drive) === "hex") return "";
  if (head === "hex" && normalize(drive) === "hex/slotted") return "Slotted";

  return toTitle(drive.replace(/\//g, " "));
}

function inferFinishFromDescription(text = "", material = "") {
  const raw = String(text || "");
  const mat = normalize(material);

  if (mat === "stainless steel") return "";

  // Fishbowl descriptions are not fully consistent, so keep these checks
  // tolerant of WHITE/WHT/WH/BLK/BG/ZP appearing as standalone words, suffixes,
  // or next to punctuation. WHITE must win before the default zinc fallback.
  if (/(^|[^a-z0-9])(?:black|blk)(?=$|[^a-z0-9])/i.test(raw)) return "black";
  if (/(^|[^a-z0-9])(?:white|wht|wh)(?=$|[^a-z0-9])/i.test(raw)) return "white";
  if (/(^|[^a-z0-9])clay(?=$|[^a-z0-9])/i.test(raw)) return "clay";
  if (/(^|[^a-z0-9])(?:beige|bg)(?=$|[^a-z0-9])/i.test(raw)) return "beige";
  if (/(^|[^a-z0-9])tan(?=$|[^a-z0-9])/i.test(raw)) return "tan";
  if (/(^|[^a-z0-9])(?:teflon|teflon\s*ct|teflon\s*coated)(?=$|[^a-z0-9])/i.test(raw)) return "teflon";
  if (/(^|[^a-z0-9])chrome(?=$|[^a-z0-9])/i.test(raw)) return "chrome";
  if (/(^|[^a-z0-9])plain(?=$|[^a-z0-9])/i.test(raw)) return "plain";
  if (/(^|[^a-z0-9])galv(?:anized)?(?=$|[^a-z0-9])/i.test(raw)) return "galvanized";
  if (/(^|[^a-z0-9])(?:zinc|zp)(?=$|[^a-z0-9])/i.test(raw)) return "zinc";
  return "zinc";
}


function inferGradeFromDescription(text = "", material = "", finish = "") {
  const raw = String(text || "");
  const mat = normalize(material);
  const fin = normalize(finish);

  // Stainless machine screws default to 304 unless Fishbowl explicitly says 316.
  if (mat === "stainless steel") {
    if (/\b316\b|\b316ss\b|\bss316\b|\bstainless\s*316\b|\b316\s*stainless\b/i.test(raw)) return "316";
    return "304";
  }

  // Common low-carbon machine and sheet-metal screw defaults.
  // Preserve explicit higher grades if Fishbowl says so. Otherwise, all steel
  // finishes in this screw pass default to Grade 2, including zinc, plain,
  // black, white, clay, beige, chrome, and galvanized.
  if (/\bgrade\s*8\b|\bgr\.?\s*8\b|\bgr8\b/i.test(raw)) return "grade 8";
  if (/\bgrade\s*5\b|\bgr\.?\s*5\b|\bgr5\b/i.test(raw)) return "grade 5";
  if (/\bgrade\s*2\b|\bgr\.?\s*2\b|\bgr2\b/i.test(raw)) return "grade 2";

  if (mat === "steel") return "grade 2";

  return "";
}

function parseMachineScrew(product = {}) {
  const part = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  const raw = part.toUpperCase();

  const stainless = raw.startsWith("SS");
  const codeStart = stainless ? raw.slice(2) : raw;
  const familyCode = Object.keys(MACHINE_HEADS)
    .sort((a, b) => b.length - a.length)
    .find((code) => codeStart.startsWith(code));

  if (!familyCode) return null;

  const afterFamily = codeStart.slice(familyCode.length);
  const { remaining, flags } = extractSuffix(afterFamily, true);
  if (!/^\d{5,7}$/.test(remaining)) {
    return parseMachineScrewFromDescription(product, { familyCode, stainless });
  }

  const diaCode = remaining.length === 5 ? remaining.slice(0, 2) : remaining.slice(0, 3);
  const lenCode = remaining.length === 5 ? remaining.slice(2) : remaining.slice(3);
  const diaInfo = MACHINE_DIAMETERS[diaCode] || MACHINE_DIAMETERS[diaCode.padStart(3, "0")];
  if (!diaInfo) return parseMachineScrewFromDescription(product, { familyCode, stainless });

  const threadSeries = flags.threadSeries || diaInfo.defaultSeries || "coarse";
  const threadPitch = threadSeries === "fine" ? diaInfo.fine : diaInfo.coarse;
  const length = fractionFromScrewLengthCode(lenCode);
  if (!length || length === "0") return parseMachineScrewFromDescription(product, { familyCode, stainless });

  const material = stainless || /\bs\/s\b|\bstainless\b|\bss\b/i.test(description)
    ? "stainless steel"
    : "steel";
  const finish = material === "stainless steel" ? "" : inferFinishFromDescription(`${part} ${description}`, material);
  const head = MACHINE_HEADS[familyCode];
  const driveType = resolveMachineDriveType({
    familyCode,
    headType: head.headType,
    flags,
    description,
    part,
  });
  const headDetail = inferHeadDetailFromText(`${part} ${description}`);
  const size = `${diaInfo.diameter}-${threadPitch}`;
  const materialFinishLabel = materialFinish(material, finish);
  const grade = inferGradeFromDescription(description, material, finish);
  const titleBits = [
    `${size} x ${length}`,
    head.familyLabel,
    headDetail ? toTitle(headDetail) : "",
    driveLabelForTitle({ headType: head.headType, driveType }),
    material === "stainless steel" ? "Stainless Steel" : toTitle(finish || material),
    threadSeries === "fine" ? "Fine Thread" : "",
  ].filter(Boolean);

  return {
    productKind: "machine",
    category: "screws",
    subcategory: "machine screws",
    familyType: "machine screw",
    fastenerType: "machine screw",
    familyCode,
    headType: head.headType,
    headDetail,
    driveType,
    measurementSystem: "imperial",
    diameter: diaInfo.diameter,
    threadPitch,
    threadSeries,
    length,
    size,
    material,
    finish,
    materialFinish: materialFinishLabel,
    grade,
    title: `${titleBits.join(" - ")}`.replace(" - Machine", " Machine"),
    shortTitle: `${size} x ${length} ${head.familyLabel}${headDetail ? ` ${toTitle(headDetail)}` : ""}`,
  };
}


function inferHeadDetailFromText(text = "") {
  return /\b(?:UNDERCUT|UNC|UC)\b/i.test(String(text || "")) ? "undercut" : "";
}

function inferSheetMetalThreadType(text = "", flags = {}) {
  const raw = String(text || "");
  if (/\b(?:sharp\s*pt\.?|sharp\s*point|sharp|pt\.?)(?=$|[^a-z0-9])/i.test(raw)) return "sharp point";
  if (flags.threadType) return flags.threadType;
  if (/\b(?:type[-\s]*b|blunt\s*type\s*b|sts\s*b)\b/i.test(raw)) return "type b";
  return "standard";
}

function inferSheetMetalHeadFromDescription(description = "", fallbackFamilyCode = "") {
  const text = String(description || "");
  const fallback = SHEET_METAL_HEADS[fallbackFamilyCode];

  if (/\b(?:hxw?|hex|hwh)\b/i.test(text)) return { familyCode: fallbackFamilyCode || "SMSH", headType: "hex", familyLabel: "Sheet Metal Screw Hex Head" };
  if (/\b(?:fl|fh|flat)\b/i.test(text)) return { familyCode: fallbackFamilyCode || "SMSF", headType: "flat", familyLabel: "Sheet Metal Screw Flat" };
  if (/\b(?:pn|pan)\b/i.test(text)) return { familyCode: fallbackFamilyCode || "SMSP", headType: "pan", familyLabel: "Sheet Metal Screw Pan" };
  if (/\b(?:truss|tr)\b/i.test(text)) return { familyCode: fallbackFamilyCode || "SMST", headType: "truss", familyLabel: "Sheet Metal Screw Truss" };

  return fallback ? { familyCode: fallbackFamilyCode, ...fallback } : null;
}

function parseSheetMetalScrewFromDescription(product = {}, context = {}) {
  const part = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  const rawText = `${part} ${description}`;
  if (!/\b(?:SMS|SHEET\s*METAL\s*SCREW|SHEET\s*METAL)\b/i.test(rawText)) return null;

  const head = inferSheetMetalHeadFromDescription(description, context.familyCode || "");
  if (!head) return null;

  let sizeMatch = description.match(/#\s*(\d+)\s*[xX]\s*(\d+-\d+\/\d+|\d+\/\d+|\d+)\b/i);
  let diameter = "";
  let size = "";
  let length = "";

  if (sizeMatch) {
    diameter = `#${Number(sizeMatch[1])}`;
    size = diameter;
    length = parseLengthFromDescriptionToken(sizeMatch[2]);
  } else {
    const fractionalSheetMetalMatch = description.match(/\b(\d+\/\d+)-(\d+)\s*[xX]\s*(\d+-\d+\/\d+|\d+\/\d+|\d+)\b/i);
    if (fractionalSheetMetalMatch) {
      diameter = fractionalSheetMetalMatch[1];
      size = `${fractionalSheetMetalMatch[1]}-${fractionalSheetMetalMatch[2]}`;
      length = parseLengthFromDescriptionToken(fractionalSheetMetalMatch[3]);
    }
  }

  if (!diameter || !length) return null;

  const material = context.stainless || head.stainless || /^SS/i.test(part) || /\bs\/s\b|\bstainless\b|\bss\b/i.test(description)
    ? "stainless steel"
    : "steel";
  const finish = material === "stainless steel" ? "" : (context.flags?.finish || inferFinishFromDescription(rawText, material));
  const driveType = resolveMachineDriveType({
    familyCode: head.familyCode,
    headType: head.headType,
    flags: context.flags || {},
    description,
    part,
  });
  const threadType = inferSheetMetalThreadType(rawText, context.flags || {});
  const headDetail = context.flags?.headDetail || inferHeadDetailFromText(rawText);
  const materialFinishLabel = materialFinish(material, finish);
  const grade = inferGradeFromDescription(description, material, finish);

  const titleBits = [
    `${size} x ${length}`,
    head.familyLabel,
    headDetail ? toTitle(headDetail) : "",
    driveLabelForTitle({ headType: head.headType, driveType }),
    threadType === "type b" ? "Type B" : threadType === "sharp point" ? "Sharp Point" : "",
    material === "stainless steel" ? "Stainless Steel" : toTitle(finish || material),
  ].filter(Boolean);

  return {
    productKind: "sheet-metal",
    category: "screws",
    subcategory: "sheet metal screws",
    familyType: "sheet metal screw",
    fastenerType: "sheet metal screw",
    familyCode: head.familyCode,
    headType: head.headType,
    headDetail,
    driveType,
    threadType,
    measurementSystem: "imperial",
    diameter,
    length,
    size,
    material,
    finish,
    materialFinish: materialFinishLabel,
    grade,
    title: `${titleBits.join(" - ")}`.replace(" - Sheet", " Sheet"),
    shortTitle: `${size} x ${length} ${head.familyLabel}${headDetail ? ` ${toTitle(headDetail)}` : ""}`,
  };
}

function parseSheetMetalScrew(product = {}) {
  const part = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  const raw = part.toUpperCase();

  const familyCode = Object.keys(SHEET_METAL_HEADS)
    .sort((a, b) => b.length - a.length)
    .find((code) => raw.startsWith(code));

  if (!familyCode) return parseSheetMetalScrewFromDescription(product);

  const head = SHEET_METAL_HEADS[familyCode];
  const afterFamily = raw.slice(familyCode.length);
  const { remaining, flags } = extractSuffix(afterFamily, true);

  if (!/^\d{6}$/.test(remaining)) return parseSheetMetalScrewFromDescription(product, { familyCode, head, flags, stainless: head.stainless });

  const gaugeCode = remaining.slice(0, 3);
  const lenCode = remaining.slice(3);
  const gaugeNumber = String(Number(gaugeCode));
  if (!gaugeNumber || gaugeNumber === "NaN") return parseSheetMetalScrewFromDescription(product, { familyCode, head, flags, stainless: head.stainless });

  const length = fractionFromScrewLengthCode(lenCode);
  const material = head.stainless || raw.startsWith("SS") || /\bs\/s\b|\bstainless\b|\bss\b/i.test(description)
    ? "stainless steel"
    : "steel";

  let finish = flags.finish || inferFinishFromDescription(`${part} ${description}`, material);
  if (material === "stainless steel") finish = "";

  const driveType = resolveMachineDriveType({
    familyCode,
    headType: head.headType,
    flags,
    description,
    part,
  });
  const threadType = inferSheetMetalThreadType(`${part} ${description}`, flags);
  const headDetail = flags.headDetail || inferHeadDetailFromText(`${part} ${description}`);
  const materialFinishLabel = materialFinish(material, finish);
  const grade = inferGradeFromDescription(description, material, finish);

  const titleBits = [
    `#${gaugeNumber} x ${length}`,
    head.familyLabel,
    headDetail ? toTitle(headDetail) : "",
    driveLabelForTitle({ headType: head.headType, driveType }),
    threadType === "type b" ? "Type B" : threadType === "sharp point" ? "Sharp Point" : "",
    material === "stainless steel" ? "Stainless Steel" : toTitle(finish || material),
  ].filter(Boolean);

  return {
    productKind: "sheet-metal",
    category: "screws",
    subcategory: "sheet metal screws",
    familyType: "sheet metal screw",
    fastenerType: "sheet metal screw",
    familyCode,
    headType: head.headType,
    headDetail,
    driveType,
    threadType,
    measurementSystem: "imperial",
    diameter: `#${gaugeNumber}`,
    length,
    size: `#${gaugeNumber}`,
    material,
    finish,
    materialFinish: materialFinishLabel,
    grade,
    title: `${titleBits.join(" - ")}`.replace(" - Sheet", " Sheet"),
    shortTitle: `#${gaugeNumber} x ${length} ${head.familyLabel}${headDetail ? ` ${toTitle(headDetail)}` : ""}`,
  };
}

function detectScrewProduct(product = {}) {
  return parseMachineScrew(product) || parseSheetMetalScrew(product);
}

function buildFamilyFields(parsed = {}) {
  const familyKey = [
    parsed.category,
    parsed.subcategory,
    parsed.familyType,
    parsed.headType,
    parsed.headDetail,
    parsed.driveType,
    parsed.threadType,
    parsed.material,
    parsed.finish,
    parsed.measurementSystem,
  ].filter(Boolean).map(normalize).join("|");

  const familyDriveLabel = driveLabelForTitle(parsed);
  const familyTitle = [
    parsed.material === "stainless steel" ? "Stainless Steel" : toTitle(parsed.finish || parsed.material),
    parsed.threadType === "type b" ? "Type B" : "",
    toTitle(parsed.headType),
    parsed.headDetail ? toTitle(parsed.headDetail) : "",
    toTitle(parsed.familyType),
    familyDriveLabel,
  ].filter(Boolean).join(" ");

  return {
    familyKey,
    familyTitle,
    familySlug: slugify(familyTitle),
    familyTitleBase: familyTitle,
  };
}

function buildSeoSlug(parsed = {}, product = {}) {
  const part = clean(product?.fishbowl?.partNum || product?.sku || "");
  return slugify(`${parsed.title} ${part}`);
}

function buildDescription(parsed = {}, product = {}) {
  const part = clean(product?.fishbowl?.partNum || product?.sku || "");
  const driveSentence = parsed.driveType
    ? `The ${parsed.driveType} drive is intended for common driver-bit installation and maintenance work.`
    : "The drive style is identified from the Fishbowl part number or description.";
  const materialSentence = parsed.material === "stainless steel"
    ? "Stainless steel provides improved corrosion resistance for wet, exterior, or washdown-prone environments."
    : `${toTitle(parsed.finish || "zinc")} finish is used for general-purpose corrosion protection and common shop, maintenance, and assembly applications.`;
  const useSentence = parsed.familyType === "machine screw"
    ? "Machine screws are typically used with tapped holes or matching machine-screw nuts in equipment, brackets, panels, and light-duty assemblies."
    : "Sheet metal screws are typically used for fastening sheet metal, panels, covers, brackets, and light-gauge material assemblies.";

  const headDetailSentence = parsed.headDetail ? ` This item is ${parsed.headDetail}.` : "";

  return clean(`${parsed.title} is a ${parsed.familyType} with a ${parsed.headType} head.${headDetailSentence} ${driveSentence} ${materialSentence} ${useSentence}${part ? ` Fishbowl part number: ${part}.` : ""}`);
}

function buildBulletPoints(parsed = {}) {
  return [
    parsed.size ? `Size: ${parsed.size}` : parsed.diameter ? `Size: ${parsed.diameter}` : "",
    parsed.threadPitch ? `Thread Pitch: ${parsed.threadPitch}` : "",
    parsed.threadSeries ? `Thread Series: ${parsed.threadSeries}` : "",
    parsed.threadType ? `Thread Type: ${toTitle(parsed.threadType)}` : "",
    parsed.length ? `Length: ${parsed.length}` : "",
    parsed.headType ? `Head Style: ${toTitle(parsed.headType)}` : "",
    parsed.headDetail ? `Head Detail: ${toTitle(parsed.headDetail)}` : "",
    parsed.driveType ? `Drive Type: ${toTitle(parsed.driveType.replace(/\//g, " / "))}` : "",
    parsed.materialFinish ? `Material / Finish: ${toTitle(parsed.materialFinish)}` : "",
  ].filter(Boolean);
}

export {
  clean,
  normalize,
  slugify,
  toTitle,
  uniqueStrings,
  inferDriveFromDescription,
  inferDriveFromPartSuffix,
  fallbackDriveFromFamilyOrHead,
  normalizeHexDriveType,
  detectScrewProduct,
  buildFamilyFields,
  buildSeoSlug,
  buildDescription,
  buildBulletPoints,
};

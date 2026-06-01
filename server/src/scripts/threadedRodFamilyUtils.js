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

const THREADED_ROD_DIAMETERS = {
  "004": { diameter: "#4", coarse: "40", fine: "48" },
  "006": { diameter: "#6", coarse: "32", fine: "40" },
  "008": { diameter: "#8", coarse: "32", fine: "36" },
  "010": { diameter: "#10", coarse: "24", fine: "32" },
  "012": { diameter: "#12", coarse: "24", fine: "28" },
  "020": { diameter: "1/8", coarse: "40", fine: "44" },
  "025": { diameter: "3/16", coarse: "24", fine: "32" },
  "040": { diameter: "1/4", coarse: "20", fine: "28" },
  "050": { diameter: "5/16", coarse: "18", fine: "24" },
  "060": { diameter: "3/8", coarse: "16", fine: "24" },
  "070": { diameter: "7/16", coarse: "14", fine: "20" },
  "080": { diameter: "1/2", coarse: "13", fine: "20" },
  "090": { diameter: "9/16", coarse: "12", fine: "18" },
  "100": { diameter: "5/8", coarse: "11", fine: "18" },
  "120": { diameter: "3/4", coarse: "10", fine: "16" },
  "140": { diameter: "7/8", coarse: "9", fine: "14" },
  "160": { diameter: "1", coarse: "8", fine: "12" },
  "180": { diameter: "1-1/8", coarse: "7", fine: "12" },
  "200": { diameter: "1-1/4", coarse: "7", fine: "12" },
  "240": { diameter: "1-1/2", coarse: "6", fine: "12" },
};


const METRIC_THREADED_ROD_DIAMETERS = {
  "003": { diameter: "M3", coarse: "0.5", fine: "0.35" },
  "004": { diameter: "M4", coarse: "0.7", fine: "0.5" },
  "005": { diameter: "M5", coarse: "0.8", fine: "0.5" },
  "006": { diameter: "M6", coarse: "1.0", fine: "0.75" },
  "008": { diameter: "M8", coarse: "1.25", fine: "1.0" },
  "010": { diameter: "M10", coarse: "1.5", fine: "1.25" },
  "012": { diameter: "M12", coarse: "1.75", fine: "1.5" },
  "014": { diameter: "M14", coarse: "2.0", fine: "1.5" },
  "016": { diameter: "M16", coarse: "2.0", fine: "1.5" },
  "018": { diameter: "M18", coarse: "2.5", fine: "1.5" },
  "020": { diameter: "M20", coarse: "2.5", fine: "1.5" },
  "022": { diameter: "M22", coarse: "2.5", fine: "1.5" },
  "024": { diameter: "M24", coarse: "3.0", fine: "2.0" },
  "027": { diameter: "M27", coarse: "3.0", fine: "2.0" },
  "030": { diameter: "M30", coarse: "3.5", fine: "2.0" },
  "036": { diameter: "M36", coarse: "4.0", fine: "3.0" },
};

function normalizeMetricPitch(value = "") {
  const raw = String(value || "").replace(/[^0-9.]/g, "");
  if (!raw) return "";
  if (raw.includes(".")) return String(Number(raw));
  if (raw.length <= 2) return String(Number(raw) / 10).replace(/\.0$/, "");
  return String(Number(raw) / 100).replace(/\.0$/, "");
}

function metricDiameterFromCode(code = "") {
  const normalizedCode = String(code || "").padStart(3, "0");
  const entry = METRIC_THREADED_ROD_DIAMETERS[normalizedCode];
  if (entry) return entry;
  const num = Number(code);
  if (!Number.isFinite(num) || num <= 0) return null;
  const diameter = num >= 100 ? `M${num / 10}` : `M${num}`;
  return { diameter, coarse: "", fine: "" };
}

function getPartNumber(product = {}) {
  return clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
}

function getDescription(product = {}) {
  return clean(product?.fishbowl?.description || product?.description || "");
}


function parseFraction(value = "") {
  const raw = clean(value).replace(/\s+/g, "");
  if (!raw) return NaN;
  const mixed = raw.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = raw.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function findImperialDiameterInfo(diameter = "") {
  const normalized = clean(diameter).replace(/\s+/g, "");
  return Object.values(THREADED_ROD_DIAMETERS).find((item) => item.diameter === normalized) || null;
}

function inferImperialThreadFromDescription({ part = "", description = "", diameter = "" } = {}) {
  const text = `${part} ${description}`.toUpperCase();
  const diaInfo = findImperialDiameterInfo(diameter);
  if (/\b8\s*UN\b|\b8UN\b/.test(text)) return { threadPitch: "8", threadSeries: "8un", threadType: "8un" };
  if (/\bSAE\b/.test(text) || /^ATB7F/i.test(String(part || "").replace(/\s+/g, "")) || /^ATF/i.test(String(part || "").replace(/\s+/g, ""))) {
    return { threadPitch: diaInfo?.fine || "", threadSeries: "fine", threadType: "fine" };
  }
  return { threadPitch: diaInfo?.coarse || "", threadSeries: "coarse", threadType: "coarse" };
}

function normalizeLengthUnit(unit = "", fallback = "ft") {
  const raw = String(unit || "").toLowerCase();
  if (/"|inch|in\b/.test(raw)) return "in";
  if (/'|ft|feet|foot/.test(raw)) return "ft";
  if (/mm/.test(raw)) return "mm";
  if (/meter|metre|\bm\b/.test(raw)) return "m";
  return fallback;
}

function getLengthLabel(length = "", lengthUnit = "ft") {
  if (lengthUnit === "mm") return `${length}mm`;
  if (lengthUnit === "m") return `${length}m`;
  if (lengthUnit === "in") return `${length}\"`;
  return `${length}'`;
}

function parseFinishSuffixInfo({ raw = "", description = "", finishCode = "" } = {}) {
  const normalizedRaw = String(raw || "").toUpperCase().replace(/\s+/g, "");
  const normalizedFinishCode = String(finishCode || "").toUpperCase();
  const text = `${normalizedRaw} ${description}`.toUpperCase();

  const hasLeftHand = /(?:LH|LEFT\s*HAND|LEFT\s*HAND(?:ED)?\s*THREAD)/.test(text) || normalizedFinishCode.includes("LH");
  const isDomestic = normalizedFinishCode.includes("GD") || /\bDOM\b|\bDOMESTIC\b/.test(text);
  const isPx = normalizedFinishCode.includes("PX") || /\bPX\b/.test(text);
  const isPlain =
    !isPx &&
    (normalizedFinishCode === "P" ||
      /(?:^|[^A-Z])P(?:$|[^A-Z])/.test(normalizedFinishCode) ||
      /\bPLAIN\b/.test(text));
  const isGalvanized =
    normalizedFinishCode.includes("HDG") ||
    normalizedFinishCode.includes("GD") ||
    /(?:^|[^A-Z])G(?:$|[^A-Z])/.test(normalizedFinishCode) ||
    /\bGALV\b|\bGALVANIZED\b|\bHDG\b|\bHOT\s*DIP\b/.test(text);

  return { hasLeftHand, isDomestic, isPlain, isGalvanized, isPx };
}

function inferGradeFromText({ raw = "", description = "", familyCode = "" } = {}) {
  const text = `${raw} ${description} ${familyCode}`.toUpperCase();
  if (/\bB-?7\b|\bGRADE\s*B7\b/.test(text)) return "B7";
  if (/\bA354\b/.test(text)) return "A354";
  if (/\bF1554\s*-?\s*36\b|\bGR(?:ADE)?\s*36\b|\bG36\b|\b36\b/.test(text)) return "36";
  if (/\bGR(?:ADE)?\s*55\b|\bG55\b|\b55\b/.test(text)) return "55";
  if (/\bGR(?:ADE)?\s*105\b|\bG105\b|\b105\b/.test(text)) return "105";
  if (/\bA307\b/.test(text)) return "A307";
  return "";
}

function inferMaterialFinishAndGrade({ raw = "", description = "", familyCode = "", finishCode = "" } = {}) {
  const normalizedRaw = String(raw || "").toUpperCase().replace(/\s+/g, "");
  const normalizedFinishCode = String(finishCode || "").toUpperCase();
  const text = `${normalizedRaw} ${description}`.toUpperCase();
  const suffixInfo = parseFinishSuffixInfo({ raw, description, finishCode });
  const explicitGrade = inferGradeFromText({ raw, description, familyCode });

  if (/^BRS/.test(normalizedRaw) || /\bBRASS\b|\bBRS\b/.test(text)) {
    return {
      material: "brass",
      finish: "",
      materialFinish: "brass",
      grade: "brass",
    };
  }

  if (/^ALU/.test(normalizedRaw) || /\bALU\b|\bALUMINUM\b|\bALUMINIUM\b/.test(text)) {
    return {
      material: "aluminum",
      finish: "",
      materialFinish: "aluminum",
      grade: "aluminum",
    };
  }

  if (normalizedFinishCode.includes("SS") || /^SS/.test(normalizedRaw) || /\bS\/?S\b|\bSTAINLESS\b|\bSS\b/.test(text)) {
    const grade = /\b316\b/.test(text) ? "316" : "304";
    return {
      material: "stainless steel",
      finish: "",
      materialFinish: "stainless steel",
      grade,
    };
  }

  if (/B7/.test(familyCode) || explicitGrade === "B7") {
    return {
      material: "alloy steel",
      finish: suffixInfo.isGalvanized ? "galvanized" : suffixInfo.isPlain ? "plain" : "zinc",
      materialFinish: suffixInfo.isGalvanized
        ? "alloy steel / galvanized"
        : suffixInfo.isPlain
          ? "alloy steel / plain"
          : "alloy steel / zinc",
      grade: "B7",
    };
  }

  const grade = explicitGrade || "A307";

  if (suffixInfo.isGalvanized) {
    return {
      material: "steel",
      finish: "galvanized",
      materialFinish: "steel / galvanized",
      grade,
    };
  }

  if (suffixInfo.isPlain) {
    return {
      material: "steel",
      finish: "plain",
      materialFinish: "steel / plain",
      grade,
    };
  }

  if (/\bZINC\b|\bZP\b/.test(text) || suffixInfo.isPx) {
    return {
      material: "steel",
      finish: "zinc",
      materialFinish: "steel / zinc",
      grade,
    };
  }

  return {
    material: "steel",
    finish: "zinc",
    materialFinish: "steel / zinc",
    grade,
  };
}

function parseThreadedRodFromPart(product = {}) {
  const part = getPartNumber(product);
  const description = getDescription(product);
  const raw = part.toUpperCase().replace(/\s+/g, "");
  const has316Suffix = raw.endsWith("316");
  const rawForMatch = has316Suffix ? raw.replace(/316$/, "") : raw;

  const match = rawForMatch.match(/^(ALU|BRS)?(SS)?(ATB7[CF]|AT[CF]|AT)(\d{3})(\d{2,3})([A-Z]*)$/i);
  if (!match) return null;

  const materialPrefix = (match[1] || "").toUpperCase();
  const aluminumPrefix = materialPrefix === "ALU";
  const brassPrefix = materialPrefix === "BRS";
  const stainlessPrefix = Boolean(match[2]);
  const familyCode = match[3].toUpperCase() === "AT" ? "ATC" : match[3].toUpperCase();
  const diameterCode = match[4];
  const lengthCode = match[5];
  const finishCode = `${match[6] || ""}${has316Suffix ? "316" : ""}`.toUpperCase();
  const diaInfo = THREADED_ROD_DIAMETERS[diameterCode];
  if (!diaInfo) return null;

  const threadSeries = familyCode.endsWith("F") ? "fine" : "coarse";
  const threadPitch = threadSeries === "fine" ? diaInfo.fine : diaInfo.coarse;
  const lengthFeet = String(Number(lengthCode));
  if (!threadPitch || !lengthFeet || lengthFeet === "NaN") return null;

  const rawFamilyCode = `${aluminumPrefix ? "ALU" : ""}${brassPrefix ? "BRS" : ""}${stainlessPrefix ? "SS" : ""}${familyCode}${finishCode}`;
  const materialInfo = inferMaterialFinishAndGrade({
    raw: rawFamilyCode,
    description,
    familyCode,
    finishCode,
  });
  const size = `${diaInfo.diameter}-${threadPitch}`;
  const suffixInfo = parseFinishSuffixInfo({ raw: rawFamilyCode, description, finishCode });
  const threadType = suffixInfo.hasLeftHand ? "left hand" : threadSeries;
  const title = buildThreadedRodTitle({
    size,
    length: lengthFeet,
    materialInfo,
    threadSeries,
    threadType,
  });

  return {
    productKind: "threaded-rod",
    category: "threaded rod",
    subcategory: "threaded rod",
    familyType: "threaded rod",
    fastenerType: "threaded rod",
    familyCode: rawFamilyCode,
    measurementSystem: "imperial",
    diameter: diaInfo.diameter,
    threadPitch,
    threadSeries,
    threadType,
    threadDirection: suffixInfo.hasLeftHand ? "left hand" : "",
    length: lengthFeet,
    lengthUnit: "ft",
    size,
    ...materialInfo,
    origin: suffixInfo.isDomestic ? "domestic" : "",
    title,
    shortTitle: `${size} x ${lengthFeet}' Threaded Rod`,
  };
}


function parseMetricThreadedRodFromPart(product = {}) {
  const part = getPartNumber(product);
  const description = getDescription(product);
  const raw = part.toUpperCase().replace(/\s+/g, "");
  const has316Suffix = raw.endsWith("316");
  const rawForMetricMatch = has316Suffix ? raw.replace(/316$/, "") : raw;

  if (!/^MMAT[CF]?/.test(rawForMetricMatch)) return null;

  const descText = `${part} ${description}`;

  let diameter = "";
  let threadPitch = "";
  let length = "";
  let lengthUnit = "mm";

  // Full encoded metric threaded rod, when a length/pitch code exists.
  // Example shape: MMATC0061000SS => M6, 1000mm, coarse pitch.
  const fullCodeMatch = rawForMetricMatch.match(/^MMAT([CF])?(\d{2,3})(\d{3,4})([A-Z]*)$/i);
  // Standard stock metric all-thread rods are one meter unless the part number/description says otherwise.
  // Examples: MMAT04SS => M4 x 1m stainless, MMAT05 => M5 x 1m zinc, MMAT06SS => M6 x 1m stainless.
  const oneMeterMatch = rawForMetricMatch.match(/^MMAT([CF])?(\d{2,3})([A-Z]*)$/i);
  const metricMatch = fullCodeMatch || oneMeterMatch;
  const threadSeriesFromCode = (metricMatch?.[1] || "C").toUpperCase() === "F" ? "fine" : "coarse";

  if (fullCodeMatch) {
    const diaInfo = metricDiameterFromCode(fullCodeMatch[2]);
    if (!diaInfo) return null;
    diameter = diaInfo.diameter;
    length = String(Number(fullCodeMatch[3]));
    lengthUnit = Number(fullCodeMatch[3]) >= 100 ? "mm" : "m";
  }

  if ((!diameter || !length) && oneMeterMatch) {
    const diaInfo = metricDiameterFromCode(oneMeterMatch[2]);
    if (!diaInfo) return null;
    diameter = diaInfo.diameter;
    length = "1";
    lengthUnit = "m";
  }

  // Description fallback for malformed/incomplete MMAT records. Only trust descriptions that include
  // an actual metric diameter + length pattern, so MMAT04SS cannot be misread as M70.
  if (!diameter || !length) {
    const descMatch = descText.match(/\bM?\s*(\d+(?:\.\d+)?)\s*(?:[-xX×]\s*)(\d+(?:\.\d+)?)\s*(?:MM|METER|METRE|M\b)?(?:\s*[-xX×]\s*(\d+(?:\.\d+)?))?/i);
    if (descMatch && /(?:MM|METER|METRE|\bM\b)/i.test(descText)) {
      diameter = `M${Number(descMatch[1])}`.replace(/\.0\b/, "");
      length = String(Number(descMatch[2])).replace(/\.0$/, "");
      lengthUnit = /\bMETER|\bMETRE|\b1\s*M\b/i.test(descText) ? "m" : "mm";
      if (descMatch[3]) threadPitch = String(Number(descMatch[3])).replace(/\.0$/, "");
    }
  }

  const diaCode = metricMatch?.[2] || "";
  const diaInfo = metricDiameterFromCode(diaCode) || Object.values(METRIC_THREADED_ROD_DIAMETERS).find((item) => item.diameter === diameter);
  const threadSeries = threadSeriesFromCode;
  if (!threadPitch) threadPitch = threadSeries === "fine" ? diaInfo?.fine || "" : diaInfo?.coarse || "";
  if (!diameter || !threadPitch || !length || length === "NaN") return null;

  const metricSuffixCode = `${fullCodeMatch?.[4] || oneMeterMatch?.[3] || ""}${has316Suffix ? "316" : ""}`.toUpperCase();
  const rawFamilyCode = `${raw.match(/^MMATF/i) ? "MMATF" : "MMATC"}${metricSuffixCode}`;
  const materialInfo = inferMaterialFinishAndGrade({ raw, description, familyCode: rawFamilyCode, finishCode: metricSuffixCode });
  if (materialInfo.material === "steel") {
    materialInfo.grade = /\bA307\b/i.test(description) ? "A307" : "8.8";
  }

  const size = `${diameter}-${threadPitch}`;
  const metricSuffixInfo = parseFinishSuffixInfo({ raw, description, finishCode: metricSuffixCode });
  const metricThreadType = metricSuffixInfo.hasLeftHand ? "left hand" : threadSeries;
  const title = buildThreadedRodTitle({
    size,
    length,
    materialInfo,
    threadSeries,
    threadType: metricThreadType,
    lengthUnit,
  });

  return {
    productKind: "threaded-rod",
    category: "threaded rod",
    subcategory: "threaded rod",
    familyType: "threaded rod",
    fastenerType: "threaded rod",
    familyCode: rawFamilyCode,
    measurementSystem: "metric",
    diameter,
    threadPitch,
    threadSeries,
    threadType: metricThreadType,
    threadDirection: metricSuffixInfo.hasLeftHand ? "left hand" : "",
    length,
    lengthUnit,
    size,
    ...materialInfo,
    origin: metricSuffixInfo.isDomestic ? "domestic" : "",
    title,
    shortTitle: `${size} x ${length}${lengthUnit === "m" ? "m" : "mm"} Threaded Rod`,
  };
}

function parseMetricThreadedRodFromDescription(product = {}) {
  const part = getPartNumber(product);
  const description = getDescription(product);
  const text = `${part} ${description}`;

  if (!/all\s*thread|threaded\s*rod|thread\s*rod/i.test(text)) return null;

  // Examples: 12M-1.50 1M ALL THREAD, 3M-.50X1 METER ALL THREAD, 12M-1.25X300MM ALL THREAD
  const metricMatch = text.match(/\b(\d+(?:\.\d+)?)\s*M\s*-\s*(\d*(?:\.\d+)?)\s*(?:x|X|×|\s+)\s*(\d+(?:\.\d+)?)\s*(MM|METER|METRE|M)\b/i);
  if (!metricMatch) return null;

  const diameter = `M${Number(metricMatch[1])}`.replace(/\.0\b/, "");
  const threadPitch = String(Number(metricMatch[2])).replace(/\.0$/, "");
  const length = String(Number(metricMatch[3])).replace(/\.0$/, "");
  const lengthUnit = /^MM$/i.test(metricMatch[4]) ? "mm" : "m";
  const size = `${diameter}-${threadPitch}`;
  const diaInfo = Object.values(METRIC_THREADED_ROD_DIAMETERS).find((item) => item.diameter === diameter);
  const threadSeries = diaInfo && threadPitch === diaInfo.fine && threadPitch !== diaInfo.coarse ? "fine" : "coarse";
  const raw = part.toUpperCase().replace(/\s+/g, "");
  const familyCode = threadSeries === "fine" ? "MMATF" : "MMATC";
  const materialInfo = inferMaterialFinishAndGrade({ raw, description, familyCode });
  if (materialInfo.material === "steel" && materialInfo.grade === "A307") materialInfo.grade = "8.8";
  const suffixInfo = parseFinishSuffixInfo({ raw, description });
  const threadType = suffixInfo.hasLeftHand ? "left hand" : threadSeries;
  const title = buildThreadedRodTitle({ size, length, materialInfo, threadSeries, threadType, lengthUnit });

  return {
    productKind: "threaded-rod",
    category: "threaded rod",
    subcategory: "threaded rod",
    familyType: "threaded rod",
    fastenerType: "threaded rod",
    familyCode,
    measurementSystem: "metric",
    diameter,
    threadPitch,
    threadSeries,
    threadType,
    threadDirection: suffixInfo.hasLeftHand ? "left hand" : "",
    length,
    lengthUnit,
    size,
    ...materialInfo,
    origin: suffixInfo.isDomestic ? "domestic" : "",
    title,
    shortTitle: `${size} x ${getLengthLabel(length, lengthUnit)} Threaded Rod`,
  };
}

function parseThreadedRodFromDescription(product = {}) {
  const part = getPartNumber(product);
  const description = getDescription(product);
  const text = `${part} ${description}`;

  if (!/threaded\s*rod|all\s*thread|thread\s*rod/i.test(text)) return null;

  const raw = part.toUpperCase().replace(/\s+/g, "");
  const familyHint = raw.includes("B7") ? (raw.includes("ATB7F") ? "ATB7F" : "ATB7C") : raw.includes("ATF") ? "ATF" : "ATC";

  // Explicit diameter-thread x length: 3/8-16 x 6', 1-3/8-8 x 12'
  let match = text.match(/\b(\d+(?:-\d+\/\d+)?|\d+\/\d+|#\d+)\s*-\s*(\d{1,2})\s*(?:x|X|×)\s*(\d+(?:-\d+\/\d+)?|\d+\/\d+)\s*("|'|in\b|inch(?:es)?\b|ft\b|feet\b)?/i);
  let diameter = "";
  let threadPitch = "";
  let length = "";
  let lengthUnit = "ft";
  let threadSeries = "";
  let threadType = "";

  if (match) {
    diameter = clean(match[1]);
    threadPitch = clean(match[2]);
    length = clean(match[3]);
    lengthUnit = normalizeLengthUnit(match[4], "ft");
    const diaInfo = findImperialDiameterInfo(diameter);
    threadSeries = diaInfo && threadPitch === diaInfo.fine && threadPitch !== diaInfo.coarse ? "fine" : "coarse";
    threadType = threadSeries;
  }

  // USS/SAE/B7 description style without an explicit thread pitch: ALL THREAD USS 3/4X12' G36 PLAIN
  if (!diameter || !length || !threadPitch) {
    const noPitchMatch = text.match(/\b(\d+(?:-\d+\/\d+)?|\d+\/\d+)\s*(?:"|in\b)?\s*(?:x|X|×)\s*(\d+(?:-\d+\/\d+)?|\d+\/\d+)\s*("|'|in\b|inch(?:es)?\b|ft\b|feet\b)?/i);
    if (noPitchMatch) {
      diameter = clean(noPitchMatch[1]);
      length = clean(noPitchMatch[2]);
      lengthUnit = normalizeLengthUnit(noPitchMatch[3], /\b\d+(?:-\d+\/\d+)?\s*"\s*x\s*\d/i.test(text) ? "in" : "ft");
      const inferred = inferImperialThreadFromDescription({ part, description, diameter });
      threadPitch = inferred.threadPitch;
      threadSeries = inferred.threadSeries;
      threadType = inferred.threadType;
    }
  }

  if (!diameter || !threadPitch || !length) return null;

  const size = `${diameter}-${threadPitch}`;
  const familyCode = familyHint;
  const materialInfo = inferMaterialFinishAndGrade({ raw, description, familyCode });
  const suffixInfo = parseFinishSuffixInfo({ raw, description });
  const origin = suffixInfo.isDomestic ? "domestic" : "";
  if (suffixInfo.hasLeftHand) threadType = "left hand";
  if (!threadType) threadType = threadSeries || "coarse";
  if (!threadSeries) threadSeries = threadType === "8un" ? "8un" : "coarse";
  const title = buildThreadedRodTitle({ size, length, materialInfo, threadSeries, threadType, lengthUnit });

  return {
    productKind: "threaded-rod",
    category: "threaded rod",
    subcategory: "threaded rod",
    familyType: "threaded rod",
    fastenerType: "threaded rod",
    familyCode,
    measurementSystem: "imperial",
    diameter,
    threadPitch,
    threadSeries,
    threadType,
    threadDirection: suffixInfo.hasLeftHand ? "left hand" : "",
    length,
    lengthUnit,
    size,
    ...materialInfo,
    origin,
    title,
    shortTitle: `${size} x ${getLengthLabel(length, lengthUnit)} Threaded Rod`,
  };
}

function buildThreadedRodTitle({ size = "", length = "", materialInfo = {}, threadSeries = "", threadType = "", lengthUnit = "ft" } = {}) {
  const suffixes = [];
  if (materialInfo.material === "stainless steel") suffixes.push(`Stainless Steel ${materialInfo.grade || "304"}`);
  else if (materialInfo.material === "aluminum") suffixes.push("Aluminum");
  else if (materialInfo.material === "brass") suffixes.push("Brass");
  else if (materialInfo.grade) suffixes.push(`Grade ${materialInfo.grade}`.replace(/Grade grade/i, "Grade"));
  if (materialInfo.finish && !["plain"].includes(materialInfo.finish)) suffixes.push(toTitle(materialInfo.finish));
  if (threadSeries === "fine") suffixes.push("Fine Thread");
  if (threadType === "8un") suffixes.push("8UN Thread");
  if (threadType === "left hand") suffixes.push("Left Hand Thread");

  const lengthLabel = getLengthLabel(length, lengthUnit);
  return [`${size} x ${lengthLabel} Threaded Rod`, ...suffixes].filter(Boolean).join(" - ");
}

function detectThreadedRodProduct(product = {}) {
  return parseMetricThreadedRodFromPart(product) || parseThreadedRodFromPart(product) || parseMetricThreadedRodFromDescription(product) || parseThreadedRodFromDescription(product);
}

function buildSeoSlug(parsed = {}, product = {}) {
  const partNumber = getPartNumber(product);
  return slugify([parsed.shortTitle, parsed.materialFinish, parsed.grade, partNumber].filter(Boolean).join(" "));
}

function buildDescription(parsed = {}, product = {}) {
  const partNumber = getPartNumber(product);
  const bits = [
    `${parsed.size} x ${getLengthLabel(parsed.length, parsed.lengthUnit)} threaded rod`,
    parsed.threadType === "left hand" ? "left hand thread" : parsed.threadSeries === "fine" ? "fine thread" : "coarse thread",
    parsed.grade ? `grade ${parsed.grade}`.replace(/grade grade/i, "grade") : "",
    parsed.materialFinish,
    partNumber ? `Fishbowl part ${partNumber}` : "",
  ].filter(Boolean);
  return `${toTitle(bits[0])}. ${bits.slice(1).join(". ")}.`;
}

function buildBulletPoints(parsed = {}) {
  return uniqueStrings([
    `${parsed.size} thread size`,
    `${getLengthLabel(parsed.length, parsed.lengthUnit)} length`,
    parsed.threadType === "left hand" ? "Left Hand Thread" : parsed.threadSeries ? `${toTitle(parsed.threadSeries)} thread` : "",
    parsed.materialFinish ? toTitle(parsed.materialFinish) : "",
    parsed.grade ? `Grade ${parsed.grade}`.replace(/Grade grade/i, "Grade") : "",
  ]);
}

function buildTags(parsed = {}, product = {}) {
  return uniqueStrings([
    "threaded-rod",
    "all-thread",
    slugify(parsed.threadSeries),
    slugify(parsed.material),
    slugify(parsed.finish),
    slugify(parsed.grade),
    ...(Array.isArray(product?.searchKeywords) ? product.searchKeywords.map(slugify) : []),
  ]);
}

export {
  METRIC_THREADED_ROD_DIAMETERS,
  THREADED_ROD_DIAMETERS,
  buildBulletPoints,
  buildDescription,
  buildSeoSlug,
  buildTags,
  clean,
  detectThreadedRodProduct,
  normalize,
  slugify,
  toTitle,
  uniqueStrings,
};

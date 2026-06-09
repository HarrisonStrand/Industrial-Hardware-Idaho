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

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((item) => clean(item)))];
}

const IMPERIAL_DIAMETERS = {
  "02": { diameter: "#2", coarse: "56", fine: "64" },
  "03": { diameter: "#3", coarse: "48", fine: "56" },
  "04": { diameter: "1/4", coarse: "20", fine: "28" },
  "05": { diameter: "5/16", coarse: "18", fine: "24" },
  "06": { diameter: "3/8", coarse: "16", fine: "24" },
  "07": { diameter: "7/16", coarse: "14", fine: "20" },
  "08": { diameter: "1/2", coarse: "13", fine: "20" },
  "09": { diameter: "9/16", coarse: "12", fine: "18" },
  "10": { diameter: "5/8", coarse: "11", fine: "18" },
  "12": { diameter: "3/4", coarse: "10", fine: "16" },
  "14": { diameter: "7/8", coarse: "9", fine: "14" },
  "16": { diameter: "1", coarse: "8", fine: "12" },
  "18": { diameter: "1-1/8", coarse: "7", fine: "12" },
  "20": { diameter: "1-1/4", coarse: "7", fine: "12" },
  "22": { diameter: "1-3/8", coarse: "6", fine: "12" },
  "24": { diameter: "1-1/2", coarse: "6", fine: "12" },
  "26": { diameter: "2", coarse: "4.5", fine: "6" },
};

const METRIC_DIAMETERS = {
  "04": { diameter: "M4", coarse: "0.7", fine: "0.5" },
  "05": { diameter: "M5", coarse: "0.8", fine: "0.5" },
  "06": { diameter: "M6", coarse: "1.0", fine: "0.75" },
  "08": { diameter: "M8", coarse: "1.25", fine: "1.0" },
  "10": { diameter: "M10", coarse: "1.5", fine: "1.25" },
  "12": { diameter: "M12", coarse: "1.75", fine: "1.5" },
  "14": { diameter: "M14", coarse: "2.0", fine: "1.5" },
  "16": { diameter: "M16", coarse: "2.0", fine: "1.5" },
  "18": { diameter: "M18", coarse: "2.5", fine: "1.5" },
  "20": { diameter: "M20", coarse: "2.5", fine: "1.5" },
  "22": { diameter: "M22", coarse: "2.5", fine: "1.5" },
  "24": { diameter: "M24", coarse: "3.0", fine: "2.0" },
};

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

function mixedFractionFromSixteenths(totalSixteenths = 0) {
  const whole = Math.floor(totalSixteenths / 16);
  const remainder = totalSixteenths % 16;
  if (!remainder) return String(whole);
  const divisor = gcd(remainder, 16);
  const num = remainder / divisor;
  const den = 16 / divisor;
  return whole > 0 ? `${whole}-${num}/${den}` : `${num}/${den}`;
}

function parseImperialLengthCode(code = "") {
  const digits = String(code || "").replace(/\D/g, "");
  if (!digits) return "";

  // Flange-bolt codes are normally whole-inches plus sixteenths:
  // 100 = 1", 104 = 1-1/4", 200 = 2". Accept 0100/0200 too.
  const compact = digits.length === 4 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (/^\d{3}$/.test(compact)) {
    const whole = Number(compact.slice(0, 1));
    const sixteenths = Number(compact.slice(1, 3));
    if (Number.isFinite(whole) && Number.isFinite(sixteenths)) {
      return mixedFractionFromSixteenths(whole * 16 + sixteenths);
    }
  }

  if (/^\d{4}$/.test(digits)) {
    const whole = Number(digits.slice(0, 2));
    const sixteenths = Number(digits.slice(2, 4));
    if (Number.isFinite(whole) && Number.isFinite(sixteenths)) {
      return mixedFractionFromSixteenths(whole * 16 + sixteenths);
    }
  }

  return "";
}

function normalizeMetricPitch(value = "") {
  const raw = String(value || "").replace(/[^0-9.]/g, "");
  if (!raw) return "";
  if (raw.includes(".")) return Number(raw).toFixed(2).replace(/0$/, "").replace(/\.0$/, ".0");
  if (raw.length <= 2) return (Number(raw) / 10).toFixed(2).replace(/0$/, "").replace(/\.0$/, ".0");
  return (Number(raw) / 100).toFixed(2).replace(/0$/, "").replace(/\.0$/, ".0");
}

function getPartNumber(product = {}) {
  return clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "").toUpperCase().replace(/\s+/g, "");
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
  const num = Number(raw);
  return Number.isFinite(num) ? num : NaN;
}

function imperialDiameterFromDecimal(value = "") {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  const candidates = Object.values(IMPERIAL_DIAMETERS);
  let best = null;
  for (const item of candidates) {
    const parsed = parseFraction(item.diameter);
    if (!Number.isFinite(parsed)) continue;
    const diff = Math.abs(parsed - num);
    if (!best || diff < best.diff) best = { ...item, diff };
  }
  return best && best.diff <= 0.01 ? best.diameter : "";
}

function parseImperialFromDescription(text = "") {
  const raw = clean(text).replace(/[×]/g, "x");
  const sizeMatch = raw.match(/(?:^|\b)(\d+(?:-\d+\/\d+)?|\d+\/\d+|\.\d+|\d+\.\d+)\s*(?:-|x|X|\s+X\s+|\s*x\s*)\s*(\d+(?:-\d+\/\d+)?|\d+\/\d+|\.\d+|\d+\.\d+)\b/);
  if (!sizeMatch) return {};
  let diameter = sizeMatch[1].replace(/^\./, "0.");
  const length = sizeMatch[2].replace(/^\./, "0.");
  if (/^0?\.\d+$/.test(diameter)) diameter = imperialDiameterFromDecimal(diameter) || diameter;

  return { diameter, length };
}

function parseMetricFromDescription(text = "") {
  const raw = clean(text).replace(/[×]/g, "x");
  const metricMatch = raw.match(/\bM\s*(\d+)\s*(?:[-xX]\s*([0-9]+(?:\.[0-9]+)?))?\s*(?:x|X)\s*(\d+)\s*MM?\b/i)
    || raw.match(/\bM\s*(\d+)\s*(?:[-xX]\s*([0-9]+(?:\.[0-9]+)?))?\s*(?:x|X)\s*(\d+)\b/i)
    || raw.match(/\bM\s*(\d+)\s*[-]\s*([0-9]+(?:\.[0-9]+)?)\s+(\d+)\s*MM?\b/i);
  if (!metricMatch) return {};
  const diaCode = String(metricMatch[1]).padStart(2, "0");
  const info = METRIC_DIAMETERS[diaCode] || { diameter: `M${Number(metricMatch[1])}`, coarse: "", fine: "" };
  const threadPitch = metricMatch[2] ? normalizeMetricPitch(metricMatch[2]) : info.coarse;
  return {
    diameter: info.diameter,
    threadPitch,
    threadSeries: threadPitch && info.fine && threadPitch === info.fine ? "fine" : "coarse",
    length: String(Number(metricMatch[3])),
  };
}

function detectGradeAndFinish({ part = "", description = "", measurementSystem = "imperial" } = {}) {
  const rawPart = String(part || "").toUpperCase();
  const text = `${rawPart} ${description}`.toUpperCase();
  const stainless = /^SSFB/.test(rawPart) || /\b(?:SS|S\/S|STAINLESS|304|316)\b/.test(text);
  const grade316 = stainless && /\b316\b/.test(text);
  const grade304 = stainless && !grade316;
  const grade8 = /^FB8/.test(rawPart) || /\b(?:GRADE\s*8|GR\.?\s*8|GR8)\b/.test(text);
  const grade5 = /^FB5/.test(rawPart) || /\b(?:GRADE\s*5|GR\.?\s*5|GR5)\b/.test(text);
  const metric109 = /\b10\s*[.]\s*9\b/.test(text) || (/^MMFB/.test(rawPart) && /109$/.test(rawPart.replace(/\D/g, "")));
  const metric88 = /\b8\s*[.]\s*8\b/.test(text) || measurementSystem === "metric";

  if (stainless) {
    return {
      material: "stainless steel",
      finish: "",
      displayMaterial: "stainless steel",
      displayFinish: "stainless steel",
      materialFinish: "stainless steel",
      grade: grade316 ? "316" : grade304 ? "304" : "304",
    };
  }

  if (/\b(?:ZINC|ZP|Z\.P\.)\b/.test(text)) {
    return {
      material: "steel",
      finish: "zinc",
      displayMaterial: "steel",
      displayFinish: "zinc",
      materialFinish: "zinc steel",
      grade: metric109 ? "10.9" : metric88 && measurementSystem === "metric" ? "8.8" : grade8 ? "grade 8" : grade5 ? "grade 5" : "grade 5",
    };
  }

  if (/\b(?:GALV|GALVANIZED|HDG|HOT\s*DIP)\b/.test(text)) {
    return {
      material: "steel",
      finish: "galvanized",
      displayMaterial: "steel",
      displayFinish: "galvanized",
      materialFinish: "galvanized steel",
      grade: metric109 ? "10.9" : metric88 ? "8.8" : grade8 ? "grade 8" : grade5 ? "grade 5" : "grade 5",
    };
  }

  if (/\b(?:PLAIN|BLK|BLACK)\b/.test(text) || (grade8 && measurementSystem === "imperial")) {
    return {
      material: "steel",
      finish: "black",
      displayMaterial: "steel",
      displayFinish: "black",
      materialFinish: "black steel",
      grade: metric109 ? "10.9" : metric88 && measurementSystem === "metric" ? "8.8" : grade8 ? "grade 8" : grade5 ? "grade 5" : "grade 8",
    };
  }

  return {
    material: "steel",
    finish: "zinc",
    displayMaterial: "steel",
    displayFinish: "zinc",
    materialFinish: "zinc steel",
    grade: metric109 ? "10.9" : metric88 && measurementSystem === "metric" ? "8.8" : grade8 ? "grade 8" : grade5 ? "grade 5" : "grade 5",
  };
}

function detectThreadCode({ raw = "", description = "" } = {}) {
  const part = String(raw || "").toUpperCase();
  const text = `${part} ${description}`.toUpperCase();
  const hasFine = /^(?:FBF|FB5F)/.test(part) || /F$/.test(part) || /\bFINE\b|\bSAE\b/.test(text);
  const hasCoarse = /^(?:FBC|FB5C)/.test(part) || /C$/.test(part) || /\bCOARSE\b|\bUSS\b/.test(text);
  if (hasFine) return "fine";
  if (hasCoarse) return "coarse";
  return "coarse";
}

function decodeImperialPart(part = "", description = "") {
  let raw = String(part || "").toUpperCase().replace(/\s+/g, "");
  if (!raw.includes("FB")) return null;
  const isStainless = raw.startsWith("SSFB");
  // Keep C/F thread suffixes, but ignore common finish-only suffixes so
  // codes like FB8060200Z can still parse from the part number.
  const codeRaw = raw.replace(/(?:ZINC|ZN|ZP|HDG|GALV|BLK|BLACK|Z|G)$/i, "");

  let diameterCode = "";
  let lengthCode = "";
  let gradeFromPart = "";
  let explicitThread = "";

  if (/^FB[58]/.test(codeRaw)) {
    const m = codeRaw.match(/^FB([58])([CF])?(\d{2})(\d{3,4})([CF])?$/);
    if (m) {
      gradeFromPart = m[1] === "8" ? "grade 8" : "grade 5";
      explicitThread = m[2] || m[5] || "";
      diameterCode = m[3];
      lengthCode = m[4];
    }
  } else if (/^FB[CF]/.test(codeRaw)) {
    const m = codeRaw.match(/^FB([CF])(\d{2})(\d{3,4})$/);
    if (m) {
      explicitThread = m[1];
      diameterCode = m[2];
      lengthCode = m[3];
    }
  } else if (/^SSFB/.test(codeRaw)) {
    const m = codeRaw.match(/^SSFB(\d{2})(\d{3,4})([CF])?$/);
    if (m) {
      diameterCode = m[1];
      lengthCode = m[2];
      explicitThread = m[3] || "";
    }
  } else {
    const m = codeRaw.match(/^FB(\d{2})(\d{3,4})([CF])?$/);
    if (m) {
      diameterCode = m[1];
      lengthCode = m[2];
      explicitThread = m[3] || "";
    }
  }

  if (!diameterCode || !lengthCode) {
    const desc = parseImperialFromDescription(description);
    if (!desc.diameter || !desc.length) return null;
    const threadSeries = detectThreadCode({ raw, description });
    const diameterInfo = Object.values(IMPERIAL_DIAMETERS).find((item) => item.diameter === desc.diameter) || {};
    return {
      measurementSystem: "imperial",
      diameter: desc.diameter,
      length: desc.length,
      threadSeries,
      threadPitch: threadSeries === "fine" ? diameterInfo.fine || "" : diameterInfo.coarse || "",
      isStainless,
      gradeFromPart,
    };
  }

  const diameterInfo = IMPERIAL_DIAMETERS[diameterCode];
  const length = parseImperialLengthCode(lengthCode);
  if (!diameterInfo || !length) return null;
  const threadSeries = explicitThread === "F" ? "fine" : explicitThread === "C" ? "coarse" : detectThreadCode({ raw, description });
  return {
    measurementSystem: "imperial",
    diameter: diameterInfo.diameter,
    length,
    threadSeries,
    threadPitch: threadSeries === "fine" ? diameterInfo.fine : diameterInfo.coarse,
    isStainless,
    gradeFromPart,
  };
}

function decodeMetricPart(part = "", description = "") {
  const raw = String(part || "").toUpperCase().replace(/\s+/g, "");
  if (!raw.startsWith("MMFB")) return null;

  // Known metric flange-bolt suffixes/prefixes can include non-size data:
  // - F12P = 12 point hex drive style
  // - trailing 10.9 / 109 = metric grade, not size/pitch
  // Strip those before decoding the compact size code.
  const sizeCodeSource = raw
    .replace(/^MMFB/, "")
    .replace(/F12P/g, "")
    .replace(/10\.9$/g, "")
    .replace(/109$/g, "")
    .replace(/8\.8$/g, "")
    .replace(/88$/g, "");

  const digits = sizeCodeSource.replace(/\D/g, "");
  const diaCode = digits.slice(0, 2);
  const diaInfo = METRIC_DIAMETERS[diaCode];
  if (!diaInfo) return null;
  const rest = digits.slice(2);

  let threadPitch = diaInfo.coarse;
  let length = "";

  if (/^\d{3}\d{3}$/.test(rest)) {
    const a = rest.slice(0, 3);
    const b = rest.slice(3, 6);
    const pitchA = normalizeMetricPitch(a);
    const pitchB = normalizeMetricPitch(b);
    const common = [diaInfo.coarse, diaInfo.fine].filter(Boolean);

    // Support both MMFB08125050 and MMFB08050125 style ordering.
    if (common.includes(pitchA)) {
      threadPitch = pitchA;
      length = String(Number(b));
    } else if (common.includes(pitchB)) {
      threadPitch = pitchB;
      length = String(Number(a));
    } else {
      // Newer observed convention: MMFB + diameter + length + pitch + grade,
      // e.g. MMFB1203015010.9 = M12 x 30mm x 1.50, grade 10.9.
      const possibleLength = String(Number(a));
      if (Number(possibleLength) > 0) {
        length = possibleLength;
        threadPitch = pitchB || diaInfo.coarse;
      }
    }
  } else if (/^\d{2,3}$/.test(rest)) {
    length = String(Number(rest));
  }

  if (!length) {
    const fromDesc = parseMetricFromDescription(description);
    length = fromDesc.length || "";
    threadPitch = fromDesc.threadPitch || threadPitch;
  }

  if (!length) return null;
  return {
    measurementSystem: "metric",
    diameter: diaInfo.diameter,
    length,
    threadPitch,
    threadSeries: threadPitch === diaInfo.fine ? "fine" : "coarse",
  };
}

function detectHeadStandard({ part = "", description = "" } = {}) {
  const text = `${part} ${description}`.toUpperCase();
  const din = text.match(/\bDIN\s*([0-9]{3,5})\b/i);
  if (din) return `DIN ${din[1]}`;
  if (/\bAUVECO\b|^AUVECO/i.test(text)) return "Auveco";
  return "standard";
}

function detectDriveType({ part = "", description = "" } = {}) {
  const text = `${part} ${description}`.toUpperCase();
  if (/\bF12P\b|F12P/.test(text) || /\b12\s*POINT\b/.test(text)) return "12 point hex";
  return "hex";
}

function titleCaseKnown(value = "") {
  const raw = clean(value);
  if (!raw) return "";
  return raw
    .replace(/\bzinc steel\b/i, "Zinc")
    .replace(/\bblack steel\b/i, "Black")
    .replace(/\bgalvanized steel\b/i, "Galvanized")
    .replace(/\bstainless steel\b/i, "Stainless Steel")
    .replace(/\bgrade\s*5\b/i, "Grade 5")
    .replace(/\bgrade\s*8\b/i, "Grade 8")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildFamilyTitle(parsed = {}) {
  const style = parsed.headStandard && parsed.headStandard !== "standard" ? parsed.headStandard : (parsed.measurementSystem === "metric" ? "Metric" : "Standard");
  const grade = titleCaseKnown(parsed.grade || "");
  const material = titleCaseKnown(parsed.materialFinish || "");
  return clean([style, grade, material, "Flange Bolt"].filter(Boolean).join(" "));
}

function buildTitle(parsed = {}) {
  const dia = parsed.diameter || "";
  const pitch = parsed.threadPitch ? `-${parsed.threadPitch}` : "";
  const length = parsed.measurementSystem === "metric" ? `${parsed.length}mm` : `${parsed.length}\"`;
  const size = parsed.measurementSystem === "metric" ? `${dia}${pitch} x ${length}` : `${dia}-${parsed.threadPitch || ""} x ${length}`;
  return clean(`${size} ${buildFamilyTitle(parsed)}`);
}

function buildShortTitle(parsed = {}) {
  const length = parsed.measurementSystem === "metric" ? `${parsed.length}mm` : `${parsed.length}\"`;
  return clean(`${parsed.diameter} x ${length} Flange Bolt`);
}

function buildFamilyKey(parsed = {}) {
  return slugify([
    parsed.measurementSystem,
    parsed.headStandard === "standard" ? "" : parsed.headStandard,
    parsed.grade,
    parsed.materialFinish,
    "flange-bolt",
  ].filter(Boolean).join(" "));
}

function buildDescription(parsed = {}) {
  const thread = parsed.threadSeries && parsed.threadPitch ? `${parsed.threadSeries} thread (${parsed.threadPitch})` : parsed.threadPitch ? `${parsed.threadPitch} thread` : "threaded";
  const length = parsed.measurementSystem === "metric" ? `${parsed.length}mm` : `${parsed.length}\"`;
  return clean(`${parsed.diameter} x ${length} ${parsed.familyTitleBase || "flange bolt"} with ${thread}.`);
}

function buildBulletPoints(parsed = {}) {
  return uniqueStrings([
    `${parsed.diameter} diameter${parsed.length ? ` x ${parsed.measurementSystem === "metric" ? `${parsed.length}mm` : `${parsed.length}\"`}` : ""}`,
    parsed.threadPitch ? `${parsed.threadSeries ? `${parsed.threadSeries} ` : ""}thread pitch: ${parsed.threadPitch}` : "",
    parsed.grade ? `Grade: ${parsed.grade.replace(/^grade /i, "Grade ")}` : "",
    parsed.materialFinish ? `Material / finish: ${parsed.materialFinish}` : "",
    parsed.driveType && parsed.driveType !== "hex" ? `Drive type: ${parsed.driveType}` : "",
    parsed.headStandard && parsed.headStandard !== "standard" ? `Standard/style: ${parsed.headStandard}` : "",
  ]);
}

function buildSeoSlug(parsed = {}, partNumber = "") {
  return slugify([partNumber, parsed.diameter, parsed.length, parsed.grade, parsed.materialFinish, "flange-bolt"].filter(Boolean).join(" "));
}

function buildTags(parsed = {}) {
  return uniqueStrings([
    "bolts",
    "flange bolts",
    "flange bolt",
    parsed.measurementSystem,
    parsed.diameter,
    parsed.length,
    parsed.threadSeries,
    parsed.threadPitch,
    parsed.grade,
    parsed.materialFinish,
    parsed.driveType,
    parsed.headStandard,
  ]);
}

function detectFlangeBoltProduct(product = {}) {
  const part = getPartNumber(product);
  const description = getDescription(product);
  const text = `${part} ${description}`;
  if (!/\bFLANGE\b|^SS?FB|^FB|^MMFB|\bDIN\s*6921\b|\bAUVECO\b/i.test(text)) return null;
  if (/\b(?:NUT|WASHER|ASSORTMENT|KIT|RETAINER|CLIP)\b/i.test(description) && !/\bBOLT\b/i.test(description)) return null;

  const isMetric = /^MMFB/i.test(part) || /\bM\s*\d+/i.test(description) || /\bDIN\s*6921\b/i.test(description);
  const decoded = isMetric
    ? decodeMetricPart(part, description) || parseMetricFromDescription(description)
    : decodeImperialPart(part, description) || parseImperialFromDescription(description);

  if (!decoded?.diameter || !decoded?.length) return null;
  const gradeFinish = detectGradeAndFinish({ part, description, measurementSystem: decoded.measurementSystem || (isMetric ? "metric" : "imperial") });
  if (decoded.gradeFromPart) gradeFinish.grade = decoded.gradeFromPart;

  const parsed = {
    category: "bolts",
    subcategory: "flange bolts",
    productKind: "flange-bolt",
    familyType: "flange bolt",
    fastenerType: "flange bolt",
    measurementSystem: decoded.measurementSystem || (isMetric ? "metric" : "imperial"),
    diameter: decoded.diameter,
    length: decoded.length,
    lengthUnit: (decoded.measurementSystem || (isMetric ? "metric" : "imperial")) === "metric" ? "mm" : "in",
    threadSeries: decoded.threadSeries || "coarse",
    threadPitch: decoded.threadPitch || "",
    thread: decoded.threadPitch ? `${decoded.threadSeries || "coarse"} - ${decoded.threadPitch}` : decoded.threadSeries || "coarse",
    headType: "flange head",
    driveType: detectDriveType({ part, description }),
    drive_type: detectDriveType({ part, description }),
    headStandard: detectHeadStandard({ part, description }),
    ...gradeFinish,
  };

  parsed.familyTitleBase = buildFamilyTitle(parsed);
  parsed.familyTitle = parsed.familyTitleBase;
  parsed.familyKey = buildFamilyKey(parsed);
  parsed.familySlug = slugify(parsed.familyTitleBase);
  parsed.title = buildTitle(parsed);
  parsed.shortTitle = buildShortTitle(parsed);
  parsed.description = buildDescription(parsed);
  parsed.bulletPoints = buildBulletPoints(parsed);
  parsed.tags = buildTags(parsed);
  return parsed;
}

function attributesFromParsed(parsed = {}, product = {}, existingAttributes = {}) {
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
  const description = clean(product?.fishbowl?.description || "");
  return {
    ...existingAttributes,
    measurementSystem: parsed.measurementSystem || "",
    diameter: parsed.diameter || "",
    length: parsed.length || "",
    lengthUnit: parsed.lengthUnit || "",
    thread: parsed.thread || "",
    threadSeries: parsed.threadSeries || "",
    thread_series: parsed.threadSeries || "",
    threadPitch: parsed.threadPitch || "",
    material: parsed.material || "",
    finish: parsed.finish || "",
    displayMaterial: parsed.displayMaterial || parsed.material || "",
    displayFinish: parsed.displayFinish || parsed.finish || parsed.material || "",
    materialFinish: parsed.materialFinish || "",
    grade: parsed.grade || "",
    headType: parsed.headType || "",
    driveType: parsed.driveType || "hex",
    drive_type: parsed.drive_type || parsed.driveType || "hex",
    headStandard: parsed.headStandard || "",
    fastenerType: parsed.familyType || "",
    fastenerTypeCanonical: parsed.familyType || "",
    familyType: parsed.familyType || "",
    familyKey: parsed.familyKey || buildFamilyKey(parsed),
    familySlug: parsed.familySlug || slugify(parsed.familyTitleBase || "flange bolt"),
    familyTitle: parsed.familyTitle || parsed.familyTitleBase || "Flange Bolt",
    familyTitleBase: parsed.familyTitleBase || "Flange Bolt",
    categoryCanonical: parsed.category || "bolts",
    subcategoryCanonical: parsed.subcategory || "flange bolts",
    productKind: parsed.productKind || "flange-bolt",
    fishbowlPartNum: partNumber,
    fishbowlDescription: description,
    sku: product?.sku || existingAttributes.sku || "",
    internalPartNumber: product?.internalPartNumber || existingAttributes.internalPartNumber || "",
  };
}

export {
  attributesFromParsed,
  buildBulletPoints,
  buildDescription,
  buildSeoSlug,
  buildTags,
  clean,
  detectFlangeBoltProduct,
  slugify,
  uniqueStrings,
};

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
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
  "01": { diameter: "#10", coarse: "24", fine: "32" },
  "02": { diameter: "#2", coarse: "56", fine: "64" },
  "03": { diameter: "#3", coarse: "48", fine: "56" },
  "04": { diameter: "1/4", coarse: "20", fine: "28" },
  "05": { diameter: "5/16", coarse: "18", fine: "24" },
  "06": { diameter: "3/8", coarse: "16", fine: "24" },
  "07": { diameter: "7/16", coarse: "14", fine: "20" },
  "08": { diameter: "1/2", coarse: "13", fine: "20" },
  "10": { diameter: "5/8", coarse: "11", fine: "18" },
  "12": { diameter: "3/4", coarse: "10", fine: "16" },
};

const METRIC_DIAMETERS = {
  "04": { diameter: "M4", coarse: "0.7", fine: "0.5" },
  "05": { diameter: "M5", coarse: "0.8", fine: "0.5" },
  "06": { diameter: "M6", coarse: "1.0", fine: "0.75" },
  "08": { diameter: "M8", coarse: "1.25", fine: "1.0" },
  "10": { diameter: "M10", coarse: "1.5", fine: "1.25" },
  "12": { diameter: "M12", coarse: "1.75", fine: "1.5" },
};

const KNOWN_HANGER_BOLT_OVERRIDES = {
  HB0100200: { diameter: "#10", length: "2", threadSeries: "coarse", threadPitch: "24" },
  HB0100208: { diameter: "#10", length: "2-1/2", threadSeries: "coarse", threadPitch: "24" },
  HB0800700: { diameter: "1/2", length: "7", threadSeries: "coarse", threadPitch: "13" },
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
  const compact = digits.length === 4 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (/^\d{3}$/.test(compact)) {
    const whole = Number(compact.slice(0, 1));
    const sixteenths = Number(compact.slice(1, 3));
    return mixedFractionFromSixteenths(whole * 16 + sixteenths);
  }
  if (/^\d{4}$/.test(digits)) {
    const whole = Number(digits.slice(0, 2));
    const sixteenths = Number(digits.slice(2, 4));
    return mixedFractionFromSixteenths(whole * 16 + sixteenths);
  }
  // Hanger bolt #12 part numbers can use a 5-digit length code:
  // HB0100200 = #12-24 x 2, HB0100208 = #12-24 x 2-1/2.
  if (/^\d{5}$/.test(digits)) {
    const whole = Number(digits.slice(0, 3));
    const sixteenths = Number(digits.slice(3, 5));
    return mixedFractionFromSixteenths(whole * 16 + sixteenths);
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
  let best = null;
  for (const item of Object.values(IMPERIAL_DIAMETERS)) {
    const parsed = parseFraction(item.diameter);
    if (!Number.isFinite(parsed)) continue;
    const diff = Math.abs(parsed - num);
    if (!best || diff < best.diff) best = { ...item, diff };
  }
  return best && best.diff <= 0.01 ? best.diameter : "";
}

function detectThreadSeries(part = "", description = "", info = {}) {
  const text = `${part} ${description}`.toUpperCase();
  if (/(?:^|[^A-Z])F(?:$|[^A-Z])/.test(text) || /\bFINE\b|\bUNF\b|\bSAE\b/.test(text) || /F$/.test(part)) return "fine";
  if (/(?:^|[^A-Z])C(?:$|[^A-Z])/.test(text) || /\bCOARSE\b|\bUNC\b|\bUSS\b/.test(text) || /C$/.test(part)) return "coarse";
  return "coarse";
}

function detectMaterialFinish(part = "", description = "") {
  const text = `${part} ${description}`.toUpperCase();
  if (/^SSHB/.test(part) || /\b(?:SS|S\/S|STAINLESS|304|316)\b/.test(text)) {
    const grade = /\b316\b/.test(text) ? "316" : "304";
    return {
      material: "stainless steel",
      finish: "",
      displayMaterial: "stainless steel",
      displayFinish: "stainless steel",
      materialFinish: "stainless steel",
      grade,
    };
  }
  if (/\b(?:GALV|GALVANIZED|HDG|HOT\s*DIP)\b/.test(text)) {
    return { material: "steel", finish: "galvanized", displayMaterial: "steel", displayFinish: "galvanized", materialFinish: "galvanized steel", grade: "low carbon steel" };
  }
  if (/\b(?:PLAIN|BLACK|BLK)\b/.test(text)) {
    return { material: "steel", finish: "plain", displayMaterial: "steel", displayFinish: "plain", materialFinish: "plain steel", grade: "low carbon steel" };
  }
  if (/\bBRASS\b/.test(text)) {
    return { material: "brass", finish: "", displayMaterial: "brass", displayFinish: "brass", materialFinish: "brass", grade: "brass" };
  }
  return { material: "steel", finish: "zinc", displayMaterial: "steel", displayFinish: "zinc", materialFinish: "zinc steel", grade: "low carbon steel" };
}

function parseImperialFromPart(part = "", description = "") {
  const normalized = part.replace(/[^A-Z0-9.]/g, "");
  if (KNOWN_HANGER_BOLT_OVERRIDES[normalized]) {
    return { measurementSystem: "imperial", ...KNOWN_HANGER_BOLT_OVERRIDES[normalized] };
  }
  if (/^SSHB/.test(normalized)) {
    const rest = normalized.replace(/^SSHB/, "");
    const m = rest.match(/^(\d{2})(\d{3,5})([CF])?$/);
    if (!m) return {};
    const info = IMPERIAL_DIAMETERS[m[1]];
    if (!info) return {};
    const threadSeries = m[3] === "F" ? "fine" : detectThreadSeries(normalized, description, info);
    return { measurementSystem: "imperial", diameter: info.diameter, length: parseImperialLengthCode(m[2]), threadSeries, threadPitch: threadSeries === "fine" ? info.fine : info.coarse };
  }

  const patterns = [
    /^HBC?(\d{2})(\d{3,5})$/,
    /^HBF(\d{2})(\d{3,5})$/,
    /^HB(\d{2})(\d{3,5})([CF])?$/,
    /^HB([CF])(\d{2})(\d{3,5})$/,
  ];
  for (const pattern of patterns) {
    const m = normalized.match(pattern);
    if (!m) continue;
    let diameterCode = "";
    let lengthCode = "";
    let seriesHint = "";
    if (pattern.source.startsWith("^HB([CF])")) {
      seriesHint = m[1]; diameterCode = m[2]; lengthCode = m[3];
    } else {
      diameterCode = m[1]; lengthCode = m[2]; seriesHint = m[3] || (normalized.startsWith("HBF") ? "F" : normalized.startsWith("HBC") ? "C" : "");
    }
    const info = IMPERIAL_DIAMETERS[diameterCode];
    if (!info) return {};
    const threadSeries = seriesHint === "F" ? "fine" : seriesHint === "C" ? "coarse" : detectThreadSeries(normalized, description, info);
    return { measurementSystem: "imperial", diameter: info.diameter, length: parseImperialLengthCode(lengthCode), threadSeries, threadPitch: threadSeries === "fine" ? info.fine : info.coarse };
  }
  return {};
}

function parseMetricFromPart(part = "") {
  const normalized = part.replace(/[^A-Z0-9.]/g, "");
  const m = normalized.match(/^MMHB(\d{2})(\d{3,4})(\d{2,3})?$/);
  if (!m) return {};
  const info = METRIC_DIAMETERS[m[1]] || { diameter: `M${Number(m[1])}`, coarse: "", fine: "" };
  const threadPitch = m[3] ? normalizeMetricPitch(m[3]) : info.coarse;
  const threadSeries = info.fine && threadPitch === info.fine ? "fine" : "coarse";
  return { measurementSystem: "metric", diameter: info.diameter, length: String(Number(m[2])), threadPitch, threadSeries };
}

function parseImperialFromDescription(description = "") {
  const raw = clean(description).replace(/[×]/g, "x");
  const m = raw.match(/(?:^|\b)(\d+(?:-\d+\/\d+)?|\d+\/\d+|\.\d+|\d+\.\d+)\s*(?:-|x|X|\s+X\s+|\s*x\s*)\s*(\d+(?:-\d+\/\d+)?|\d+\/\d+|\.\d+|\d+\.\d+)\b/);
  if (!m) return {};
  let diameter = m[1].replace(/^\./, "0.");
  const length = m[2].replace(/^\./, "0.");
  if (/^0?\.\d+$/.test(diameter)) diameter = imperialDiameterFromDecimal(diameter) || diameter;
  const info = Object.values(IMPERIAL_DIAMETERS).find((item) => item.diameter === diameter) || {};
  const threadSeries = detectThreadSeries("", description, info);
  return { measurementSystem: "imperial", diameter, length, threadSeries, threadPitch: threadSeries === "fine" ? info.fine || "" : info.coarse || "" };
}

function parseMetricFromDescription(description = "") {
  const raw = clean(description).replace(/[×]/g, "x");
  const m = raw.match(/\bM\s*(\d+)\s*(?:[-xX]\s*([0-9]+(?:\.[0-9]+)?))?\s*(?:x|X)\s*(\d+)\s*MM?\b/i)
    || raw.match(/\bM\s*(\d+)\s*[-]\s*([0-9]+(?:\.[0-9]+)?)\s+(\d+)\s*MM?\b/i);
  if (!m) return {};
  const code = String(m[1]).padStart(2, "0");
  const info = METRIC_DIAMETERS[code] || { diameter: `M${Number(m[1])}`, coarse: "", fine: "" };
  const threadPitch = m[2] ? normalizeMetricPitch(m[2]) : info.coarse;
  return { measurementSystem: "metric", diameter: info.diameter, length: String(Number(m[3])), threadPitch, threadSeries: info.fine && threadPitch === info.fine ? "fine" : "coarse" };
}


function looksLikeHangerBoltDriver(product = {}) {
  const part = getPartNumber(product);
  const description = getDescription(product);
  const text = `${part} ${description}`.toUpperCase();
  return /\bHANGER\s+BOLT\s+DRIV(?:ER|E)?\b|\bHANGERBOLT\s+DRIV(?:ER|E)?\b|\bDRIV(?:ER|E)\s+(?:FOR\s+)?HANGER\s+BOLT\b/.test(text);
}

function parseDriverSize(product = {}) {
  const part = getPartNumber(product);
  const description = getDescription(product);
  const raw = clean(description).replace(/[×]/g, "x");
  const upper = `${part} ${raw}`.toUpperCase();

  const metric = upper.match(/\bM\s*(\d+)\b/);
  if (metric) {
    const code = String(metric[1]).padStart(2, "0");
    const info = METRIC_DIAMETERS[code] || { diameter: `M${Number(metric[1])}`, coarse: "", fine: "" };
    return { measurementSystem: "metric", diameter: info.diameter, threadSeries: "coarse", threadPitch: info.coarse || "" };
  }

  const fractional = raw.match(/(?:^|\b)(#?\d{1,2}|\d+\/\d+|\d+-\d+\/\d+|\.\d+|\d+\.\d+)(?=\s*(?:IN|INCH|\"|HANGER|DRIVER|DRIVE|$))/i);
  if (fractional) {
    let diameter = fractional[1].replace(/^\./, "0.").replace(/^#?12$/i, "#12");
    if (/^0?\.\d+$/.test(diameter)) diameter = imperialDiameterFromDecimal(diameter) || diameter;
    const normalizedDiameter = String(diameter).startsWith("#") ? diameter : diameter;
    const info = Object.values(IMPERIAL_DIAMETERS).find((item) => item.diameter === normalizedDiameter) || {};
    return { measurementSystem: "imperial", diameter: normalizedDiameter, threadSeries: "coarse", threadPitch: info.coarse || "" };
  }

  const codeMatch = part.match(/(?:HBD|HBDR|HBDRV|HANGERDRIVER)(\d{2})/i);
  if (codeMatch && IMPERIAL_DIAMETERS[codeMatch[1]]) {
    const info = IMPERIAL_DIAMETERS[codeMatch[1]];
    return { measurementSystem: "imperial", diameter: info.diameter, threadSeries: "coarse", threadPitch: info.coarse || "" };
  }

  return {};
}

function looksLikeHangerBolt(product = {}) {
  const part = getPartNumber(product);
  const description = getDescription(product);
  const text = `${part} ${description}`.toUpperCase();
  if (looksLikeHangerBoltDriver(product)) return true;
  if (/\bHANGER\s+BOLT\b|\bHANGERBOLT\b/.test(text)) return true;
  if (/^SSHB\d{5,7}[CF]?$/.test(part)) return true;
  if (/^MMHB\d{5,9}$/.test(part)) return true;
  if (/^HB[CF]?\d{5,7}[CF]?$/.test(part)) return true;
  return false;
}

function formatTitle(parsed = {}) {
  const titleDiameter = String(parsed.diameter || "").replace(/^#/, "");
  const thread = parsed.threadPitch ? `${titleDiameter}-${parsed.threadPitch}` : titleDiameter;
  const finish = parsed.materialFinish === "zinc steel" ? "Zinc" : parsed.materialFinish === "stainless steel" ? "Stainless Steel" : clean(parsed.materialFinish).replace(/\w/g, (c) => c.toUpperCase());

  if (parsed.productType === "hanger bolt driver") {
    const size = parsed.measurementSystem === "metric" ? `${titleDiameter}${parsed.threadPitch ? `-${parsed.threadPitch}` : ""}` : thread;
    return clean(`${size} Hanger Bolt Driver ${finish}`);
  }

  const size = parsed.measurementSystem === "metric" ? `${thread} x ${parsed.length}mm` : `${thread} x ${parsed.length}`;
  return clean(`${size} Hanger Bolt ${finish}`);
}

function detectHangerBoltProduct(product = {}) {
  if (!looksLikeHangerBolt(product)) return null;
  const partNumber = getPartNumber(product);
  const description = getDescription(product);
  const isDriver = looksLikeHangerBoltDriver(product);

  const metric = parseMetricFromPart(partNumber) || {};
  let parsed = isDriver
    ? parseDriverSize(product)
    : Object.keys(metric).length
      ? metric
      : parseImperialFromPart(partNumber, description);

  if (!parsed || !parsed.diameter) parsed = parseMetricFromDescription(description);
  if (!parsed || !parsed.diameter) parsed = parseImperialFromDescription(description);
  if (!parsed || !parsed.diameter || (!isDriver && !parsed.length)) return null;

  const material = detectMaterialFinish(partNumber, description);
  const productType = isDriver ? "hanger bolt driver" : "hanger bolt";
  const category = isDriver ? "bits & drivers" : "bolts";
  const subcategory = isDriver ? "hanger bolt drivers" : "hanger bolts";
  const full = {
    category,
    subcategory,
    productType,
    familyType: productType,
    fastenerType: productType,
    fastenerTypeCanonical: productType,
    headType: isDriver ? "driver" : "headless",
    drive_type: isDriver ? "hanger bolt driver" : "none",
    driveType: isDriver ? "hanger bolt driver" : "none",
    length: isDriver ? "" : parsed.length,
    ...parsed,
    ...material,
    partNumber,
    originalDescription: description,
  };
  full.title = formatTitle(full);
  full.shortTitle = full.title;
  full.familyKey = slugify(`${full.subcategory}-${full.productType}-${full.measurementSystem}-${full.diameter}-${full.threadPitch}-${full.length}-${full.materialFinish}`);
  full.bulletPoints = uniqueStrings([
    full.productType === "hanger bolt driver" ? "Driver for installing hanger bolts" : "Hanger bolt with machine-thread end and wood-screw end",
    full.measurementSystem === "metric" ? "Metric sizing" : "Imperial sizing",
    full.threadPitch ? `${full.threadPitch} thread pitch` : "Coarse thread",
    `${full.materialFinish} construction`,
  ]);
  return full;
}

function attributesFromParsed(parsed = {}, product = {}, existing = {}) {
  return {
    ...existing,
    productType: parsed.productType || parsed.familyType,
    familyType: parsed.familyType,
    fastenerType: parsed.fastenerType,
    fastenerTypeCanonical: parsed.fastenerTypeCanonical,
    category: parsed.category,
    subcategory: parsed.subcategory,
    measurementSystem: parsed.measurementSystem,
    diameter: parsed.diameter,
    threadSeries: parsed.threadSeries || "",
    threadPitch: parsed.threadPitch || "",
    length: parsed.length,
    material: parsed.material,
    finish: parsed.finish,
    displayMaterial: parsed.displayMaterial,
    displayFinish: parsed.displayFinish,
    materialFinish: parsed.materialFinish,
    grade: parsed.grade || "",
    headType: parsed.headType,
    drive_type: parsed.drive_type,
    driveType: parsed.driveType,
    fishbowlPartNum: parsed.partNumber || getPartNumber(product),
  };
}

function buildDescription(parsed = {}) {
  if (parsed.productType === "hanger bolt driver") {
    return clean(`${parsed.title}. Hanger bolt drivers are used to install hanger bolts without damaging the machine-thread end.`);
  }
  return clean(`${parsed.title}. Hanger bolts have a machine-thread end and a wood-screw end for fastening into wood while providing machine threads for nuts or fixtures.`);
}

function buildTags(parsed = {}) {
  return uniqueStrings([
    parsed.category,
    parsed.subcategory,
    "hanger bolt",
    parsed.productType,
    parsed.measurementSystem,
    parsed.diameter,
    parsed.threadPitch,
    parsed.length,
    parsed.materialFinish,
    parsed.grade,
  ]);
}

function buildSeoSlug(parsed = {}, partNumber = "") {
  return slugify(`${parsed.title || "hanger bolt"}-${partNumber}`);
}

export {
  attributesFromParsed,
  buildDescription,
  buildSeoSlug,
  buildTags,
  clean,
  detectHangerBoltProduct,
  uniqueStrings,
};

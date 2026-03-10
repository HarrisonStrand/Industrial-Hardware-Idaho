function cleanText(input = "") {
  return String(input)
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .trim();
}

function titleCase(value = "") {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))];
}

function detectFastenerType(text = "") {
  const lower = text.toLowerCase();

  const rules = [
    { match: /\bhex cap screw\b/, value: "Hex Cap Screw", subcategory: "Hex Cap Screws" },
    { match: /\bhex bolt\b/, value: "Hex Bolt", subcategory: "Hex Bolts" },
    { match: /\bcarriage bolt\b/, value: "Carriage Bolt", subcategory: "Carriage Bolts" },
    { match: /\blag bolt\b/, value: "Lag Bolt", subcategory: "Lag Bolts" },
    { match: /\bmachine screw\b/, value: "Machine Screw", subcategory: "Machine Screws" },
    { match: /\bself[ -]?drilling screw\b/, value: "Self-Drilling Screw", subcategory: "Self-Drilling Screws" },
    { match: /\bself[ -]?tapping screw\b/, value: "Self-Tapping Screw", subcategory: "Self-Tapping Screws" },
    { match: /\btek screw\b/, value: "Tek Screw", subcategory: "Tek Screws" },
    { match: /\bsplit lock washer\b/, value: "Split Lock Washer", subcategory: "Lock Washers" },
    { match: /\block washer\b/, value: "Lock Washer", subcategory: "Lock Washers" },
    { match: /\bfender washer\b/, value: "Fender Washer", subcategory: "Fender Washers" },
    { match: /\bflat washer\b/, value: "Flat Washer", subcategory: "Flat Washers" },
    { match: /\bjam nut\b/, value: "Jam Nut", subcategory: "Jam Nuts" },
    { match: /\bnylock nut\b/, value: "Nylock Nut", subcategory: "Nylock Nuts" },
    { match: /\bwing nut\b/, value: "Wing Nut", subcategory: "Wing Nuts" },
    { match: /\bhex nut\b/, value: "Hex Nut", subcategory: "Hex Nuts" },
    { match: /\bthreaded rod\b/, value: "Threaded Rod", subcategory: "Threaded Rod" },
    { match: /\banchor\b/, value: "Anchor", subcategory: "Anchors" },
  ];

  for (const rule of rules) {
    if (rule.match.test(lower)) {
      return {
        fastenerType: rule.value,
        category: "Fasteners",
        subcategory: rule.subcategory,
      };
    }
  }

  return {
    fastenerType: "",
    category: "",
    subcategory: "",
  };
}

function detectFinish(text = "") {
  const lower = text.toLowerCase();

  const finishes = [
    "zinc plated",
    "yellow zinc",
    "hot dip galvanized",
    "mechanical galvanized",
    "galvanized",
    "black oxide",
    "nickel plated",
    "chrome",
    "ptfe",
    "dacromet",
    "plain",
  ];

  for (const finish of finishes) {
    if (lower.includes(finish)) {
      return titleCase(finish);
    }
  }

  return "";
}

function detectMaterial(text = "") {
  const lower = text.toLowerCase();

  if (/\b316\b/.test(lower)) return "316 Stainless Steel";
  if (/\bstainless\b/.test(lower) || /\b18-8\b/.test(lower) || /\b304\b/.test(lower)) {
    return "Stainless Steel";
  }
  if (/\bbrass\b/.test(lower)) return "Brass";
  if (/\bsilicon bronze\b/.test(lower)) return "Silicon Bronze";
  if (/\bnylon\b/.test(lower)) return "Nylon";
  if (/\bsteel\b/.test(lower)) return "Steel";

  return "";
}

function detectGrade(text = "") {
  const lower = text.toLowerCase();

  if (/\bgrade 8\b/.test(lower)) return "Grade 8";
  if (/\bgrade 5\b/.test(lower)) return "Grade 5";
  if (/\ba307\b/.test(lower)) return "A307";
  if (/\ba2-70\b/.test(lower)) return "A2-70";
  if (/\ba4-80\b/.test(lower)) return "A4-80";
  if (/\bclass 8\.8\b/.test(lower)) return "Class 8.8";
  if (/\bclass 10\.9\b/.test(lower)) return "Class 10.9";

  return "";
}

function detectMeasurementSystem(text = "") {
  const lower = text.toLowerCase();

  if (/\bm\d+/.test(lower)) return "metric";
  if (/\b\d+(?:\.\d+)?\s*mm\b/.test(lower)) return "metric";
  if (/\bmm\b/.test(lower)) return "metric";

  return "imperial";
}

function detectSize(text = "") {
  const normalized = cleanText(text);

  // Imperial fractional thread size: 1/4-20 or 3/8"-16
  const imperialFractionPattern = /(?:^|\s)(\d+\/\d+)\s*"?\s*-\s*(\d+)(?=\s|$|x)/i;
  const imperialFractionMatch = normalized.match(imperialFractionPattern);
  if (imperialFractionMatch) {
    return {
      size: `${imperialFractionMatch[1]}-${imperialFractionMatch[2]}`,
      diameter: imperialFractionMatch[1],
      threadPitch: imperialFractionMatch[2],
      measurementSystem: "imperial",
    };
  }

  // Number size thread pattern: #10-24
  const numberedPattern = /(?:^|\s)(#\d+)\s*-\s*(\d+)(?=\s|$|x)/i;
  const numberedMatch = normalized.match(numberedPattern);
  if (numberedMatch) {
    return {
      size: `${numberedMatch[1].toUpperCase()}-${numberedMatch[2]}`,
      diameter: numberedMatch[1].toUpperCase(),
      threadPitch: numberedMatch[2],
      measurementSystem: "imperial",
    };
  }

  // Metric thread size: M8 x 1.25 or M10-1.5
  const metricPattern = /(?:^|\s)(M\d+)\s*(?:x|-)\s*(\d+(?:\.\d+)?)(?=\s|$|x)/i;
  const metricMatch = normalized.match(metricPattern);
  if (metricMatch) {
    return {
      size: `${metricMatch[1].toUpperCase()}-${metricMatch[2]}`,
      diameter: metricMatch[1].toUpperCase(),
      threadPitch: metricMatch[2],
      measurementSystem: "metric",
    };
  }

  // Washer / nut nominal size like 1/4 Flat Washer or 3/8 Hex Nut
  const nominalFractionMatch = normalized.match(/(?:^|\s)(\d+\/\d+)\s+(?=(flat washer|split lock washer|lock washer|fender washer|hex nut|jam nut|nylock nut|wing nut)\b)/i);
  if (nominalFractionMatch) {
    return {
      size: nominalFractionMatch[1],
      diameter: nominalFractionMatch[1],
      threadPitch: "",
      measurementSystem: "imperial",
    };
  }

  const nominalNumberedMatch = normalized.match(/(?:^|\s)(#\d+)\s+(?=(machine screw|sheet metal screw|self[ -]?tapping screw|self[ -]?drilling screw|tek screw)\b)/i);
  if (nominalNumberedMatch) {
    return {
      size: nominalNumberedMatch[1].toUpperCase(),
      diameter: nominalNumberedMatch[1].toUpperCase(),
      threadPitch: "",
      measurementSystem: "imperial",
    };
  }

  const nominalMetricMatch = normalized.match(/(?:^|\s)(M\d+)\s+(?=(flat washer|split lock washer|lock washer|hex nut|jam nut)\b)/i);
  if (nominalMetricMatch) {
    return {
      size: nominalMetricMatch[1].toUpperCase(),
      diameter: nominalMetricMatch[1].toUpperCase(),
      threadPitch: "",
      measurementSystem: "metric",
    };
  }

  return {
    size: "",
    diameter: "",
    threadPitch: "",
    measurementSystem: detectMeasurementSystem(normalized),
  };
}

function detectLength(text = "") {
  const normalized = cleanText(text);

  // Length expressed after x, like:
  // 5/16-18 x 2"
  // #10-24 x 1"
  // M8 x 1.25 x 30mm
  const xImperialMatch = normalized.match(/x\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*"/i);
  if (xImperialMatch) {
    return xImperialMatch[1];
  }

  const xImperialWordMatch = normalized.match(/x\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i);
  if (xImperialWordMatch) {
    return xImperialWordMatch[1];
  }

  const xMetricMatch = normalized.match(/x\s*(\d+(?:\.\d+)?)\s*mm\b/i);
  if (xMetricMatch) {
    return `${xMetricMatch[1]}mm`;
  }

  return "";
}

export function parseFastenerAttributes(input = "") {
  const normalizedName = cleanText(input);

  const sizeData = detectSize(normalizedName);
  const length = detectLength(normalizedName);
  const typeData = detectFastenerType(normalizedName);
  const finish = detectFinish(normalizedName);
  const material = detectMaterial(normalizedName);
  const grade = detectGrade(normalizedName);

  const keywords = uniqueStrings([
    sizeData.size,
    sizeData.diameter,
    sizeData.threadPitch,
    length,
    finish,
    material,
    grade,
    typeData.fastenerType,
    typeData.category,
    typeData.subcategory,
  ]);

  return {
    normalizedName,
    size: sizeData.size,
    diameter: sizeData.diameter,
    threadPitch: sizeData.threadPitch,
    length,
    measurementSystem: sizeData.measurementSystem,
    material,
    finish,
    grade,
    fastenerType: typeData.fastenerType,
    category: typeData.category,
    subcategory: typeData.subcategory,
    keywords,
  };
}

export default parseFastenerAttributes;
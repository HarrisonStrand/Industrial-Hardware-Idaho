//
// PART NUMBER GENERATOR (CommonJS)
// GUARANTEED WORKING BASELINE
//

const CATEGORY_CODES = {
  "Hex Cap Screws": "CS",
  "Socket Head Cap Screws": "SHCS",
  "Button Head Cap Screws": "BHCS",
  "Flat Head Cap Screws": "FHCS",

  "Machine Screw Pan": "MSP",
  "Machine Screw Oval": "MSO",
  "Machine Screw Truss": "MST",
  "Machine Screw Flat": "MSF",

  "Sheet Metal Screw Pan": "SMSP",
  "Sheet Metal Screw Oval": "SMSO",
  "Sheet Metal Screw Truss": "SMST",
  "Sheet Metal Screw Flat": "SMSF",
  "Sheet Metal Screw Hex Washer Head": "SMSH",

  "Flat Washers": "FW",
  "Lock Washers": "LW",
  "Split Lock Washers": "SW",
  "Fender Washers": "FEW",

  "Hex Nuts": "HN",
  "Lock Nuts": "LN",
  "Jam Nuts": "JN",
  "Cap Nuts": "CN"
};

const FINISH_CODES = {
  Plain: "",
  ZP: "ZP",
  BO: "BO",
  HDG: "HDG",
  SS: "SS",
  Stainless: "SS"
};

const THREAD_CODES = {
  Coarse: "C",
  Fine: "F"
};

const SCREW_DIAMETERS = {
  "#4": "04",
  "#6": "06",
  "#8": "08",
  "#10": "10",
  "#12": "12",
  "#14": "14"
};

const FRACTION_DIAMETERS = {
  "1/4": "04",
  "5/16": "05",
  "3/8": "06",
  "7/16": "07",
  "1/2": "08",
  "9/16": "09",
  "5/8": "10",
  "3/4": "12"
};

function lengthCode(length) {
  if (!length) return "";

  if (length.includes(" ")) {
    const [whole, frac] = length.split(" ");
    return whole.padStart(2, "0") + "08";
  }

  if (length.includes("/")) {
    return "00" + "08";
  }

  return length.padStart(2, "0");
}

function generatePartNumber({
  category,
  diameter,
  length,
  finish,
  thread,
  grade,
  drive
}) {
  const prefix = CATEGORY_CODES[category];
  if (!prefix) {
    throw new Error("Unknown category: " + category);
  }

  const isScrew = prefix.startsWith("MS") || prefix.startsWith("SMS");
  const isWasher = ["FW", "LW", "SW", "FEW"].includes(prefix);
  const isNut = ["HN", "LN", "JN", "CN"].includes(prefix);

  const finishCode = FINISH_CODES[finish] || "";
  const threadCode = THREAD_CODES[thread] || "";

  let diaCode = "";
  if (isScrew) {
    diaCode = SCREW_DIAMETERS[diameter];
  } else {
    diaCode = FRACTION_DIAMETERS[diameter];
  }

  if (!diaCode) throw new Error("Bad diameter");

  // WASHERS
  if (isWasher) {
    return (finishCode === "SS" ? "SS" : "") + prefix + diaCode;
  }

  // NUTS
  if (isNut) {
    return (finishCode === "SS" ? "SS" : "") + prefix + diaCode + threadCode;
  }

  // SCREWS
  if (isScrew) {
    return (finishCode === "SS" ? "SS" : "") + prefix + diaCode + lengthCode(length);
  }

  // BOLTS
  const gradeDigits = grade ? grade.replace(/\D/g, "") : "";
  return (
    prefix +
    gradeDigits +
    threadCode +
    diaCode +
    lengthCode(length) +
    finishCode
  );
}

module.exports = { generatePartNumber };

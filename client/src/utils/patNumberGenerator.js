//
// PART NUMBER GENERATOR
//

// -----------------------------------------------
// CATEGORY MAP
// -----------------------------------------------
const CATEGORY_CODES = {
  "Hex Cap Screw": "CS",
  "Button Head Cap Screw": "BHCS",
  "Flat Head Cap Screw": "FHCS",
  "Socket Head Cap Screw": "SHCS",

  // Machine Screws
  "Machine Screw Pan": "MSP",
  "Machine Screw Oval": "MSO",
  "Machine Screw Truss": "MST",
  "Machine Screw Flat": "MSF",

  // Sheet Metal Screws
  "Sheet Metal Screw Pan": "SMSP",
  "Sheet Metal Screw Oval": "SMSO",
  "Sheet Metal Screw Truss": "SMST",
  "Sheet Metal Screw Flat": "SMSF",
  "Sheet Metal Screw Hex Washer Head": "SMSH"
};

// -----------------------------------------------
// FINISH MAP (SUFFIXES)
// -----------------------------------------------
const FINISH_CODES = {
  Stainless: "SS",
  StainlessSteel: "SS",
  ZP: "ZP",
  Zinc: "ZP",
  "Zinc Plated": "ZP",
  BO: "BO",
  "Black Oxide": "BO",
  HDG: "HDG",
  "Hot-Dip Galvanized": "HDG",
  ALU: "ALU",
  Aluminum: "ALU",
  BR: "BR",
  Brass: "BR",
  PL: "PL",
  Plain: "PL"
};

// -----------------------------------------------
// DRIVE TYPE MAP (SUFFIXES)
// -----------------------------------------------
const DRIVE_CODES = {
  Phillips: "P",
  P: "P",
  Slotted: "S",
  S: "S",
  Torx: "T",
  T: "T",
  Hex: "H",
  H: "H"
};

// -----------------------------------------------
// THREAD MAP
// -----------------------------------------------
const THREAD_CODES = {
  Coarse: "C",
  "Coarse (UNC)": "C",
  Fine: "F",
  "Fine (UNF)": "F"
};

// -----------------------------------------------
// SCREW DIAMETER MAP (#4–#14)
// -----------------------------------------------
const SCREW_DIAMETERS = {
  "#4": "04",
  "#5": "05",
  "#6": "06",
  "#7": "07",
  "#8": "08",
  "#10": "10",
  "#12": "12",
  "#14": "14"
};

// -----------------------------------------------
// FRACTION → SIZE CODE for bolts
// -----------------------------------------------
// follows your existing 1/16 progression:
// 1/4=04, 5/16=05, 3/8=06, 7/16=07, 1/2=08, 9/16=09, 5/8=10, 3/4=12
const FRACTION_SIZE_MAP = {
  "1/4": "04",
  "5/16": "05",
  "3/8": "06",
  "7/16": "07",
  "1/2": "08",
  "9/16": "09",
  "5/8": "10",
  "3/4": "12"
};

// -----------------------------------------------
// LENGTH CONVERSION: 3 1/2 → 0308 etc.
// -----------------------------------------------
function convertLength(lengthStr) {
  if (!lengthStr) return "";

  // whole number only
  if (!lengthStr.includes(" ")) {
    const whole = parseInt(lengthStr);
    return whole.toString().padStart(2, "0");
  }

  // whole + fraction (e.g., "3 1/2")
  const [wholeStr, fracStr] = lengthStr.split(" ");
  const whole = parseInt(wholeStr);

  const fractionMap = {
    "1/2": "08",
    "1/4": "04",
    "3/4": "12",
    "3/8": "06",
    "5/8": "10",
    "7/8": "14"
  };

  const fracCode = fractionMap[fracStr] || "00";

  return whole.toString().padStart(2, "0") + fracCode;
}

// -----------------------------------------------
// MAIN GENERATOR
// -----------------------------------------------
export function generatePartNumber({
  category,
  grade,
  diameter,
  length,
  thread,
  finish,
  drive
}) {
  if (!category) throw new Error("Category is required.");
  const catCode = CATEGORY_CODES[category];
  if (!catCode) throw new Error(`Unknown category: ${category}`);

  // -------------------------------------------
  // Determine if this is a screw or a bolt
  // -------------------------------------------
  const isScrew =
    catCode.startsWith("MS") || catCode.startsWith("SMS") || catCode.includes("HCS") === false;

  let diameterCode = "";

  if (isScrew) {
    // screw diameters are # sizes
    diameterCode = SCREW_DIAMETERS[diameter];
    if (!diameterCode)
      throw new Error(`Unknown screw diameter: ${diameter}`);
  } else {
    // bolts use fractional diameter
    diameterCode = FRACTION_SIZE_MAP[diameter];
    if (!diameterCode)
      throw new Error(`Unknown bolt diameter: ${diameter}`);
  }

  const lengthCode = convertLength(length);

  const threadCode = thread ? THREAD_CODES[thread] : "";
  const gradeCode = grade ? grade.replace(/\D/g, "") : ""; // only keep numbers
  const finishCode = finish ? FINISH_CODES[finish] : "";
  const driveCode = drive ? DRIVE_CODES[drive] : "";

  // ---------------------------------------------------
  // FINAL PART NUMBER FORMATION RULES
  // ---------------------------------------------------

  // MACHINE + SHEET METAL SCREWS
  if (isScrew) {
    // Example: SMSP0802P or SSSMSP0802H
    return (
      catCode +
      diameterCode +
      lengthCode +
      (driveCode || finishCode || "") // drive preferred before finish
    );
  }

  // BOLTS (GRADE, THREAD, DIAM, LENGTH, FINISH)
  // Example: CS5C0803 or BHCSC0502SS
  return (
    catCode +
    (gradeCode || "") +
    (threadCode || "") +
    diameterCode +
    lengthCode +
    (finishCode || "")
  );
}

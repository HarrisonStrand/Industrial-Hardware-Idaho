import parseFastenerAttributes from "../utils/parseFastenerAttributes.js";

const samples = [
  '1/4-20 Zinc Plated Hex Bolt',
  '3/8"-16 Stainless Steel Hex Cap Screw',
  '1/2-20 Jam Nut Zinc Plated',
  '5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
  '#10-24 x 1" Phillips Machine Screw Stainless',
  'M8 x 1.25 x 30mm Hex Bolt Class 8.8',
  '1/4 Flat Washer Stainless Steel',
  '3/8 Split Lock Washer Zinc Plated',
  '1/2-13 Hex Nut Grade 5 Plain',
  'M10 Hex Nut Class 10.9',
  '#8 Machine Screw Zinc Plated',
];

for (const sample of samples) {
  console.log("\n====================================");
  console.log("INPUT:", sample);
  console.log(JSON.stringify(parseFastenerAttributes(sample), null, 2));
}
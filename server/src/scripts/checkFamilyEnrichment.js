// server/src/scripts/checkFamilyEnrichment.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import ProductEnrichment from "../models/ProductEnrichment.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const enrichment = await ProductEnrichment.findOne({
      "attributes.familyKey": "fasteners|hex bolts|hex bolt|yellow zinc|grade 8|imperial",
    }).lean();

    console.log(JSON.stringify(enrichment, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
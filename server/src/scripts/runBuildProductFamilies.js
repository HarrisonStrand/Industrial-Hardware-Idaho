import mongoose from "mongoose";
import dotenv from "dotenv";
import buildProductFamilies from "./buildProductFamilies.js";

dotenv.config();

async function run() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);

    console.log("🚀 Running PRODUCT FAMILY BUILD (DRY RUN)...");

const result = await buildProductFamilies({
  category: "bolts",
  subcategory: "hex cap screws",
  dryRun: true,
});

    console.log("\n✅ RESULT:");
    console.log(JSON.stringify(result, null, 2));

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  } catch (err) {
    console.error("❌ ERROR:", err);
    process.exit(1);
  }
}

run();
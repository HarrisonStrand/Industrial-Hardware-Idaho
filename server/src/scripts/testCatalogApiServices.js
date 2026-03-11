import mongoose from "mongoose";
import dotenv from "dotenv";

import getPublishedCatalog from "../services/catalog/getPublishedCatalog.js";
import getPublishedProductBySlug from "../services/catalog/getPublishedProductBySlug.js";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const catalog = await getPublishedCatalog({
      limit: 20,
      skip: 0,
    });

    console.log("\n=== CATALOG LIST ===");
    console.log(JSON.stringify(catalog, null, 2));

    if (catalog.items.length > 0) {
      const slug = catalog.items[0].slug;
      const product = await getPublishedProductBySlug(slug);

      console.log("\n=== PRODUCT BY SLUG ===");
      console.log(JSON.stringify(product, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error("Catalog API service test failed:", error);
    process.exit(1);
  }
}

run();
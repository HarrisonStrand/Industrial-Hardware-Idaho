import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/Product.js";

dotenv.config();

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const part = getArg("part") || process.argv[2] || "";
  const dryRun = hasFlag("dry-run");
  const setInactive = hasFlag("inactive");

  if (!part) {
    console.error("Usage: node src/scripts/unpublishProductByPartNumber.js --part=91280A961 [--dry-run] [--inactive]");
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGO_URI or MONGODB_URI");

  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB connected");

  const regex = new RegExp(`^${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const products = await Product.find({
    $or: [
      { sku: regex },
      { internalPartNumber: regex },
      { "fishbowl.partNum": regex },
    ],
  });

  if (!products.length) {
    console.log(`No products found for ${part}`);
    await mongoose.disconnect();
    return;
  }

  for (const product of products) {
    const before = {
      partNumber: product?.fishbowl?.partNum || product.sku,
      isPublished: product.isPublished,
      isActive: product.isActive,
      catalogStatus: product.catalogStatus,
      reviewStatus: product?.review?.status || "",
    };

    product.isPublished = false;
    if (setInactive) product.isActive = false;
    product.catalogStatus = setInactive ? "archived" : "ready";
    product.review = {
      ...(product.review?.toObject?.() || product.review || {}),
      status: product?.review?.status && product.review.status !== "published" ? product.review.status : "approved",
    };

    const after = {
      partNumber: product?.fishbowl?.partNum || product.sku,
      isPublished: product.isPublished,
      isActive: product.isActive,
      catalogStatus: product.catalogStatus,
      reviewStatus: product?.review?.status || "",
    };

    console.log(JSON.stringify({ before, after, dryRun }, null, 2));

    if (!dryRun) {
      await product.save();
    }
  }

  console.log(dryRun ? "🔎 Dry run only" : "✅ Unpublish complete");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

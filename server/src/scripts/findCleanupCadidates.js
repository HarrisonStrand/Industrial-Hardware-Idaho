import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";

const BAD_PART_PATTERN = /(zz|void|delete)/i;

function clean(value = "") {
  return String(value || "").trim();
}

function normalizePart(value = "") {
  return clean(value).replace(/^\*+/, "").toLowerCase();
}

function startsWithStar(value = "") {
  return /^\*/.test(clean(value));
}

function buildCleanupQuery() {
  return {
    $or: [
      { "fishbowl.partNum": BAD_PART_PATTERN },
      { sku: BAD_PART_PATTERN },
      { internalPartNumber: BAD_PART_PATTERN },

      { "fishbowl.partNum": /^\*/ },
      { sku: /^\*/ },
      { internalPartNumber: /^\*/ },
      { "fishbowl.description": /^\*/ },
    ],
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const rows = await Product.find(
    buildCleanupQuery(),
    {
      _id: 1,
      sku: 1,
      internalPartNumber: 1,
      "fishbowl.partNum": 1,
      "fishbowl.description": 1,
      isPublished: 1,
      catalogStatus: 1,
      enrichmentId: 1,
    }
  )
    .sort({ "fishbowl.partNum": 1, sku: 1 })
    .lean();

  const byNormalizedPart = new Map();

  for (const row of rows) {
    const rawPart =
      row?.fishbowl?.partNum || row?.sku || row?.internalPartNumber || "";
    const normalized = normalizePart(rawPart);
    if (!normalized) continue;

    if (!byNormalizedPart.has(normalized)) {
      byNormalizedPart.set(normalized, []);
    }
    byNormalizedPart.get(normalized).push(row);
  }

  const starPairs = [];
  for (const [normalized, group] of byNormalizedPart.entries()) {
    const starred = group.filter((item) =>
      startsWithStar(item?.fishbowl?.partNum || item?.sku || item?.internalPartNumber || "")
    );
    const plain = group.filter(
      (item) =>
        !startsWithStar(item?.fishbowl?.partNum || item?.sku || item?.internalPartNumber || "")
    );

    if (starred.length && plain.length) {
      starPairs.push({
        normalizedPart: normalized,
        starred: starred.map((item) => ({
          id: String(item._id),
          partNumber: item?.fishbowl?.partNum || "",
          sku: item?.sku || "",
          description: item?.fishbowl?.description || "",
          isPublished: !!item?.isPublished,
          catalogStatus: item?.catalogStatus || "",
        })),
        plain: plain.map((item) => ({
          id: String(item._id),
          partNumber: item?.fishbowl?.partNum || "",
          sku: item?.sku || "",
          description: item?.fishbowl?.description || "",
          isPublished: !!item?.isPublished,
          catalogStatus: item?.catalogStatus || "",
        })),
      });
    }
  }

  const preview = rows.map((row) => ({
    id: String(row._id),
    partNumber: row?.fishbowl?.partNum || "",
    sku: row?.sku || "",
    internalPartNumber: row?.internalPartNumber || "",
    description: row?.fishbowl?.description || "",
    startsWithStar:
      startsWithStar(row?.fishbowl?.partNum) ||
      startsWithStar(row?.sku) ||
      startsWithStar(row?.internalPartNumber) ||
      startsWithStar(row?.fishbowl?.description),
    badPartPattern:
      BAD_PART_PATTERN.test(row?.fishbowl?.partNum || "") ||
      BAD_PART_PATTERN.test(row?.sku || "") ||
      BAD_PART_PATTERN.test(row?.internalPartNumber || ""),
    isPublished: !!row?.isPublished,
    catalogStatus: row?.catalogStatus || "",
  }));

  console.log(`Found ${rows.length} cleanup candidates`);
  console.log(`Found ${starPairs.length} starred/plain duplicate groups`);

  console.log("===== CLEANUP PREVIEW =====");
  console.log(JSON.stringify(preview.slice(0, 300), null, 2));

  console.log("===== STAR DUPLICATE PAIRS =====");
  console.log(JSON.stringify(starPairs.slice(0, 200), null, 2));

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Preview failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
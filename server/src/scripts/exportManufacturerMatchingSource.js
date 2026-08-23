// server/src/scripts/exportManufacturerMatchingSource.js
// Exports a manufacturer-matching source file without pricing, inventory, customer,
// or credential data.

import "../config/env.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

function clean(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const products = await Product.find(
    { isActive: { $ne: false } },
    {
      _id: 1,
      sku: 1,
      internalPartNumber: 1,
      vendor: 1,
      brand: 1,
      isActive: 1,
      isPublished: 1,
      "review.status": 1,
      "fishbowl.partNum": 1,
      "fishbowl.description": 1,
    },
  ).lean();

  const productIds = products.map((p) => p._id);

  const enrichments = await ProductEnrichment.find(
    { productId: { $in: productIds } },
    {
      productId: 1,
      title: 1,
      websiteBrand: 1,
      websiteVendor: 1,
      category: 1,
      subcategory: 1,
      attributes: 1,
    },
  ).lean();

  const enrichmentMap = new Map(
    enrichments.map((e) => [String(e.productId), e]),
  );

  const rows = products.map((product) => {
    const enrichment = enrichmentMap.get(String(product._id)) || {};
    const attrs = enrichment.attributes || {};

    return {
      partNumber: clean(product?.fishbowl?.partNum || product?.sku),
      description: clean(product?.fishbowl?.description),
      sku: clean(product?.sku),
      internalPartNumber: clean(product?.internalPartNumber),
      productVendor: clean(product?.vendor),
      productBrand: clean(product?.brand),
      websiteVendor: clean(enrichment?.websiteVendor),
      websiteBrand: clean(enrichment?.websiteBrand),
      category: clean(enrichment?.category),
      subcategory: clean(enrichment?.subcategory),
      websiteTitle: clean(enrichment?.title),
      familyType: clean(attrs?.familyType || attrs?.fastenerTypeCanonical || attrs?.fastenerType),
      measurementSystem: clean(attrs?.measurementSystem),
      size: clean(attrs?.size),
      diameter: clean(attrs?.diameter),
      threadPitch: clean(attrs?.threadPitch),
      threadSeries: clean(attrs?.threadSeries || attrs?.thread_series),
      length: clean(attrs?.length),
      material: clean(attrs?.material),
      finish: clean(attrs?.finish),
      grade: clean(attrs?.grade),
      driveType: clean(attrs?.driveType || attrs?.drive_type),
      washerStandard: clean(attrs?.washerStandard),
      active: product?.isActive !== false,
      published: !!product?.isPublished,
      reviewStatus: clean(product?.review?.status),
    };
  });

  rows.sort((a, b) =>
    a.partNumber.localeCompare(b.partNumber, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  const headers = [
    "IHI Part Number",
    "IHI Description",
    "SKU",
    "Internal Part Number",
    "Product Vendor",
    "Product Brand",
    "Website Vendor",
    "Website Brand",
    "Category",
    "Subcategory",
    "Website Title",
    "Family Type",
    "Measurement System",
    "Size",
    "Diameter",
    "Thread Pitch",
    "Thread Series",
    "Length",
    "Material",
    "Finish",
    "Grade",
    "Drive Type",
    "Washer Standard",
    "Active",
    "Published",
    "Review Status",
  ];

  const keys = [
    "partNumber",
    "description",
    "sku",
    "internalPartNumber",
    "productVendor",
    "productBrand",
    "websiteVendor",
    "websiteBrand",
    "category",
    "subcategory",
    "websiteTitle",
    "familyType",
    "measurementSystem",
    "size",
    "diameter",
    "threadPitch",
    "threadSeries",
    "length",
    "material",
    "finish",
    "grade",
    "driveType",
    "washerStandard",
    "active",
    "published",
    "reviewStatus",
  ];

  const outputDir = path.resolve(process.cwd(), "tmp");
  fs.mkdirSync(outputDir, { recursive: true });

  const csvPath = path.join(outputDir, "manufacturer-matching-source.csv");
  const jsonPath = path.join(outputDir, "manufacturer-matching-source.json");

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(",")),
  ].join("\n");

  fs.writeFileSync(csvPath, csv, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), "utf8");

  console.log(`✅ Exported ${rows.length} active product records`);
  console.log(`CSV:  ${csvPath}`);
  console.log(`JSON: ${jsonPath}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("❌ Manufacturer matching export failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

import fs from "fs";
import path from "path";
import crypto from "crypto";

const VENDOR_IMAGE_DIR = path.resolve("public/vendor-images");

function asString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function sanitizeFilePart(value = "") {
  return asString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getExtensionFromUrl(url = "") {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.endsWith(".png")) return ".png";
    if (pathname.endsWith(".webp")) return ".webp";
    if (pathname.endsWith(".jpeg")) return ".jpeg";
    if (pathname.endsWith(".jpg")) return ".jpg";
  } catch {
    return ".jpg";
  }

  return ".jpg";
}

function buildFileName({ vendorName, vendorPartNumber, imageUrl }) {
  const vendor = sanitizeFilePart(vendorName || "vendor");
  const part = sanitizeFilePart(vendorPartNumber || "unknown-part");
  const hash = crypto
    .createHash("md5")
    .update(asString(imageUrl))
    .digest("hex")
    .slice(0, 10);

  const ext = getExtensionFromUrl(imageUrl);

  return `${vendor}__${part}__${hash}${ext}`;
}

export async function downloadAndStoreVendorImage(input = {}) {
  const imageUrl = asString(input.imageUrl);
  const vendorName = asString(input.vendorName);
  const vendorPartNumber = asString(input.vendorPartNumber);

  if (!imageUrl) {
    return {
      action: "skipped",
      reason: "No imageUrl provided",
      storedPath: "",
      publicUrl: "",
    };
  }

  ensureDirExists(VENDOR_IMAGE_DIR);

  const fileName = buildFileName({
    vendorName,
    vendorPartNumber,
    imageUrl,
  });

  const absolutePath = path.join(VENDOR_IMAGE_DIR, fileName);
  const publicUrl = `/public/vendor-images/${fileName}`;

  if (fs.existsSync(absolutePath)) {
    return {
      action: "exists",
      reason: "Image already downloaded",
      storedPath: absolutePath,
      publicUrl,
    };
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(absolutePath, buffer);

  return {
    action: "downloaded",
    reason: "Image downloaded and stored locally",
    storedPath: absolutePath,
    publicUrl,
  };
}

export default downloadAndStoreVendorImage;
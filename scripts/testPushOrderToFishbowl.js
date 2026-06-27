import "../config/env.js";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import { pushOrderToFishbowl } from "../services/fishbowl/pushOrderToFishbowl.js";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1] || fallback;
  return fallback;
}

const orderNumber = getArg("order");
const orderId = getArg("id");
const dryRun = process.argv.includes("--dry-run");

if (!orderNumber && !orderId) {
  console.error("Usage: node src/scripts/testPushOrderToFishbowl.js --dry-run --order=IHI-2026-000118");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const order = orderId
  ? await Order.findById(orderId)
  : await Order.findOne({ orderNumber });

if (!order) {
  console.error("❌ Order not found");
  await mongoose.disconnect();
  process.exit(1);
}

console.log("===== ORDER =====");
console.log(JSON.stringify({
  id: String(order._id),
  orderNumber: order.orderNumber,
  payment: order.payment,
  adminReview: order.adminReview,
  fishbowlStatus: order.fishbowlStatus,
  fishbowlError: order.fishbowlError,
  items: order.items?.map((item) => ({
    partNumber: item.partNumber,
    vendorPartNumber: item.vendorPartNumber,
    qty: item.qty,
    unitPrice: item.unitPrice,
    uom: item.uom || item?.attributes?.uom,
  })),
}, null, 2));

const result = await pushOrderToFishbowl(order._id, { dryRun });

console.log("===== FISHBOWL PUSH RESULT =====");
console.log(JSON.stringify(result, null, 2));

await mongoose.disconnect();
console.log("✅ Done");

import Order from "../models/Order.js";

function pad(n, width) {
  const s = String(n);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

export async function generateOrderNumber() {
  // Simple sequence based on count. Good for now.
  // (If you want “no gaps ever”, we can move to a counters collection.)
  const count = await Order.countDocuments();
  const seq = count + 1;
  const year = new Date().getFullYear();
  return `IHI-${year}-${pad(seq, 6)}`;
}
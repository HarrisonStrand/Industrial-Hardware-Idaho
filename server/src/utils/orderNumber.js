import Counter from "../models/Counter.js";

function pad(n, width) {
  const s = String(n);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

export async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const key = `orderNumber-${year}`;

  // Atomic increment (no collisions, even under concurrency)
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `IHI-${year}-${pad(counter.seq, 6)}`;
}
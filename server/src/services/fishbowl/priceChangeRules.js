// Plain rules for Fishbowl price changes (no database). The nightly price sync uses them to decide
// which changes go live on their own and which wait for an admin.

export const PRICE_SYNC_LIMITS = {
  // A move bigger than this (either way) waits for an admin.
  maxAutoSwingPct: 50,
  // Stop the whole run if Fishbowl sent fewer products than this share of the ones we match on.
  minMatchedShare: 0.5,
  // Stop the whole run if more than this share of matched products would change at once.
  maxChangedShare: 0.25,
};

export function toPrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10000) / 10000 : null;
}

// Decides one product: "same" (no change), "apply" (goes live now), "hold" (waits for an admin)
// or "skip" (Fishbowl sent no usable price).
export function classifyPriceChange(oldValue, newValue, limits = PRICE_SYNC_LIMITS) {
  const oldPrice = toPrice(oldValue);
  const newPrice = toPrice(newValue);

  if (newPrice === null || newPrice < 0) return { action: "skip", reason: "Fishbowl has no usable price" };
  if (oldPrice !== null && Math.abs(newPrice - oldPrice) < 0.005) return { action: "same", reason: "" };
  if (newPrice === 0) return { action: "hold", reason: "Price drops to $0" };
  if (oldPrice === null || oldPrice === 0) return { action: "hold", reason: "First price for this product" };

  const changePct = ((newPrice - oldPrice) / oldPrice) * 100;
  if (Math.abs(changePct) > limits.maxAutoSwingPct) {
    return {
      action: "hold",
      reason: `Price ${changePct > 0 ? "rises" : "drops"} ${Math.abs(changePct).toFixed(0)}%`,
      changePct,
    };
  }
  return { action: "apply", reason: "", changePct };
}

// Whole-run safety checks. Returns a message when the run must stop without changing anything.
export function checkRunLimits({ matched = 0, expected = 0, changing = 0 } = {}, limits = PRICE_SYNC_LIMITS) {
  if (expected > 0 && matched < expected * limits.minMatchedShare) {
    return `Fishbowl matched only ${matched} of ${expected} products; stopped without changing prices.`;
  }
  if (matched > 0 && changing > matched * limits.maxChangedShare) {
    return `${changing} of ${matched} prices would change at once; stopped without changing prices. Check Fishbowl, then run it by hand.`;
  }
  return "";
}

// Fishbowl can list more than one product for a part; the one numbered like the part wins.
export function pickFishbowlPrice(rows = [], partNumber = "") {
  const exact = rows.find((row) => String(row?.number || "") === String(partNumber));
  const row = exact || rows[0];
  return row ? toPrice(row.price) : null;
}

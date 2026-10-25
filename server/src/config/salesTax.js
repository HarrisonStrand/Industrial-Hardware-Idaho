// Idaho state sales tax. Every order is picked up at the Boise store, so one
// flat rate applies (no local-option tax). SALES_TAX_RATE overrides it, e.g. 0.06.
const envRate = Number(process.env.SALES_TAX_RATE);
export const SALES_TAX_RATE = Number.isFinite(envRate) && envRate >= 0 && envRate < 1 ? envRate : 0.06;
export const SALES_TAX_LABEL = "Idaho sales tax";

// Customers whose exemption certificate an admin approved pay no tax.
export function isTaxExempt(user) {
  return user?.tax?.status === "exempt";
}

// Tax in cents on a subtotal in cents, rounded to the nearest cent.
export function calcSalesTaxCents(subtotalCents, exempt = false) {
  if (exempt) return 0;
  return Math.round(Math.max(0, Number(subtotalCents || 0)) * SALES_TAX_RATE);
}

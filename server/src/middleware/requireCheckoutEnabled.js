import { getSiteSwitches } from "../services/catalog/catalogLayoutDefaults.js";

// Blocks order and payment routes while checkout is switched off in
// Admin > Catalog Layout. Admins always pass so they can test. Run after requireAuth.
export default async function requireCheckoutEnabled(req, res, next) {
  try {
    if (req.user?.role === "admin") return next();

    const { checkoutEnabled } = await getSiteSwitches();
    if (checkoutEnabled) return next();

    return res.status(403).json({ error: "Checkout is not available yet." });
  } catch (error) {
    // Fail closed: if the switch cannot be read, do not take orders.
    console.error("Checkout switch check failed:", error);
    return res.status(403).json({ error: "Checkout is not available yet." });
  }
}

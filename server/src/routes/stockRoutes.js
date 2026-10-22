import { Router } from "express";
import Product from "../models/Product.js";

const router = Router();

// Current stock for the products in a cart, from the Fishbowl inventory snapshot.
// POST /api/stock { productIds: [...] } -> { stock: { [productId]: qtyAvailable } }
router.post("/", async (req, res) => {
	try {
		const ids = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
		const productIds = [...new Set(ids.map(String).filter((id) => /^[a-f0-9]{24}$/i.test(id)))].slice(0, 200);
		if (!productIds.length) return res.json({ stock: {} });

		const products = await Product.find({ _id: { $in: productIds } }, { "inventory.qtyAvailable": 1 }).lean();
		const stock = {};
		for (const product of products) {
			stock[String(product._id)] = Math.max(0, Math.floor(Number(product?.inventory?.qtyAvailable || 0)));
		}
		return res.json({ stock });
	} catch (err) {
		console.error("STOCK LOOKUP ERROR:", err);
		return res.status(500).json({ error: "Could not load stock levels." });
	}
});

export default router;

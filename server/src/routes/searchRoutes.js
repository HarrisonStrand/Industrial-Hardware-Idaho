import { Router } from "express";
import globalSearch from "../services/search/globalSearch.js";

const router = Router();

router.get("/", async (req, res) => {
	try {
		const result = await globalSearch({
			query: req.query.q || req.query.search || "",
			productLimit: req.query.productLimit || req.query.limitProducts || 8,
			builderLimit: req.query.builderLimit || req.query.limitBuilders || 6,
		});

		return res.json(result);
	} catch (error) {
		console.error("Global search failed:", error);
		return res.status(500).json({ message: "Search failed" });
	}
});

export default router;

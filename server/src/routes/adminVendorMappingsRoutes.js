import express from "express";
import VendorMapping from "../models/VendorMapping.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
	approveVendorMapping,
	rejectVendorMapping,
} from "../services/catalog/reviewVendorMapping.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/", async (req, res) => {
	try {
		const items = await VendorMapping.find({
			needsReview: true,
		})
			.sort({ confidenceScore: -1, createdAt: -1 })
			.limit(200)
			.lean();

		res.json({ items });
	} catch (err) {
		res.status(500).json({ message: err.message || "Failed to load review mappings" });
	}
});

router.post("/:id/approve", async (req, res) => {
	try {
		const result = await approveVendorMapping(req.params.id);
		res.json(result);
	} catch (err) {
		res.status(500).json({ message: err.message || "Failed to approve mapping" });
	}
});

router.post("/:id/reject", async (req, res) => {
	try {
		const result = await rejectVendorMapping(req.params.id);
		res.json(result);
	} catch (err) {
		res.status(500).json({ message: err.message || "Failed to reject mapping" });
	}
});

export default router;
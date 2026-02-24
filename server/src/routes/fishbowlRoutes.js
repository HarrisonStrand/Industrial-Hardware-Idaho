// src/routes/fishbowlRoutes.js
import express from "express";
import { requireAuth } from "../middleware/auth.js"; // adjust path if needed
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";

const router = express.Router();

router.get("/health", requireAuth, async (req, res) => {
  try {
    const data = await fishbowlClient.health();
    res.status(data.ok ? 200 : 500).json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "Fishbowl health failed" });
  }
});

export default router;
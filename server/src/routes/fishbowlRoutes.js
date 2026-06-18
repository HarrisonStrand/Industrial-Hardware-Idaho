// src/routes/fishbowlRoutes.js
import express from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";
import SyncRun from "../models/SyncRun.js";
import {
  getFishbowlInventorySyncRuntimeState,
  runFishbowlInventoryMapSync,
} from "../services/fishbowl/syncFishbowlInventoryMap.js";
import {
  getFishbowlInventorySyncSchedulerState,
} from "../services/fishbowl/fishbowlInventorySyncScheduler.js";

const router = express.Router();

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseNotesMetadata(notes = "") {
  if (!notes || typeof notes !== "string") return {};
  try {
    const parsed = JSON.parse(notes);
    return safeObject(parsed);
  } catch {
    return {};
  }
}

function mapSyncRun(row) {
  if (!row) return null;

  const metadata = {
    ...parseNotesMetadata(row.notes),
    ...safeObject(row.metadata),
  };

  return {
    id: String(row._id),
    jobType: row.jobType,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs || 0,
    stats: row.stats || {},
    metadata,
    errors: row.errors || [],
  };
}

router.get("/health", requireAuth, async (req, res) => {
  try {
    const data = await fishbowlClient.health();
    res.status(data.ok ? 200 : 500).json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "Fishbowl health failed" });
  }
});

router.get("/inventory-sync/status", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const lastRun = await SyncRun.findOne({ jobType: "fishbowl-inventory" })
      .sort({ startedAt: -1 })
      .lean();

    res.json({
      ok: true,
      runtime: getFishbowlInventorySyncRuntimeState(),
      schedule: getFishbowlInventorySyncSchedulerState(),
      lastRun: mapSyncRun(lastRun),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err?.message || "Failed to load inventory sync status" });
  }
});

router.post("/inventory-sync/run", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = safeObject(req.body);
    const dryRun = body.dryRun === true;
    const samples = body.samples !== false;
    const setMissingZero = body.setMissingZero === true;
    const limit = Math.max(0, Number(body.limit || 0) || 0);
    const category = String(body.category || "bolts").trim() || "bolts";
    const partNumber = String(body.partNumber || "").trim();

    const result = await runFishbowlInventoryMapSync({
      dryRun,
      samples,
      setMissingZero,
      limit,
      category,
      partNumber,
      triggeredBy: req.user?.email || req.user?.id || "admin-button",
      persistRun: true,
    });

    res.json({
      ok: true,
      message: dryRun ? "Inventory sync dry run complete" : "Inventory quantities updated",
      result,
    });
  } catch (err) {
    const status = err?.status || (err?.code === "FISHBOWL_INVENTORY_SYNC_RUNNING" ? 409 : 500);
    console.error(err);
    res.status(status).json({ message: err?.message || "Fishbowl inventory sync failed" });
  }
});

export default router;

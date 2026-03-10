import SyncRun from "../../models/SyncRun.js";
import upsertProductFromFishbowl from "./upsertProductFromFishbowl.js";

export async function runFishbowlProductImport(products = []) {
  const syncRun = await SyncRun.create({
    jobType: "fishbowl-products",
    status: "running",
    startedAt: new Date(),
    stats: {
      found: Array.isArray(products) ? products.length : 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    errors: [],
    notes: "Manual/test bulk Fishbowl product import run",
  });

  try {
    if (!Array.isArray(products)) {
      throw new Error("Products payload must be an array");
    }

    for (const item of products) {
      try {
        const result = await upsertProductFromFishbowl(item);

        if (result.action === "created") {
          syncRun.stats.created += 1;
        } else if (result.action === "updated") {
          syncRun.stats.updated += 1;
        } else {
          syncRun.stats.skipped += 1;
        }
      } catch (error) {
        syncRun.stats.failed += 1;
        syncRun.errors.push({
          key:
            item?.partId ||
            item?.partNum ||
            item?.sku ||
            "unknown-product",
          message: error.message,
          payload: item,
        });
      }
    }

    syncRun.status = syncRun.stats.failed > 0 ? "partial" : "success";
    syncRun.finishedAt = new Date();
    await syncRun.save();

    return syncRun;
  } catch (error) {
    syncRun.status = "failed";
    syncRun.finishedAt = new Date();
    syncRun.errors.push({
      key: "sync-run",
      message: error.message,
      payload: null,
    });
    await syncRun.save();
    throw error;
  }
}

export default runFishbowlProductImport;
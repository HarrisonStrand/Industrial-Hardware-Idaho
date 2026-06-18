import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import SyncRun from "../../models/SyncRun.js";
import { fishbowlClient } from "../../integrations/fishbowl/fishbowlClient.js";

let activeSyncPromise = null;
let activeSyncState = null;

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePartNumber(value = "") {
  return clean(value).toUpperCase();
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value).replace(/,/g, "").trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : fallback;
}

function getByPath(obj, path = "") {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function appendQuery(path, params = {}) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);

  if (!entries.length) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${entries.join("&")}`;
}

function getResultsArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function isLikelyMorePages({ data, rows, pageNumber, pageSize, pageLimit }) {
  if (pageLimit > 0 && pageNumber >= pageLimit) return false;

  const totalPages = asNumber(data?.totalPages, null);
  if (totalPages !== null) return pageNumber < totalPages;

  const totalCount = asNumber(data?.totalCount, null);
  if (totalCount !== null) return pageNumber * pageSize < totalCount;

  return rows.length >= pageSize;
}

function buildInventorySnapshot({ quantity, existingInventory }) {
  const existing = existingInventory?.toObject?.() || existingInventory || {};
  return {
    ...existing,
    qtyOnHand: quantity,
    qtyAvailable: quantity,
    qtyAllocated: asNumber(existing.qtyAllocated, 0) ?? 0,
    qtyOnOrder: asNumber(existing.qtyOnOrder, 0) ?? 0,
    lastSyncedAt: new Date(),
  };
}

function inventoryChanged(product, nextInventory) {
  const before = product?.inventory || {};
  return (
    asNumber(before.qtyOnHand, 0) !== nextInventory.qtyOnHand ||
    asNumber(before.qtyAvailable, 0) !== nextInventory.qtyAvailable ||
    asNumber(before.qtyAllocated, 0) !== nextInventory.qtyAllocated ||
    asNumber(before.qtyOnOrder, 0) !== nextInventory.qtyOnOrder
  );
}

async function fetchFishbowlInventoryMap({
  inventoryPath = "/api/parts/inventory",
  pageSize = 100,
  pageLimit = 0,
  partField = "partNumber",
  qtyField = "quantity",
  samples = false,
}) {
  const inventoryByPartNumber = new Map();
  const sampleRows = [];

  const summary = {
    pagesRequested: 0,
    pagesFailed: 0,
    rowsFetched: 0,
    rowsMapped: 0,
    rowsWithoutPartNumber: 0,
    rowsWithoutQuantity: 0,
    duplicatePartRows: 0,
  };

  for (let pageNumber = 1; ; pageNumber += 1) {
    const path = appendQuery(inventoryPath, { pageNumber, pageSize });
    summary.pagesRequested += 1;

    const resp = await fishbowlClient.request({ method: "GET", path });
    if (!resp.ok) {
      summary.pagesFailed += 1;
      throw new Error(
        `Fishbowl inventory page request failed (${resp.status}) for ${path}: ${JSON.stringify(
          resp.data || resp.error || {},
        )}`,
      );
    }

    const rows = getResultsArray(resp.data);
    summary.rowsFetched += rows.length;

    for (const row of rows) {
      const partNumberRaw = getByPath(row, partField) ?? row.partNumber ?? row.number;
      const partNumber = normalizePartNumber(partNumberRaw);
      if (!partNumber) {
        summary.rowsWithoutPartNumber += 1;
        continue;
      }

      const quantity = asNumber(getByPath(row, qtyField) ?? row.quantity, null);
      if (quantity === null) {
        summary.rowsWithoutQuantity += 1;
        continue;
      }

      const existing = inventoryByPartNumber.get(partNumber);
      if (existing) {
        summary.duplicatePartRows += 1;
        existing.quantity += quantity;
        existing.rows.push(row);
      } else {
        inventoryByPartNumber.set(partNumber, {
          partNumber,
          quantity,
          rows: [row],
        });
        summary.rowsMapped += 1;
      }

      if (samples && sampleRows.length < 10) {
        sampleRows.push({
          partNumber,
          quantity,
          partDescription: row.partDescription || row.description || "",
        });
      }
    }

    if (!isLikelyMorePages({ data: resp.data, rows, pageNumber, pageSize, pageLimit })) break;
  }

  return { inventoryByPartNumber, summary, sampleRows };
}

async function getTargetProducts({ limit = 0, partNumber = "", category = "bolts" }) {
  if (partNumber) {
    const normalized = normalizePartNumber(partNumber);
    const exactRegex = new RegExp(`^${escapeRegex(normalized)}$`, "i");
    return Product.find({
      isActive: { $ne: false },
      $or: [
        { "fishbowl.partNum": exactRegex },
        { sku: exactRegex },
        { internalPartNumber: exactRegex },
      ],
    }).sort({ "fishbowl.partNum": 1, sku: 1 });
  }

  const enrichmentQuery = {
    category: new RegExp(`^${escapeRegex(category)}$`, "i"),
    "attributes.familyType": { $exists: true, $ne: "" },
  };

  const enrichments = await ProductEnrichment.find(enrichmentQuery)
    .select({ productId: 1 })
    .lean();

  const ids = [...new Set(enrichments.map((item) => String(item.productId)).filter(Boolean))];
  let query = Product.find({ _id: { $in: ids }, isActive: { $ne: false } }).sort({
    "fishbowl.partNum": 1,
    sku: 1,
  });
  if (limit > 0) query = query.limit(limit);
  return query;
}

function createAlreadyRunningError() {
  const err = new Error("Fishbowl inventory sync is already running.");
  err.code = "FISHBOWL_INVENTORY_SYNC_RUNNING";
  err.status = 409;
  return err;
}

async function createRunDocument({ dryRun, triggeredBy, options }) {
  return SyncRun.create({
    jobType: "fishbowl-inventory",
    status: "running",
    startedAt: new Date(),
    stats: {
      found: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    metadata: {
      dryRun,
      triggeredBy,
      options,
    },
    notes: `Fishbowl inventory sync started by ${triggeredBy || "unknown"}`,
  });
}

async function finishRunDocument(runDoc, { status, result, error }) {
  if (!runDoc) return;

  runDoc.status = status;
  runDoc.finishedAt = new Date();
  runDoc.durationMs = runDoc.finishedAt.getTime() - new Date(runDoc.startedAt).getTime();

  if (result) {
    const syncSummary = result.syncSummary || {};
    const inventorySummary = result.inventorySummary || {};

    runDoc.stats = {
      found: Number(syncSummary.targetProducts || 0),
      created: 0,
      updated: Number(syncSummary.updated || 0),
      skipped:
        Number(syncSummary.unchanged || 0) +
        Number(syncSummary.noInventoryRow || 0) +
        Number(syncSummary.noPartIdentifier || 0),
      failed: Number(inventorySummary.pagesFailed || 0),
    };

    runDoc.metadata = {
      ...(runDoc.metadata?.toObject?.() || runDoc.metadata || {}),
      ...result,
    };

    runDoc.notes = JSON.stringify({
      inventorySummary: result.inventorySummary,
      syncSummary: result.syncSummary,
      uniqueMappedPartNumbers: result.uniqueMappedPartNumbers,
    });
  }

  if (error) {
    runDoc.errors = [
      ...(runDoc.errors || []),
      {
        key: "fishbowl-inventory-sync",
        message: error?.message || "Fishbowl inventory sync failed",
      },
    ];
    runDoc.notes = error?.message || "Fishbowl inventory sync failed";
  }

  await runDoc.save();
}

async function runFishbowlInventoryMapSyncInternal({
  dryRun = false,
  samples = false,
  setMissingZero = false,
  limit = 0,
  inventoryPageSize = 100,
  inventoryPageLimit = 0,
  inventoryPath = "/api/parts/inventory",
  partField = "partNumber",
  qtyField = "quantity",
  category = "bolts",
  partNumber = "",
  triggeredBy = "manual",
  persistRun = true,
} = {}) {
  const startedAt = new Date();
  const options = {
    dryRun,
    samples,
    setMissingZero,
    limit,
    inventoryPageSize,
    inventoryPageLimit,
    inventoryPath,
    partField,
    qtyField,
    category,
    partNumber,
  };

  const runDoc = persistRun
    ? await createRunDocument({ dryRun, triggeredBy, options })
    : null;

  try {
    const { inventoryByPartNumber, summary: inventorySummary, sampleRows: inventorySamples } =
      await fetchFishbowlInventoryMap({
        inventoryPath,
        pageSize: inventoryPageSize,
        pageLimit: inventoryPageLimit,
        partField,
        qtyField,
        samples,
      });

    const products = await getTargetProducts({ limit, partNumber, category });

    const syncSummary = {
      targetCategory: partNumber ? "single-part" : category,
      requestedPart: partNumber || null,
      targetProducts: products.length,
      checked: 0,
      updated: 0,
      wouldUpdate: 0,
      unchanged: 0,
      noPartIdentifier: 0,
      noInventoryRow: 0,
      setMissingZero: 0,
    };

    const syncSamples = [];

    for (const product of products) {
      const productPartNumber = clean(
        product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "",
      );
      const normalizedPartNumber = normalizePartNumber(productPartNumber);

      if (!normalizedPartNumber) {
        syncSummary.noPartIdentifier += 1;
        continue;
      }

      syncSummary.checked += 1;
      const inventoryMatch = inventoryByPartNumber.get(normalizedPartNumber);

      if (!inventoryMatch && !setMissingZero) {
        syncSummary.noInventoryRow += 1;
        if (samples && syncSamples.length < 30) {
          syncSamples.push({
            partNumber: productPartNumber,
            issue: "no inventory row returned by Fishbowl",
            current: {
              qtyOnHand: asNumber(product?.inventory?.qtyOnHand, 0),
              qtyAvailable: asNumber(product?.inventory?.qtyAvailable, 0),
            },
          });
        }
        continue;
      }

      const quantity = inventoryMatch ? inventoryMatch.quantity : 0;
      const nextInventory = buildInventorySnapshot({
        quantity,
        existingInventory: product.inventory,
      });
      const changed = inventoryChanged(product, nextInventory);

      if (!changed) {
        syncSummary.unchanged += 1;
        continue;
      }

      const sample = {
        partNumber: productPartNumber,
        before: {
          qtyOnHand: asNumber(product?.inventory?.qtyOnHand, 0),
          qtyAvailable: asNumber(product?.inventory?.qtyAvailable, 0),
          qtyAllocated: asNumber(product?.inventory?.qtyAllocated, 0),
          qtyOnOrder: asNumber(product?.inventory?.qtyOnOrder, 0),
        },
        after: {
          qtyOnHand: nextInventory.qtyOnHand,
          qtyAvailable: nextInventory.qtyAvailable,
          qtyAllocated: nextInventory.qtyAllocated,
          qtyOnOrder: nextInventory.qtyOnOrder,
        },
        source: inventoryMatch
          ? {
              partNumber: inventoryMatch.partNumber,
              quantity: inventoryMatch.quantity,
              rowCount: inventoryMatch.rows.length,
            }
          : { missingInventoryRow: true, quantity: 0 },
      };

      if (samples && syncSamples.length < 30) syncSamples.push(sample);

      if (dryRun) {
        if (!inventoryMatch) syncSummary.setMissingZero += 1;
        syncSummary.wouldUpdate += 1;
        continue;
      }

      product.inventory = nextInventory;
      await product.save();

      if (!inventoryMatch) syncSummary.setMissingZero += 1;
      syncSummary.updated += 1;
    }

    const finishedAt = new Date();
    const result = {
      ok: true,
      dryRun,
      setMissingZero,
      triggeredBy,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      inventoryPath,
      inventorySummary,
      uniqueMappedPartNumbers: inventoryByPartNumber.size,
      inventorySamples,
      syncSummary,
      syncSamples,
    };

    await finishRunDocument(runDoc, { status: "success", result });
    return result;
  } catch (error) {
    await finishRunDocument(runDoc, { status: "failed", error });
    throw error;
  }
}

export function getFishbowlInventorySyncRuntimeState() {
  return {
    running: Boolean(activeSyncPromise),
    startedAt: activeSyncState?.startedAt || null,
    triggeredBy: activeSyncState?.triggeredBy || null,
  };
}

export async function runFishbowlInventoryMapSync(options = {}) {
  if (activeSyncPromise && !options.allowConcurrent) {
    throw createAlreadyRunningError();
  }

  activeSyncState = {
    startedAt: new Date(),
    triggeredBy: options.triggeredBy || "manual",
  };

  activeSyncPromise = runFishbowlInventoryMapSyncInternal(options);

  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
    activeSyncState = null;
  }
}

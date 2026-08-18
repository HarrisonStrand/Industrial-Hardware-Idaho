import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import SyncRun from "../../models/SyncRun.js";
import { fishbowlClient } from "../../integrations/fishbowl/fishbowlClient.js";

let activeSyncPromise = null;
let activeSyncState = null;

function setActiveSyncProgress(patch = {}) {
  if (!activeSyncState) return;

  activeSyncState = {
    ...activeSyncState,
    ...patch,
  };

  const processed = Math.max(0, Number(activeSyncState.processed || 0));
  const total = Math.max(0, Number(activeSyncState.total || 0));

  activeSyncState.percent =
    total > 0 ? Math.max(0, Math.min(100, Math.round((processed / total) * 100))) : 0;
}

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

function clampInt(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(num)));
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
  pageSize = 1000,
  pageLimit = 0,
  partField = "partNumber",
  qtyField = "quantity",
  samples = false,
}) {
  const inventoryByPartNumber = new Map();
  const sampleRows = [];

  const summary = {
    pageSizeUsed: pageSize,
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
      const err = new Error(
        `Fishbowl inventory page request failed (${resp.status}) for ${path}: ${JSON.stringify(
          resp.data || resp.error || {},
        )}`,
      );
      err.status = resp.status;
      err.pageNumber = pageNumber;
      err.pageSize = pageSize;
      throw err;
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
        existing.rowCount += 1;
      } else {
        inventoryByPartNumber.set(partNumber, {
          partNumber,
          quantity,
          rowCount: 1,
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

async function fetchFishbowlInventoryMapAdaptive({
  requestedPageSize = 1000,
  ...options
} = {}) {
  const requested = clampInt(requestedPageSize, 1000, 100, 5000);
  const candidateSizes = [...new Set([requested, 1000, 500, 250, 100])]
    .filter((value) => value <= requested || value === requested)
    .sort((a, b) => b - a);

  let lastError = null;

  for (const pageSize of candidateSizes) {
    try {
      const result = await fetchFishbowlInventoryMap({
        ...options,
        pageSize,
      });
      result.summary.pageSizeUsed = pageSize;
      return result;
    } catch (error) {
      lastError = error;

      // A failure after page 1 usually means the endpoint itself became unstable
      // mid-scan; repeating all prior pages at smaller sizes would waste time.
      if (Number(error?.pageNumber || 1) > 1) break;

      console.warn(
        `⚠️ Fishbowl inventory pageSize=${pageSize} failed on the first page; trying a smaller page size.`,
      );
    }
  }

  throw lastError || new Error("Fishbowl bulk inventory request failed");
}

async function fetchFishbowlInventoryForProducts({
  products = [],
  inventoryPath = "/api/parts/inventory",
  samples = false,
  concurrency = 10,
  perPartPageSize = 250,
  onProgress = null,
}) {
  const inventoryByPartNumber = new Map();
  const sampleRows = [];

  const summary = {
    mode: "per-part-fallback",
    pagesRequested: 0,
    pagesFailed: 0,
    rowsFetched: 0,
    rowsMapped: 0,
    rowsWithoutPartNumber: 0,
    rowsWithoutQuantity: 0,
    duplicatePartRows: 0,
    productsRequested: 0,
    productsSucceeded: 0,
    productsFailed: 0,
  };

  const targetMap = new Map();
  for (const product of products) {
    const partNumber = clean(
      product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "",
    );
    const normalized = normalizePartNumber(partNumber);
    if (!normalized || targetMap.has(normalized)) continue;
    targetMap.set(normalized, partNumber);
  }

  const targets = Array.from(targetMap.values());
  const safePerPartPageSize = clampInt(perPartPageSize, 250, 50, 1000);

  let cursor = 0;
  let completedTargets = 0;
  const workerCount = clampInt(concurrency, 10, 1, 20);
  summary.uniqueProductsRequested = targets.length;

  async function fetchOne(partNumber) {
    const normalizedRequested = normalizePartNumber(partNumber);
    summary.productsRequested += 1;

    try {
      for (let pageNumber = 1; ; pageNumber += 1) {
        const path = appendQuery(inventoryPath, {
          number: partNumber,
          pageNumber,
          pageSize: safePerPartPageSize,
        });

        summary.pagesRequested += 1;
        const resp = await fishbowlClient.request({ method: "GET", path });

        if (!resp.ok) {
          summary.pagesFailed += 1;
          summary.productsFailed += 1;
          return;
        }

        const rows = getResultsArray(resp.data);
        summary.rowsFetched += rows.length;

        for (const row of rows) {
          const partNumberRaw = row?.partNumber ?? row?.number ?? partNumber;
          const normalizedPart = normalizePartNumber(partNumberRaw);
          if (!normalizedPart) {
            summary.rowsWithoutPartNumber += 1;
            continue;
          }

          const quantity = asNumber(row?.quantity, null);
          if (quantity === null) {
            summary.rowsWithoutQuantity += 1;
            continue;
          }

          const key = normalizedPart || normalizedRequested;
          const existing = inventoryByPartNumber.get(key);
          if (existing) {
            summary.duplicatePartRows += 1;
            existing.quantity += quantity;
            existing.rowCount += 1;
          } else {
            inventoryByPartNumber.set(key, {
              partNumber: key,
              quantity,
              rowCount: 1,
            });
            summary.rowsMapped += 1;
          }

          if (samples && sampleRows.length < 10) {
            sampleRows.push({
              partNumber: key,
              quantity,
              partDescription: row?.partDescription || row?.description || "",
            });
          }
        }

        if (!isLikelyMorePages({
          data: resp.data,
          rows,
          pageNumber,
          pageSize: safePerPartPageSize,
          pageLimit: 0,
        })) {
          break;
        }
      }

      summary.productsSucceeded += 1;
    } catch {
      summary.productsFailed += 1;
      summary.pagesFailed += 1;
    }
  }

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= targets.length) return;
      await fetchOne(targets[index]);
      completedTargets += 1;

      if (typeof onProgress === "function") {
        onProgress({
          processed: completedTargets,
          total: targets.length,
          succeeded: summary.productsSucceeded,
          failed: summary.productsFailed,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (summary.productsRequested > 0 && summary.productsSucceeded === 0 && summary.productsFailed > 0) {
    throw new Error(
      `Fishbowl per-part inventory fallback failed for all ${summary.productsRequested} requested products.`,
    );
  }

  return { inventoryByPartNumber, summary, sampleRows };
}

async function getTargetProducts({
  limit = 0,
  partNumber = "",
  category = "all",
  subcategory = "",
  familyType = "",
}) {
  const projection = {
    _id: 1,
    sku: 1,
    internalPartNumber: 1,
    "fishbowl.partNum": 1,
    inventory: 1,
  };

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
    })
      .select(projection)
      .lean();
  }

  const normalizedCategory = clean(category).toLowerCase();
  const normalizedSubcategory = clean(subcategory);
  const normalizedFamilyType = clean(familyType);

  let query;

  if ((!normalizedCategory || normalizedCategory === "all") && !normalizedSubcategory && !normalizedFamilyType) {
    // Fast path for a whole-catalog sync: avoid reading ProductEnrichment at all.
    query = Product.find({ isActive: { $ne: false } }).select(projection).lean();
  } else {
    const enrichmentQuery = {
      "attributes.familyType": { $exists: true, $ne: "" },
    };

    if (normalizedCategory && normalizedCategory !== "all") {
      enrichmentQuery.category = new RegExp(`^${escapeRegex(category)}$`, "i");
    }
    if (normalizedSubcategory) {
      enrichmentQuery.subcategory = new RegExp(`^${escapeRegex(normalizedSubcategory)}$`, "i");
    }
    if (normalizedFamilyType) {
      enrichmentQuery["attributes.familyType"] = new RegExp(
        `^${escapeRegex(normalizedFamilyType)}$`,
        "i",
      );
    }

    const ids = await ProductEnrichment.distinct("productId", enrichmentQuery);
    query = Product.find({
      _id: { $in: ids },
      isActive: { $ne: false },
    })
      .select(projection)
      .lean();
  }

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
  inventoryPageSize = 1000,
  inventoryPageLimit = 0,
  inventoryPath = "/api/parts/inventory",
  partField = "partNumber",
  qtyField = "quantity",
  category = "all",
  subcategory = "",
  familyType = "",
  partNumber = "",
  fallbackConcurrency = Number(process.env.FISHBOWL_INVENTORY_CONCURRENCY || 10),
  perPartPageSize = 250,
  writeBatchSize = 500,
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
    subcategory,
    familyType,
    partNumber,
    fallbackConcurrency,
    perPartPageSize,
    writeBatchSize,
  };

  const runDoc = persistRun
    ? await createRunDocument({ dryRun, triggeredBy, options })
    : null;

  try {
    setActiveSyncProgress({
      phase: "loading-products",
      phaseLabel: "Loading products to check",
      processed: 0,
      total: 0,
      updated: 0,
      failed: 0,
      strategy: "",
    });

    const products = await getTargetProducts({
      limit,
      partNumber,
      category,
      subcategory,
      familyType,
    });

    setActiveSyncProgress({
      phase: "fetching-inventory",
      phaseLabel: "Reading quantities from Fishbowl",
      processed: 0,
      total: products.length,
    });

    let inventoryResult;
    let bulkFetchError = null;

    try {
      inventoryResult = await fetchFishbowlInventoryMapAdaptive({
        inventoryPath,
        requestedPageSize: inventoryPageSize,
        pageLimit: inventoryPageLimit,
        partField,
        qtyField,
        samples,
      });
      inventoryResult.summary.mode = "bulk-map";
      setActiveSyncProgress({
        strategy: "bulk-map",
        phaseLabel: "Fishbowl inventory loaded",
      });
    } catch (error) {
      bulkFetchError = error;
      console.warn(
        "⚠️ Fishbowl bulk inventory request failed; falling back to part-number queries:",
        error?.message || error,
      );

      setActiveSyncProgress({
        strategy: "per-part-fallback",
        phase: "fetching-inventory",
        phaseLabel: "Scanning Fishbowl quantities",
        processed: 0,
        total: products.length,
        failed: 0,
      });

      inventoryResult = await fetchFishbowlInventoryForProducts({
        products,
        inventoryPath,
        samples,
        concurrency: fallbackConcurrency,
        perPartPageSize,
        onProgress: ({ processed, total, failed }) => {
          setActiveSyncProgress({
            phase: "fetching-inventory",
            phaseLabel: "Scanning Fishbowl quantities",
            processed,
            total,
            failed,
          });
        },
      });
      inventoryResult.summary.fallbackReason = error?.message || "Bulk inventory request failed";
    }

    const {
      inventoryByPartNumber,
      summary: inventorySummary,
      sampleRows: inventorySamples,
    } = inventoryResult;

    const syncSummary = {
      targetCategory: partNumber ? "single-part" : category,
      targetSubcategory: partNumber ? null : subcategory || null,
      targetFamilyType: partNumber ? null : familyType || null,
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

    setActiveSyncProgress({
      phase: "updating-products",
      phaseLabel: dryRun ? "Comparing website quantities" : "Updating website quantities",
      processed: 0,
      total: products.length,
      updated: 0,
      failed: Number(inventorySummary?.productsFailed || inventorySummary?.pagesFailed || 0),
    });

    let processedProducts = 0;
    const safeWriteBatchSize = clampInt(writeBatchSize, 500, 50, 2000);
    let pendingWrites = [];

    const flushPendingWrites = async () => {
      if (dryRun || pendingWrites.length === 0) return;

      const batch = pendingWrites;
      pendingWrites = [];
      await Product.bulkWrite(batch, { ordered: false });
      syncSummary.updated += batch.length;

      setActiveSyncProgress({
        phase: "updating-products",
        phaseLabel: "Updating website quantities",
        processed: processedProducts,
        total: products.length,
        updated: syncSummary.updated,
      });
    };

    const advanceProductProgress = () => {
      processedProducts += 1;
      setActiveSyncProgress({
        phase: "updating-products",
        phaseLabel: dryRun ? "Comparing website quantities" : "Updating website quantities",
        processed: processedProducts,
        total: products.length,
        updated: dryRun ? syncSummary.wouldUpdate : syncSummary.updated,
      });
    };

    for (const product of products) {
      const productPartNumber = clean(
        product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "",
      );
      const normalizedPartNumber = normalizePartNumber(productPartNumber);

      if (!normalizedPartNumber) {
        syncSummary.noPartIdentifier += 1;
        advanceProductProgress();
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
        advanceProductProgress();
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
        advanceProductProgress();
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
              rowCount: Number(inventoryMatch.rowCount || 1),
            }
          : { missingInventoryRow: true, quantity: 0 },
      };

      if (samples && syncSamples.length < 30) syncSamples.push(sample);

      if (dryRun) {
        if (!inventoryMatch) syncSummary.setMissingZero += 1;
        syncSummary.wouldUpdate += 1;
        advanceProductProgress();
        continue;
      }

      pendingWrites.push({
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              inventory: nextInventory,
              updatedAt: new Date(),
            },
          },
        },
      });

      if (!inventoryMatch) syncSummary.setMissingZero += 1;
      advanceProductProgress();

      if (pendingWrites.length >= safeWriteBatchSize) {
        await flushPendingWrites();
      }
    }

    await flushPendingWrites();

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
      inventoryStrategy: inventorySummary?.mode || "bulk-map",
      performance: {
        inventoryPageSizeRequested: inventoryPageSize,
        inventoryPageSizeUsed: inventorySummary?.pageSizeUsed || null,
        fallbackConcurrency: clampInt(fallbackConcurrency, 10, 1, 20),
        writeBatchSize: clampInt(writeBatchSize, 500, 50, 2000),
      },
      bulkFetchError: bulkFetchError?.message || null,
      inventorySummary,
      uniqueMappedPartNumbers: inventoryByPartNumber.size,
      inventorySamples,
      syncSummary,
      syncSamples,
    };

    setActiveSyncProgress({
      phase: "finishing",
      phaseLabel: "Finishing quantity sync",
      processed: products.length,
      total: products.length,
      updated: dryRun ? syncSummary.wouldUpdate : syncSummary.updated,
      failed: Number(inventorySummary?.productsFailed || inventorySummary?.pagesFailed || 0),
    });

    const runStatus = Number(inventorySummary?.pagesFailed || 0) > 0 ? "partial" : "success";
    await finishRunDocument(runDoc, { status: runStatus, result });
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
    phase: activeSyncState?.phase || (activeSyncPromise ? "starting" : "idle"),
    phaseLabel: activeSyncState?.phaseLabel || (activeSyncPromise ? "Starting quantity sync" : ""),
    processed: Math.max(0, Number(activeSyncState?.processed || 0)),
    total: Math.max(0, Number(activeSyncState?.total || 0)),
    percent: Math.max(0, Math.min(100, Number(activeSyncState?.percent || 0))),
    updated: Math.max(0, Number(activeSyncState?.updated || 0)),
    failed: Math.max(0, Number(activeSyncState?.failed || 0)),
    strategy: activeSyncState?.strategy || "",
  };
}

export async function runFishbowlInventoryMapSync(options = {}) {
  if (activeSyncPromise && !options.allowConcurrent) {
    throw createAlreadyRunningError();
  }

  activeSyncState = {
    startedAt: new Date(),
    triggeredBy: options.triggeredBy || "manual",
    phase: "starting",
    phaseLabel: "Starting quantity sync",
    processed: 0,
    total: 0,
    percent: 0,
    updated: 0,
    failed: 0,
    strategy: "",
  };

  activeSyncPromise = runFishbowlInventoryMapSyncInternal(options);

  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
    activeSyncState = null;
  }
}

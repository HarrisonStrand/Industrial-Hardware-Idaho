import fs from "fs";
import { isStockDisplayEnabled } from "./stockDisplay.js";
import path from "path";
import { fileURLToPath } from "url";

import CatalogGlobalSetting from "../../models/CatalogGlobalSetting.js";
import CatalogSubcategorySetting from "../../models/CatalogSubcategorySetting.js";
import { isDraftPreview } from "./draftPreview.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATEGORIES_PATH = path.resolve(__dirname, "categories.json");
// Per-page layout plan: "<categoryId>/<subcategoryId>" ->
// { displayMode, fallbackMode }. Applied in draft preview only; at launch scripts/applyPageLayoutPlan.js writes it.
const PAGE_LAYOUT_PLAN_PATH = path.resolve(__dirname, "pageLayoutPlan.json");
const PLAN_DISPLAY_MODES = new Set(["builder", "product-grid"]);
const PLAN_FALLBACK_MODES = new Set(["product-grid", "range-list"]);

const DEFAULT_BUILDER_KEYS = new Set([
  "bolts/hex-cap-screws",
  "nuts/hex-nuts",
]);

// Categories whose new pages start visible (as a range list) instead of hidden.
// Auveco's pages were shown straight away (2026-10-13).
const DEFAULT_VISIBLE_CATEGORIES = new Set(["auveco"]);
// Single pages that start visible. The specialty washer pages were shown straight away
// because promoted, published washers moved onto them.
const DEFAULT_VISIBLE_KEYS = new Set([
  "washers/sealing-washers",
  "washers/square-plate-washers",
  "washers/belleville-wave-washers",
  "washers/specialty-washers",
  "wire-hardware/cotter-pins",
]);
// Categories whose pages start as a product grid instead of a range list. Brand pages hold
// many unlike items, which a range list would fold into one family. They still start hidden.
const DEFAULT_GRID_CATEGORIES = new Set(["makita", "diablo"]);
// Single pages of unlike items that start as a filterable product grid. They still start hidden.
const DEFAULT_GRID_KEYS = new Set([
  "chemicals-paints-sealants/tapes",
  "tools/ladders-scaffolding",
  "tools/shop-storage",
  "safety-ppe/gloves",
  "bits-drivers/burrs-deburring-tools",
]);

let cachedDefinitions = null;
let cachedLayoutPlan = null;

// The plan file, checked: only builder / product-grid display modes and a listing fallback are taken.
export function readPageLayoutPlan(filePath = PAGE_LAYOUT_PLAN_PATH) {
  if (filePath === PAGE_LAYOUT_PLAN_PATH && cachedLayoutPlan) return cachedLayoutPlan;
  let plan = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    for (const [key, entry] of Object.entries(parsed || {})) {
      const [categoryId, subcategoryId] = String(key).split("/");
      if (!categoryId || !subcategoryId) continue;
      if (!PLAN_DISPLAY_MODES.has(entry?.displayMode)) continue;
      plan[`${normalizeCatalogId(categoryId)}/${normalizeCatalogId(subcategoryId)}`] = {
        displayMode: entry.displayMode,
        fallbackMode: PLAN_FALLBACK_MODES.has(entry?.fallbackMode) ? entry.fallbackMode : "product-grid",
      };
    }
  } catch (error) {
    console.error("Failed to read the page layout plan:", error);
    plan = {};
  }
  if (filePath === PAGE_LAYOUT_PLAN_PATH) cachedLayoutPlan = plan;
  return plan;
}

// Draft preview only: the plan's displayMode and fallbackMode over a stored (or default) layout setting.
export function applyLayoutPlan(setting = {}, plan = readPageLayoutPlan()) {
  const entry = plan[`${setting.categoryId}/${setting.subcategoryId}`];
  if (!entry) return setting;
  return { ...setting, displayMode: entry.displayMode, fallbackMode: entry.fallbackMode };
}
let ensurePromise = null;
let layoutRecordsEnsured = false;

export function normalizeCatalogId(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readCategoryDefinitions() {
  if (cachedDefinitions) return cachedDefinitions;

  try {
    const raw = fs.readFileSync(CATEGORIES_PATH, "utf8");
    const parsed = JSON.parse(raw);

    cachedDefinitions = (parsed?.categories || []).flatMap((category, categoryIndex) =>
      (category?.subcategories || []).map((subcategory, subcategoryIndex) => ({
        categoryId: normalizeCatalogId(category?.id || category?.name),
        categoryName: category?.name || category?.id || "",
        subcategoryId: normalizeCatalogId(subcategory?.id || subcategory?.name),
        displayName: subcategory?.name || subcategory?.id || "",
        imageUrl: subcategory?.image || category?.image || "",
        filters: Array.isArray(subcategory?.filters) ? subcategory.filters : [],
        sortOrder: categoryIndex * 1000 + subcategoryIndex,
      }))
    );
  } catch (error) {
    console.error("Failed to read catalog category definitions:", error);
    cachedDefinitions = [];
  }

  return cachedDefinitions;
}

export function getKnownCatalogSubcategories() {
  return readCategoryDefinitions();
}

// Extra attribute filters a product-grid page offers, from "filters" in categories.json:
// [{ key, label, sort }] where sort "size" orders fractions and mm sizes by value.
export function getCatalogPageFilters(categoryId, subcategoryId) {
  const categoryKey = normalizeCatalogId(categoryId);
  const subcategoryKey = normalizeCatalogId(subcategoryId);
  const definition = readCategoryDefinitions().find(
    (item) => item.categoryId === categoryKey && item.subcategoryId === subcategoryKey
  );

  return (definition?.filters || [])
    .filter((filter) => filter && typeof filter.key === "string" && filter.key)
    .map((filter) => ({
      key: filter.key,
      label: filter.label || filter.key,
      sort: filter.sort || "",
    }));
}

export function getDefaultSubcategorySetting(definition = {}) {
  const categoryId = normalizeCatalogId(definition.categoryId);
  const subcategoryId = normalizeCatalogId(definition.subcategoryId);
  const key = `${categoryId}/${subcategoryId}`;
  const isInitialBuilder = DEFAULT_BUILDER_KEYS.has(key);
  const isInitialGrid = DEFAULT_GRID_CATEGORIES.has(categoryId) || DEFAULT_GRID_KEYS.has(key);

  return {
    categoryId,
    categoryName: definition.categoryName || "",
    subcategoryId,
    displayName: definition.displayName || "",
    displayMode: isInitialBuilder ? "builder" : isInitialGrid ? "product-grid" : "range-list",
    fallbackMode: "range-list",
    rangeDataSource: "ready",
    isVisible: isInitialBuilder || DEFAULT_VISIBLE_CATEGORIES.has(categoryId) || DEFAULT_VISIBLE_KEYS.has(key),
    showPricing: true,
    allowCart: isInitialBuilder,
    image: {
      url: definition.imageUrl || "",
      alt: definition.displayName || "",
    },
    introText: "",
    contactMessage:
      "Contact Industrial Hardware Idaho for current availability, pricing, and sizes not shown.",
    primaryAction: isInitialBuilder ? "shop" : "contact",
    sortOrder: Number(definition.sortOrder || 0),
    adminNotes: "",
  };
}

export async function ensureCatalogLayoutRecords() {
  if (layoutRecordsEnsured) return;
  // Draft preview is read-only: missing layout records are filled in memory instead (previewLayoutSettings).
  if (isDraftPreview()) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    const definitions = getKnownCatalogSubcategories();

    await Promise.all(
      definitions.map((definition) => {
        const defaults = getDefaultSubcategorySetting(definition);
        const {
          categoryName,
          sortOrder,
          ...insertDefaults
        } = defaults;

        return CatalogSubcategorySetting.updateOne(
          {
            categoryId: defaults.categoryId,
            subcategoryId: defaults.subcategoryId,
          },
          {
            // Do not set the same paths in both $setOnInsert and $set.
            // MongoDB treats that as a conflicting update during an upsert.
            $setOnInsert: insertDefaults,
            $set: {
              categoryName,
              sortOrder,
            },
          },
          { upsert: true }
        );
      })
    );

    await CatalogGlobalSetting.updateOne(
      { key: "default" },
      {
        $setOnInsert: {
          key: "default",
          buildersEnabled: false,
          cartEnabled: false,
          checkoutEnabled: false,
        },
      },
      { upsert: true }
    );

    layoutRecordsEnsured = true;
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
}

export async function getCatalogGlobalSetting() {
  if (isDraftPreview()) {
    const doc = await CatalogGlobalSetting.findOne({ key: "default" }).lean();
    // The builder switch counts as on in preview, so the plan's builder pages show as builders.
    return {
      ...(doc || { key: "default", cartEnabled: false, checkoutEnabled: false }),
      buildersEnabled: true,
    };
  }

  await ensureCatalogLayoutRecords();

  return CatalogGlobalSetting.findOneAndUpdate(
    { key: "default" },
    {
      $setOnInsert: {
        key: "default",
        buildersEnabled: false,
        cartEnabled: false,
        checkoutEnabled: false,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

// Read-only lookup of the site switches. Missing record or field = off for cart and checkout,
// on for the stock display.
export async function getSiteSwitches() {
  const doc = await CatalogGlobalSetting.findOne({ key: "default" })
    .select("cartEnabled checkoutEnabled stockDisplayEnabled")
    .lean();

  return {
    cartEnabled: doc?.cartEnabled === true,
    checkoutEnabled: doc?.checkoutEnabled === true,
    stockDisplayEnabled: isStockDisplayEnabled(doc),
  };
}

export function resolveEffectiveCatalogMode(setting, globalSetting) {
  const requestedMode = setting?.displayMode || "coming-soon";

  if (
    requestedMode === "builder" &&
    globalSetting?.buildersEnabled === false
  ) {
    return setting?.fallbackMode || "range-list";
  }

  return requestedMode;
}

export async function getCatalogSubcategorySetting(categoryId, subcategoryId) {
  if (isDraftPreview()) {
    const key = `${normalizeCatalogId(categoryId)}/${normalizeCatalogId(subcategoryId)}`;
    return (await previewLayoutSettings()).find(
      (setting) => `${setting.categoryId}/${setting.subcategoryId}` === key
    ) || null;
  }

  await ensureCatalogLayoutRecords();

  return CatalogSubcategorySetting.findOne({
    categoryId: normalizeCatalogId(categoryId),
    subcategoryId: normalizeCatalogId(subcategoryId),
  });
}

// Draft preview only: every page shows to everyone, so a reviewer can review hidden and locked pages
// without logging in. A hidden or coming-soon page shows in its fallback mode when that lists products,
// otherwise as a range list. A fallback is also kept from falling back to hidden.
const PREVIEW_CLOSED_MODES = new Set(["hidden", "coming-soon"]);

export function revealForPreview(setting = {}) {
  const openFallback = PREVIEW_CLOSED_MODES.has(setting.fallbackMode) ? "range-list" : setting.fallbackMode || "range-list";
  const displayMode = PREVIEW_CLOSED_MODES.has(setting.displayMode) || !setting.displayMode
    ? openFallback
    : setting.displayMode;
  return { ...setting, displayMode, fallbackMode: openFallback, isVisible: true };
}

// Draft preview only: the stored layout records, plus defaults (in memory, never written) for pages in
// categories.json that have no record yet, with the page layout plan applied, all revealed. Same order as the public layout list.
export async function previewLayoutSettings() {
  const stored = await CatalogSubcategorySetting.find({}).lean();
  const keys = new Set(stored.map((setting) => `${setting.categoryId}/${setting.subcategoryId}`));
  const missing = getKnownCatalogSubcategories()
    .map((definition) => getDefaultSubcategorySetting(definition))
    .filter((setting) => !keys.has(`${setting.categoryId}/${setting.subcategoryId}`));

  const plan = readPageLayoutPlan();
  return [...stored, ...missing]
    .map((setting) => revealForPreview(applyLayoutPlan(setting, plan)))
    .sort(
      (a, b) =>
        Number(a.sortOrder || 0) - Number(b.sortOrder || 0) ||
        String(a.categoryName || "").localeCompare(String(b.categoryName || "")) ||
        String(a.displayName || "").localeCompare(String(b.displayName || ""))
    );
}

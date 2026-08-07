import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import CatalogGlobalSetting from "../../models/CatalogGlobalSetting.js";
import CatalogSubcategorySetting from "../../models/CatalogSubcategorySetting.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATEGORIES_PATH = path.resolve(__dirname, "categories.json");

const DEFAULT_BUILDER_KEYS = new Set([
  "bolts/hex-cap-screws",
  "nuts/hex-nuts",
]);

let cachedDefinitions = null;
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

export function getDefaultSubcategorySetting(definition = {}) {
  const categoryId = normalizeCatalogId(definition.categoryId);
  const subcategoryId = normalizeCatalogId(definition.subcategoryId);
  const key = `${categoryId}/${subcategoryId}`;
  const isInitialBuilder = DEFAULT_BUILDER_KEYS.has(key);

  return {
    categoryId,
    categoryName: definition.categoryName || "",
    subcategoryId,
    displayName: definition.displayName || "",
    displayMode: isInitialBuilder ? "builder" : "range-list",
    fallbackMode: "range-list",
    rangeDataSource: "ready",
    isVisible: isInitialBuilder,
    showPricing: false,
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
  await ensureCatalogLayoutRecords();

  return CatalogGlobalSetting.findOneAndUpdate(
    { key: "default" },
    {
      $setOnInsert: {
        key: "default",
        buildersEnabled: false,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
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
  await ensureCatalogLayoutRecords();

  return CatalogSubcategorySetting.findOne({
    categoryId: normalizeCatalogId(categoryId),
    subcategoryId: normalizeCatalogId(subcategoryId),
  });
}

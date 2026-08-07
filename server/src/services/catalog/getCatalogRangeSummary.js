import getCatalogBuilderSubcategory from "./getCatalogBuilderSubcategory.js";

const HIDDEN_ATTRIBUTE_KEYS = new Set([
  "fishbowlPartNum",
  "sku",
  "internalPartNumber",
  "familyKey",
  "familySlug",
  "familyTitle",
  "familyTitleBase",
  "familyType",
  "fastenerType",
  "fastenerTypeCanonical",
  "categoryCanonical",
  "subcategoryCanonical",
  "driveType",
  "headType",
  "head_type",
  "headDetail",
  "head_detail",
  "fishbowlDescription",
  "thread_series",
  "threadCoverage",
  "thread_coverage",
  "displayMaterial",
  "displayFinish",
  "material",
  "finish",
  "source",
  "sourceHash",
  "raw",
]);

const ATTRIBUTE_ORDER = [
  "measurementSystem",
  "productType",
  "washerStandard",
  "washerType",
  "headStandard",
  "headType",
  "drive_type",
  "diameter",
  "size",
  "width",
  "thickness",
  "threadSeries",
  "threadPitch",
  "thread",
  "length",
  "materialFinish",
  "grade",
];

// Dimensions are intentionally excluded from this identity. Range pages should
// group all available sizes under a concise product family instead of creating
// a separate row for every diameter or length.
const GENERAL_FAMILY_IDENTITY_KEYS = [
  "measurementSystem",
  "productType",
  "washerStandard",
  "washerType",
  "headStandard",
  "headType",
  "drive_type",
  "materialFinish",
  "grade",
];

function clean(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value = "") {
  return clean(value).toLowerCase();
}

function toTitle(value = "") {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortValues(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function cleanOptions(options = {}) {
  return Object.fromEntries(
    Object.entries(options || {})
      .map(([key, values]) => [
        key,
        sortValues(Array.isArray(values) ? values : []),
      ])
      .filter(([key, values]) => {
        return !HIDDEN_ATTRIBUTE_KEYS.has(key) && values.length > 0;
      })
      .sort(([a], [b]) => {
        const aIndex = ATTRIBUTE_ORDER.indexOf(a);
        const bIndex = ATTRIBUTE_ORDER.indexOf(b);

        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
  );
}

function getAllowedReviewStatuses(rangeDataSource = "ready") {
  if (rangeDataSource === "approved") return ["approved"];
  if (rangeDataSource === "ready") return ["ready", "approved"];
  return null;
}

function identityValue(attributes = {}, key = "") {
  if (key === "drive_type") {
    return clean(attributes.drive_type || attributes.driveType || "");
  }
  if (key === "headType") {
    return clean(attributes.headType || attributes.head_type || "");
  }
  return clean(attributes?.[key] || "");
}

function buildGeneralFamilyKey(attributes = {}, subcategoryId = "") {
  const values = GENERAL_FAMILY_IDENTITY_KEYS.map((key) =>
    normalize(identityValue(attributes, key))
  );

  return [normalize(subcategoryId), ...values].join("|");
}

function addAttributeOptions(target, attributes = {}) {
  for (const [key, rawValue] of Object.entries(attributes || {})) {
    if (HIDDEN_ATTRIBUTE_KEYS.has(key)) continue;

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      const cleaned = clean(value);
      if (!cleaned) continue;

      if (!target.has(key)) target.set(key, new Set());
      target.get(key).add(cleaned);
    }
  }
}

function baseContainsLabel(base = "", label = "") {
  const normalizedBase = normalize(base).replace(/s\b/g, "");
  const normalizedLabel = normalize(label).replace(/s\b/g, "");
  return normalizedLabel && normalizedBase.includes(normalizedLabel);
}

function buildGeneralFamilyTitle(attributes = {}, subcategoryId = "") {
  const base = toTitle(subcategoryId) || "Products";
  const system = identityValue(attributes, "measurementSystem");
  const labels = [
    system ? (/^imperial$/i.test(system) ? "Standard" : toTitle(system)) : "",
    identityValue(attributes, "productType"),
    identityValue(attributes, "washerStandard"),
    identityValue(attributes, "washerType"),
    identityValue(attributes, "headStandard"),
    identityValue(attributes, "headType"),
    identityValue(attributes, "drive_type"),
    identityValue(attributes, "grade"),
    identityValue(attributes, "materialFinish"),
  ]
    .map(toTitle)
    .filter(Boolean)
    .filter((value, index, list) => {
      if (baseContainsLabel(base, value)) return false;
      return list.findIndex((item) => normalize(item) === normalize(value)) === index;
    });

  return labels.length ? `${labels.join(" · ")} — ${base}` : base;
}

function buildGeneralizedFamilies(builderData = {}, subcategoryId = "") {
  const groups = new Map();

  for (const sourceFamily of builderData?.families || []) {
    for (const variant of sourceFamily?.variants || []) {
      const attributes = variant?.attributes || {};
      const groupKey = buildGeneralFamilyKey(attributes, subcategoryId);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          familyKey: groupKey,
          familySlug: "",
          familyTitle: buildGeneralFamilyTitle(attributes, subcategoryId),
          image: sourceFamily?.image || variant?.image || "",
          imageAlt:
            sourceFamily?.imageAlt ||
            sourceFamily?.familyTitle ||
            toTitle(subcategoryId),
          attributes: new Map(),
          variantKeys: new Set(),
        });
      }

      const group = groups.get(groupKey);
      addAttributeOptions(group.attributes, attributes);

      const variantKey =
        clean(variant?.productId || "") ||
        clean(variant?.partNumber || "") ||
        JSON.stringify(attributes);
      group.variantKeys.add(variantKey);

      if (!group.image && (sourceFamily?.image || variant?.image)) {
        group.image = sourceFamily?.image || variant?.image || "";
      }
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const attributes = cleanOptions(
        Object.fromEntries(
          Array.from(group.attributes.entries()).map(([key, values]) => [
            key,
            Array.from(values),
          ])
        )
      );
      const variantCount = group.variantKeys.size;
      const familySlug = slugify(group.familyTitle);

      return {
        familyKey: group.familyKey,
        familySlug,
        familyTitle: group.familyTitle,
        familyDescription: `${variantCount} cataloged size and configuration option${
          variantCount === 1 ? "" : "s"
        } represented in this range.`,
        image: group.image,
        imageAlt: group.imageAlt || group.familyTitle,
        variantCount,
        attributes,
      };
    })
    .filter((family) => family.variantCount > 0)
    .sort((a, b) =>
      String(a.familyTitle || "").localeCompare(
        String(b.familyTitle || ""),
        undefined,
        { numeric: true, sensitivity: "base" }
      )
    );
}

export default async function getCatalogRangeSummary(
  categoryId,
  subcategoryId,
  options = {}
) {
  const rangeDataSource = options.rangeDataSource || "ready";
  const allowedReviewStatuses = getAllowedReviewStatuses(rangeDataSource);

  const builderData = await getCatalogBuilderSubcategory(
    categoryId,
    subcategoryId,
    {
      includeUnpublished: true,
      includePricing: false,
      applyBuilderReadyFilter: false,
      allowedReviewStatuses,
      pricingContext: {
        approvedType: "RETAIL",
        approvalStatus: "NONE",
      },
    }
  );

  const families = buildGeneralizedFamilies(builderData, subcategoryId);

  return {
    categoryId: String(categoryId || ""),
    subcategoryId: String(subcategoryId || ""),
    name: builderData?.name || toTitle(subcategoryId),
    description: builderData?.description || "",
    image: builderData?.image || families.find((family) => family.image)?.image || "",
    rangeDataSource,
    attributes: cleanOptions(builderData?.attributes || {}),
    families,
    totals: {
      familyCount: families.length,
      variantCount: families.reduce(
        (sum, family) => sum + Number(family.variantCount || 0),
        0
      ),
      rawVariantCount: Number(builderData?.totals?.rawVariantCount || 0),
    },
  };
}

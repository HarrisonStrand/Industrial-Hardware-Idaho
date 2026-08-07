import { useMemo } from "react";
import { Link } from "react-router-dom";
import categoriesUI from "../../../data/categories.json";
import "./ProductRangeList.css";

const SYSTEMS = [
  {
    key: "standard",
    label: "Standard",
    subtitle: "Imperial sizes and configurations",
  },
  {
    key: "metric",
    label: "Metric",
    subtitle: "Metric sizes and configurations",
  },
];

const SPEC_GROUPS = [
  {
    key: "types",
    label: "Product Types",
    keys: ["productType", "washerType"],
  },
  {
    key: "diameters",
    label: "Diameters / Sizes",
    keys: ["diameter", "size"],
    dimension: true,
  },
  {
    key: "lengths",
    label: "Lengths",
    keys: ["length"],
    dimension: true,
  },
  {
    key: "widths",
    label: "Widths / Thicknesses",
    keys: ["width", "thickness"],
    dimension: true,
  },
  {
    key: "threads",
    label: "Thread Options",
    keys: ["threadSeries", "threadPitch", "thread"],
  },
  {
    key: "grades",
    label: "Grades",
    keys: ["grade"],
  },
  {
    key: "materials",
    label: "Materials / Finishes",
    keys: ["materialFinish"],
  },
  {
    key: "standards",
    label: "Standards / Styles",
    keys: ["washerStandard", "headStandard", "drive_type"],
  },
];

function actionConfig(action = "contact") {
  if (action === "quote") {
    return { to: "/requests", label: "Request a Quote" };
  }
  if (action === "parts-list") {
    return { to: "/requests", label: "Send a Parts List" };
  }
  if (action === "shop") {
    return { to: "/contact", label: "Check Availability" };
  }
  if (action === "none") return null;
  return { to: "/contact", label: "Contact Us" };
}

function clean(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCatalogId(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findGeneralSubcategory(categoryId = "", subcategoryId = "") {
  const targetCategory = normalizeCatalogId(categoryId);
  const targetSubcategory = normalizeCatalogId(subcategoryId);

  for (const category of categoriesUI?.categories || []) {
    if (normalizeCatalogId(category?.id || category?.name) !== targetCategory) {
      continue;
    }

    const subcategory = (category?.subcategories || []).find((item) => {
      return normalizeCatalogId(item?.id || item?.name) === targetSubcategory;
    });

    if (subcategory) return subcategory;
  }

  return null;
}

function formatValue(value = "") {
  const raw = clean(value);
  if (!raw) return "";
  if (/^imperial$/i.test(raw)) return "Standard";
  if (/^metric$/i.test(raw)) return "Metric";

  return raw.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function parseFraction(value = "") {
  const raw = clean(value)
    .replace(/["″]/g, "")
    .replace(/\s*mm$/i, "")
    .replace(/^m(?=\d)/i, "")
    .replace(/-/g, " ");

  if (!raw || /^#/.test(raw)) return null;

  const mixedMatch = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const numerator = Number(mixedMatch[2]);
    const denominator = Number(mixedMatch[3]);
    return denominator ? whole + numerator / denominator : null;
  }

  const fractionMatch = raw.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    return denominator ? numerator / denominator : null;
  }

  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  return null;
}

function sortValues(values = [], dimension = false) {
  const unique = [...new Set(values.map(formatValue).filter(Boolean))];

  return unique.sort((a, b) => {
    if (dimension) {
      const aNumber = parseFraction(a);
      const bNumber = parseFraction(b);

      if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
        return aNumber - bNumber;
      }
      if (aNumber !== null && bNumber === null) return -1;
      if (aNumber === null && bNumber !== null) return 1;
    }

    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function getAttributeValues(family = {}, keys = []) {
  const attributes = family?.attributes || {};

  return keys.flatMap((key) => {
    const values = Array.isArray(attributes[key]) ? attributes[key] : [];
    return values.map(clean).filter(Boolean);
  });
}

function inferSystem(family = {}) {
  const explicitSystems = getAttributeValues(family, ["measurementSystem"])
    .map((value) => value.toLowerCase());

  if (explicitSystems.some((value) => value.includes("metric"))) return "metric";
  if (
    explicitSystems.some(
      (value) => value.includes("imperial") || value.includes("standard")
    )
  ) {
    return "standard";
  }

  const dimensionText = getAttributeValues(family, [
    "diameter",
    "size",
    "length",
    "width",
    "thickness",
  ]).join(" ");

  if (/\bm\d/i.test(dimensionText) || /\b\d+(?:\.\d+)?\s*mm\b/i.test(dimensionText)) {
    return "metric";
  }

  return "standard";
}

function summarizeValues(values = [], dimension = false) {
  const sorted = sortValues(values, dimension);
  if (!sorted.length) return "";
  if (sorted.length <= 3) return sorted.join(", ");

  if (dimension) {
    return `${sorted[0]} – ${sorted[sorted.length - 1]} · ${sorted.length} options`;
  }

  return `${sorted.slice(0, 2).join(", ")} +${sorted.length - 2} more`;
}

function buildSystemGroups(families = []) {
  const groups = new Map(
    SYSTEMS.map((system) => [
      system.key,
      {
        ...system,
        familyCount: 0,
        optionCount: 0,
        values: new Map(),
      },
    ])
  );

  for (const family of families) {
    const systemKey = inferSystem(family);
    const group = groups.get(systemKey) || groups.get("standard");

    group.familyCount += 1;
    group.optionCount += Number(family?.variantCount || 0);

    for (const spec of SPEC_GROUPS) {
      const values = getAttributeValues(family, spec.keys);
      if (!values.length) continue;

      if (!group.values.has(spec.key)) group.values.set(spec.key, new Set());
      const target = group.values.get(spec.key);
      values.forEach((value) => target.add(value));
    }
  }

  return SYSTEMS.map((system) => {
    const group = groups.get(system.key);
    const specs = SPEC_GROUPS.map((spec) => ({
      ...spec,
      values: sortValues(Array.from(group.values.get(spec.key) || []), spec.dimension),
    })).filter((spec) => spec.values.length > 0);

    return {
      ...group,
      specs,
    };
  });
}

function SpecificationRow({ spec }) {
  const preview = summarizeValues(spec.values, spec.dimension);

  return (
    <details className="catalog-range-spec-row">
      <summary className="catalog-range-spec-summary">
        <div className="catalog-range-spec-copy">
          <span className="catalog-range-spec-label">{spec.label}</span>
          <span className="catalog-range-spec-preview">{preview}</span>
        </div>

        <div className="catalog-range-spec-meta">
          <span className="catalog-range-spec-count rounded-pill">
            {spec.values.length}
          </span>
          <i className="bi bi-chevron-down catalog-range-spec-chevron" aria-hidden="true" />
        </div>
      </summary>

      <div className="catalog-range-spec-values">
        {spec.values.map((value) => (
          <span key={value} className="catalog-range-spec-value rounded-pill">
            {value}
          </span>
        ))}
      </div>
    </details>
  );
}

function SystemCard({ group }) {
  const isEmpty = group.optionCount === 0 && group.specs.length === 0;

  return (
    <section
      className={`catalog-range-system-card theme-section-container bg-main-light rounded-4 ${
        isEmpty ? "catalog-range-system-card-empty" : ""
      }`}
    >
      <header className="catalog-range-system-header">
        <div>
          <div className="catalog-range-system-kicker text-muted text-uppercase">
            Measurement System
          </div>
          <h2 className="catalog-range-system-title text-main text-uppercase mb-1">
            {group.label}
          </h2>
          <p className="catalog-range-system-subtitle text-muted mb-0">
            {group.subtitle}
          </p>
        </div>

        <div className="catalog-range-system-counts">
          <span className="catalog-range-count rounded-pill">
            {group.optionCount} cataloged option{group.optionCount === 1 ? "" : "s"}
          </span>
          {group.familyCount > 0 ? (
            <span className="catalog-range-count rounded-pill">
              {group.familyCount} configuration{group.familyCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </header>

      {isEmpty ? (
        <div className="catalog-range-system-empty text-muted">
          No {group.label.toLowerCase()} ranges are currently cataloged online. Contact us to check availability.
        </div>
      ) : (
        <div className="catalog-range-spec-list">
          {group.specs.map((spec) => (
            <SpecificationRow key={spec.key} spec={spec} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function ProductRangeList({ page = {}, summary = {} }) {
  const families = Array.isArray(summary?.families) ? summary.families : [];
  const action = actionConfig(page?.primaryAction);
  const heading = page?.displayName || summary?.name || "Products";
  const generalSubcategory = findGeneralSubcategory(
    page?.categoryId || summary?.categoryId,
    page?.subcategoryId || summary?.subcategoryId
  );
  const imageUrl =
    page?.image?.url || generalSubcategory?.image || summary?.image || "";
  const imageAlt =
    page?.image?.alt || generalSubcategory?.name || `${heading} category image`;

  const systemGroups = useMemo(() => buildSystemGroups(families), [families]);
  const totalOptions = systemGroups.reduce(
    (sum, group) => sum + Number(group.optionCount || 0),
    0
  );

  return (
    <div className="theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5">
      <div className="theme-detail-container rounded-4 px-3 px-sm-5 py-4 fade-in">
        <header className="catalog-range-header mb-4">
          <div className="catalog-range-header-grid">
            <div className="catalog-range-header-copy">
              <div className="small text-muted text-uppercase mb-2">Product Range</div>
              <h1 className="text-main text-uppercase mb-2">{heading}</h1>
              <p className="text-muted mb-0 catalog-range-intro">
                {page?.introText ||
                  `Choose Standard or Metric, then expand a specification to review the general sizes, grades, threads, and finishes represented in our ${heading} catalog.`}
              </p>

              <div className="catalog-range-totals d-flex flex-wrap gap-2 mt-3">
                <span className="catalog-range-count rounded-pill px-3 py-2 small">
                  Standard &amp; Metric
                </span>
                <span className="catalog-range-count rounded-pill px-3 py-2 small">
                  {totalOptions} cataloged option{totalOptions === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="catalog-range-header-media">
              <div className="catalog-range-header-image theme-section-container bg-main-light bg-main-light rounded-4">
                {imageUrl ? (
                  <img src={imageUrl} alt={imageAlt} className="img-fluid" />
                ) : (
                  <div className="catalog-range-header-image-empty text-muted">
                    <i className="bi bi-grid-3x3-gap fs-1 mb-2" />
                    <span>Category image coming soon</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {families.length ? (
          <div className="catalog-range-system-grid">
            {systemGroups.map((group) => (
              <SystemCard key={group.key} group={group} />
            ))}
          </div>
        ) : (
          <div className="catalog-range-empty theme-section-container bg-main-light rounded-4 p-4 p-md-5 text-center">
            <i className="bi bi-tools fs-1 text-muted d-block mb-3" />
            <h2 className="h4 text-main text-uppercase">Details are being prepared</h2>
            <p className="text-muted mx-auto mb-0" style={{ maxWidth: "720px" }}>
              We may still carry products in this category even though the online list is not complete. Send us the sizes or part numbers you need and we will check availability.
            </p>
          </div>
        )}

        <div className="catalog-range-contact theme-section-container bg-main-light rounded-4 p-4 mt-4 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div>
            <h2 className="h5 text-main text-uppercase mb-1">Need a specific size?</h2>
            <p className="text-muted mb-0">
              {page?.contactMessage ||
                "Availability varies by exact size and finish. CONTACT for current stock and pricing."}
            </p>
          </div>

          <div className="d-flex flex-wrap gap-2 justify-content-end">
            {action ? (
              <Link
                to={action.to}
                className="btn-main-cta rounded-3 text-uppercase text-main-light px-4 py-2 text-decoration-none text-center"
              >
                {action.label}
              </Link>
            ) : null}
            <Link to="/products" className="btn btn-outline-secondary rounded-3 px-4 py-2">
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

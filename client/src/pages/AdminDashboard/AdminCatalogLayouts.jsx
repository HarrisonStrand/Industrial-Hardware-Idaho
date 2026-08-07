import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchAdminCatalogLayouts,
  updateAdminCatalogGlobalSettings,
  updateAdminCatalogSubcategory,
} from "../../services/catalogLayoutApi.js";
import "./AdminCatalogLayouts.css";

const DEFAULT_OPTIONS = {
  displayModes: ["builder", "range-list", "product-grid", "coming-soon", "hidden"],
  fallbackModes: ["range-list", "product-grid", "coming-soon", "hidden"],
  rangeDataSources: ["approved", "ready", "active-enriched"],
  primaryActions: ["shop", "quote", "contact", "parts-list", "none"],
};

function titleCase(value = "") {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statLabel(stats = {}) {
  return `${Number(stats.publishedProducts || 0)} published · ${Number(
    stats.readyProducts || 0
  )} ready · ${Number(stats.approvedProducts || 0)} approved`;
}

function ModeBadge({ mode }) {
  const className =
    mode === "builder"
      ? "text-bg-success"
      : mode === "range-list"
        ? "text-bg-primary"
        : mode === "product-grid"
          ? "text-bg-info"
          : mode === "hidden"
            ? "text-bg-dark"
            : "text-bg-secondary";

  return <span className={`badge rounded-pill ${className}`}>{titleCase(mode)}</span>;
}

export default function AdminCatalogLayouts() {
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [global, setGlobal] = useState({ buildersEnabled: false });
  const [items, setItems] = useState([]);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data = await fetchAdminCatalogLayouts();
      setGlobal(data?.global || { buildersEnabled: false });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setOptions({ ...DEFAULT_OPTIONS, ...(data?.options || {}) });
    } catch (loadError) {
      console.error("Failed to load catalog layout settings:", loadError);
      setError(loadError.message || "Failed to load catalog layout settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(
    () =>
      [...new Set(items.map((item) => item.categoryName || item.categoryId).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.categoryName,
          item.categoryId,
          item.displayName,
          item.subcategoryId,
          item.displayMode,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesCategory =
        !categoryFilter ||
        item.categoryName === categoryFilter ||
        item.categoryId === categoryFilter;

      const matchesMode = !modeFilter || item.displayMode === modeFilter;

      return matchesSearch && matchesCategory && matchesMode;
    });
  }, [items, search, categoryFilter, modeFilter]);

  function updateItem(categoryId, subcategoryId, field, value) {
    setItems((current) =>
      current.map((item) => {
        if (item.categoryId !== categoryId || item.subcategoryId !== subcategoryId) {
          return item;
        }

        if (field.startsWith("image.")) {
          const imageField = field.split(".")[1];
          return {
            ...item,
            image: {
              ...(item.image || {}),
              [imageField]: value,
            },
          };
        }

        return { ...item, [field]: value };
      })
    );
  }

  async function saveGlobal(nextEnabled) {
    try {
      setSavingGlobal(true);
      setError("");
      setMessage("");
      const data = await updateAdminCatalogGlobalSettings({
        buildersEnabled: nextEnabled,
      });
      setGlobal(data?.global || { buildersEnabled: nextEnabled });
      setMessage(
        nextEnabled
          ? "Product builders are enabled."
          : "Product builders are disabled and builder pages now use their fallback modes."
      );
      await load();
    } catch (saveError) {
      console.error("Failed to update builder switch:", saveError);
      setError(saveError.message || "Failed to update builder switch.");
    } finally {
      setSavingGlobal(false);
    }
  }

  async function saveItem(item) {
    const key = `${item.categoryId}/${item.subcategoryId}`;

    try {
      setSavingKey(key);
      setError("");
      setMessage("");

      const data = await updateAdminCatalogSubcategory(
        item.categoryId,
        item.subcategoryId,
        {
          displayMode: item.displayMode,
          fallbackMode: item.fallbackMode,
          rangeDataSource: item.rangeDataSource,
          isVisible: !!item.isVisible,
          showPricing: !!item.showPricing,
          displayName: item.displayName,
          introText: item.introText,
          contactMessage: item.contactMessage,
          primaryAction: item.primaryAction,
          image: item.image || {},
          adminNotes: item.adminNotes,
        }
      );

      setItems((current) =>
        current.map((row) =>
          row.categoryId === item.categoryId && row.subcategoryId === item.subcategoryId
            ? { ...row, ...(data?.item || {}) }
            : row
        )
      );
      setMessage(`${item.displayName || item.subcategoryId} settings saved.`);
    } catch (saveError) {
      console.error("Failed to update catalog subcategory:", saveError);
      setError(saveError.message || "Failed to save subcategory settings.");
    } finally {
      setSavingKey("");
    }
  }

  if (loading) {
    return <div className="text-muted p-3">Loading catalog layout settings…</div>;
  }

  return (
    <div className="admin-catalog-layouts d-flex flex-column gap-4">
      <div>
        <div className="text-main text-uppercase fs-4 mb-1">Catalog Layout</div>
        <p className="text-muted mb-0">
          Choose how each subcategory appears to customers and switch all product builders to their fallback layouts when needed.
        </p>
      </div>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}
      {message ? <div className="alert alert-success mb-0">{message}</div> : null}

      <div className="admin-catalog-global card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-4">
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h2 className="h5 text-main text-uppercase mb-0">Global Product Builder Switch</h2>
              <ModeBadge mode={global.buildersEnabled ? "builder" : "range-list"} />
            </div>
            <p className="text-muted mb-0">
              When disabled, any subcategory assigned to Builder automatically uses its selected fallback mode.
            </p>
          </div>

          <div className="d-flex align-items-center gap-3">
            <span className="small text-muted">
              {global.buildersEnabled ? "Builders on" : "Fallbacks active"}
            </span>
            <div className="form-check form-switch fs-3 mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                checked={!!global.buildersEnabled}
                disabled={savingGlobal}
                onChange={(event) => saveGlobal(event.target.checked)}
                aria-label="Toggle all product builders"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-lg-5">
              <label className="form-label">Search</label>
              <input
                className="form-control"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Category, subcategory, or mode..."
              />
            </div>
            <div className="col-6 col-lg-3">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-lg-3">
              <label className="form-label">Mode</label>
              <select
                className="form-select"
                value={modeFilter}
                onChange={(event) => setModeFilter(event.target.value)}
              >
                <option value="">All modes</option>
                {options.displayModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {titleCase(mode)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-lg-1 d-grid">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("");
                  setModeFilter("");
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center">
        <div className="small text-muted">
          {filteredItems.length} subcategor{filteredItems.length === 1 ? "y" : "ies"}
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={load}>
          Refresh Counts
        </button>
      </div>

      <div className="d-grid gap-4">
        {filteredItems.map((item) => {
          const key = `${item.categoryId}/${item.subcategoryId}`;
          const saving = savingKey === key;
          const effectiveMode =
            item.displayMode === "builder" && !global.buildersEnabled
              ? item.fallbackMode
              : item.displayMode;

          return (
            <section key={key} className="admin-catalog-item card border-0 shadow-sm rounded-4 overflow-hidden">
              <div className="card-header bg-transparent border-0 px-4 pt-4 pb-0">
                <div className="d-flex flex-column flex-xl-row justify-content-between gap-3">
                  <div>
                    <div className="small text-muted text-uppercase">{item.categoryName || item.categoryId}</div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <h2 className="h5 text-main mb-0">{item.displayName || titleCase(item.subcategoryId)}</h2>
                      <ModeBadge mode={effectiveMode} />
                      {!item.isVisible ? <span className="badge rounded-pill text-bg-dark">Hidden from customers</span> : null}
                    </div>
                    <div className="small text-muted mt-1">
                      {statLabel(item.stats)} · {Number(item.stats?.builderReadyProducts || 0)} builder-ready
                    </div>
                  </div>

                  <div className="d-flex flex-wrap align-items-start gap-2">
                    <Link
                      to={`/products/${item.categoryId}/${item.subcategoryId}?previewMode=${item.displayMode}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-outline-secondary"
                    >
                      Preview Page
                    </Link>
                    <button
                      type="button"
                      className="btn-main-cta rounded-3 text-uppercase text-main-light px-4 py-2 border-0"
                      disabled={saving}
                      onClick={() => saveItem(item)}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-12 col-md-4 col-xl-3">
                    <label className="form-label">Display Mode</label>
                    <select
                      className="form-select"
                      value={item.displayMode}
                      onChange={(event) =>
                        updateItem(item.categoryId, item.subcategoryId, "displayMode", event.target.value)
                      }
                    >
                      {options.displayModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {titleCase(mode)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-4 col-xl-3">
                    <label className="form-label">Builder Fallback</label>
                    <select
                      className="form-select"
                      value={item.fallbackMode}
                      disabled={item.displayMode !== "builder"}
                      onChange={(event) =>
                        updateItem(item.categoryId, item.subcategoryId, "fallbackMode", event.target.value)
                      }
                    >
                      {options.fallbackModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {titleCase(mode)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-4 col-xl-3">
                    <label className="form-label">Range Data</label>
                    <select
                      className="form-select"
                      value={item.rangeDataSource || "ready"}
                      disabled={
                        item.displayMode !== "range-list" && item.fallbackMode !== "range-list"
                      }
                      onChange={(event) =>
                        updateItem(item.categoryId, item.subcategoryId, "rangeDataSource", event.target.value)
                      }
                    >
                      {options.rangeDataSources.map((source) => (
                        <option key={source} value={source}>
                          {source === "approved"
                            ? "Approved + Published"
                            : source === "ready"
                              ? "Ready + Approved + Published"
                              : "All Active Enriched Products"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-4 col-xl-3">
                    <label className="form-label">Primary Action</label>
                    <select
                      className="form-select"
                      value={item.primaryAction || "contact"}
                      onChange={(event) =>
                        updateItem(item.categoryId, item.subcategoryId, "primaryAction", event.target.value)
                      }
                    >
                      {options.primaryActions.map((action) => (
                        <option key={action} value={action}>
                          {titleCase(action)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-lg-4">
                    <label className="form-label">Page Title</label>
                    <input
                      className="form-control"
                      value={item.displayName || ""}
                      onChange={(event) =>
                        updateItem(item.categoryId, item.subcategoryId, "displayName", event.target.value)
                      }
                    />
                  </div>

                  <div className="col-12 col-lg-8">
                    <label className="form-label">Family / Header Image URL</label>
                    <input
                      className="form-control"
                      value={item.image?.url || ""}
                      onChange={(event) =>
                        updateItem(item.categoryId, item.subcategoryId, "image.url", event.target.value)
                      }
                      placeholder="/images/subcategories/example.png"
                    />
                  </div>

                  <div className="col-12 col-lg-6">
                    <label className="form-label">Intro Text</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={item.introText || ""}
                      onChange={(event) =>
                        updateItem(item.categoryId, item.subcategoryId, "introText", event.target.value)
                      }
                    />
                  </div>

                  <div className="col-12 col-lg-6">
                    <label className="form-label">Contact Message</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={item.contactMessage || ""}
                      onChange={(event) =>
                        updateItem(item.categoryId, item.subcategoryId, "contactMessage", event.target.value)
                      }
                    />
                  </div>

                  <div className="col-12">
                    <div className="admin-catalog-toggles d-flex flex-wrap gap-4 rounded-4 p-3">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={!!item.isVisible}
                          onChange={(event) =>
                            updateItem(item.categoryId, item.subcategoryId, "isVisible", event.target.checked)
                          }
                        />
                        <label className="form-check-label">Visible to customers</label>
                      </div>

                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={!!item.showPricing}
                          onChange={(event) =>
                            updateItem(item.categoryId, item.subcategoryId, "showPricing", event.target.checked)
                          }
                        />
                        <label className="form-check-label">Show pricing in grid mode</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

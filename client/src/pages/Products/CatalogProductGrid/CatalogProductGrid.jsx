import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCatalog } from "../../../services/catalogApi.js";
import "./CatalogProductGrid.css";

const EMPTY_FACETS = {
  productTypes: [],
  grades: [],
  materialFinishes: [],
  measurementSystems: [],
};

function toCatalogValue(value = "") {
  return String(value || "").replace(/-/g, " ");
}

function formatCurrency(value, currency = "USD") {
  if (value === null || value === undefined || value === "") {
    return "Call for price";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(Number(value));
  } catch {
    return `$${Number(value || 0).toFixed(2)}`;
  }
}

function formatFacetValue(value = "") {
  const raw = String(value || "").trim();
  if (/^imperial$/i.test(raw)) return "Standard";
  return raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function Pagination({ currentPage, totalPages, onPageChange, disabled = false }) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav aria-label="Product grid pages">
      <ul className="pagination pagination-sm mb-0 flex-wrap">
        <li className={`page-item ${currentPage <= 1 || disabled ? "disabled" : ""}`}>
          <button
            type="button"
            className="page-link"
            disabled={currentPage <= 1 || disabled}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </button>
        </li>

        {pages[0] > 1 ? (
          <>
            <li className="page-item">
              <button type="button" className="page-link" onClick={() => onPageChange(1)}>
                1
              </button>
            </li>
            {pages[0] > 2 ? (
              <li className="page-item disabled" aria-hidden="true">
                <span className="page-link">…</span>
              </li>
            ) : null}
          </>
        ) : null}

        {pages.map((pageNumber) => (
          <li
            key={pageNumber}
            className={`page-item ${pageNumber === currentPage ? "active" : ""}`}
          >
            <button
              type="button"
              className="page-link"
              aria-current={pageNumber === currentPage ? "page" : undefined}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          </li>
        ))}

        {pages[pages.length - 1] < totalPages ? (
          <>
            {pages[pages.length - 1] < totalPages - 1 ? (
              <li className="page-item disabled" aria-hidden="true">
                <span className="page-link">…</span>
              </li>
            ) : null}
            <li className="page-item">
              <button
                type="button"
                className="page-link"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </li>
          </>
        ) : null}

        <li
          className={`page-item ${
            currentPage >= totalPages || disabled ? "disabled" : ""
          }`}
        >
          <button
            type="button"
            className="page-link"
            disabled={currentPage >= totalPages || disabled}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default function CatalogProductGrid({ page = {} }) {
  const [items, setItems] = useState([]);
  const [facets, setFacets] = useState(EMPTY_FACETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    productType: "",
    grade: "",
    materialFinish: "",
    measurementSystem: "",
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setCurrentPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchInput("");
    setSearchTerm("");
    setFilters({
      productType: "",
      grade: "",
      materialFinish: "",
      measurementSystem: "",
    });
  }, [page.categoryId, page.subcategoryId]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const data = await fetchCatalog({
          category: toCatalogValue(page.categoryId),
          subcategory: toCatalogValue(page.subcategoryId),
          search: searchTerm,
          ...filters,
          limit: pageSize,
          skip: (currentPage - 1) * pageSize,
        });

        if (!alive) return;

        const nextItems = Array.isArray(data?.items) ? data.items : [];
        const nextTotal = Number(data?.total || 0);
        const nextTotalPages = Number(data?.totalPages || 0);

        setItems(nextItems);
        setTotal(nextTotal);
        setTotalPages(nextTotalPages);
        setFacets({
          ...EMPTY_FACETS,
          ...(data?.facets || {}),
        });

        if (nextTotalPages > 0 && currentPage > nextTotalPages) {
          setCurrentPage(nextTotalPages);
        }
      } catch (loadError) {
        console.error("Failed to load product grid:", loadError);
        if (alive) {
          setError(loadError.message || "Product grid is unavailable.");
          setItems([]);
          setTotal(0);
          setTotalPages(0);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [
    page.categoryId,
    page.subcategoryId,
    currentPage,
    pageSize,
    searchTerm,
    filters,
  ]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length + (searchTerm ? 1 : 0),
    [filters, searchTerm]
  );

  const firstResult = total ? (currentPage - 1) * pageSize + 1 : 0;
  const lastResult = total ? Math.min(currentPage * pageSize, total) : 0;

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setCurrentPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setSearchTerm("");
    setFilters({
      productType: "",
      grade: "",
      materialFinish: "",
      measurementSystem: "",
    });
    setCurrentPage(1);
  }

  function changePage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5">
      <div className="theme-detail-container rounded-4 px-3 px-sm-5 py-4 fade-in">
        <header className="mb-4">
          <div className="small text-muted text-uppercase mb-2">Product Catalog</div>
          <h1 className="text-main text-uppercase mb-2">
            {page.displayName || "Products"}
          </h1>
          <p className="text-muted mb-0">
            {page.introText || "Browse currently published products in this category."}
          </p>
        </header>

        <section className="catalog-grid-controls theme-section-container rounded-4 p-3 mb-4">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-lg-4 col-xl-3">
              <label className="form-label small text-muted text-uppercase mb-1">
                Search this category
              </label>
              <div className="input-group">
                <span className="input-group-text bg-transparent">
                  <i className="bi bi-search" />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Name, part number, or keyword"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </div>
            </div>

            {facets.productTypes.length > 1 ? (
              <div className="col-6 col-md-4 col-lg-2">
                <label className="form-label small text-muted text-uppercase mb-1">
                  Product Type
                </label>
                <select
                  className="form-select"
                  value={filters.productType}
                  onChange={(event) => updateFilter("productType", event.target.value)}
                >
                  <option value="">All</option>
                  {facets.productTypes.map((value) => (
                    <option key={value} value={value}>{formatFacetValue(value)}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {facets.grades.length > 1 ? (
              <div className="col-6 col-md-4 col-lg-2">
                <label className="form-label small text-muted text-uppercase mb-1">
                  Grade
                </label>
                <select
                  className="form-select"
                  value={filters.grade}
                  onChange={(event) => updateFilter("grade", event.target.value)}
                >
                  <option value="">All</option>
                  {facets.grades.map((value) => (
                    <option key={value} value={value}>{formatFacetValue(value)}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {facets.materialFinishes.length > 1 ? (
              <div className="col-6 col-md-4 col-lg-2">
                <label className="form-label small text-muted text-uppercase mb-1">
                  Material / Finish
                </label>
                <select
                  className="form-select"
                  value={filters.materialFinish}
                  onChange={(event) => updateFilter("materialFinish", event.target.value)}
                >
                  <option value="">All</option>
                  {facets.materialFinishes.map((value) => (
                    <option key={value} value={value}>{formatFacetValue(value)}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {facets.measurementSystems.length > 1 ? (
              <div className="col-6 col-md-4 col-lg-2">
                <label className="form-label small text-muted text-uppercase mb-1">
                  System
                </label>
                <select
                  className="form-select"
                  value={filters.measurementSystem}
                  onChange={(event) => updateFilter("measurementSystem", event.target.value)}
                >
                  <option value="">All</option>
                  {facets.measurementSystems.map((value) => (
                    <option key={value} value={value}>{formatFacetValue(value)}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="col-6 col-md-3 col-lg-auto">
              <label className="form-label small text-muted text-uppercase mb-1">
                Per Page
              </label>
              <select
                className="form-select"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
              >
                {[12, 24, 48].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-3 col-lg-auto">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                disabled={!activeFilterCount}
                onClick={clearFilters}
              >
                Clear{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </button>
            </div>
          </div>
        </section>

        <div className="catalog-grid-result-bar d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2 mb-3">
          <div className="small text-muted">
            {loading
              ? "Loading products…"
              : total
                ? `Showing ${firstResult}–${lastResult} of ${total} products`
                : "No matching products"}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={changePage}
            disabled={loading}
          />
        </div>

        {loading ? (
          <div className="text-center text-muted py-5">
            <div className="spinner-border spinner-border-sm me-2" role="status" />
            Loading products…
          </div>
        ) : null}

        {!loading && error ? <div className="alert alert-warning">{error}</div> : null}

        {!loading && !error && items.length ? (
          <div className="row g-4">
            {items.map((item) => (
              <div key={item.productId} className="col-12 col-md-6 col-xl-4 col-xxl-3">
                <Link
                  to={`/catalog/product/${item.slug}`}
                  className="catalog-grid-card theme-section-container rounded-4 overflow-hidden text-decoration-none text-main h-100 d-flex flex-column"
                >
                  <div className="catalog-grid-image bg-main-light d-flex align-items-center justify-content-center">
                    {item.image ? (
                      <img src={item.image} alt={item.title} />
                    ) : (
                      <i className="bi bi-box-seam fs-1 text-muted" />
                    )}
                  </div>
                  <div className="p-3 d-flex flex-column flex-grow-1">
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {item.productType ? (
                        <span className="catalog-grid-badge rounded-pill px-2 py-1">
                          {formatFacetValue(item.productType)}
                        </span>
                      ) : null}
                      {item.grade ? (
                        <span className="catalog-grid-badge rounded-pill px-2 py-1">
                          {formatFacetValue(item.grade)}
                        </span>
                      ) : null}
                    </div>
                    <div className="small text-muted text-uppercase mb-1">
                      {item.sku || "Catalog Product"}
                    </div>
                    <h2 className="h5 text-main mb-2">{item.title}</h2>
                    <p className="small text-muted flex-grow-1">
                      {item.shortDescription || "View product details and availability."}
                    </p>
                    {item.materialFinish ? (
                      <div className="small text-muted mb-2">
                        {formatFacetValue(item.materialFinish)}
                      </div>
                    ) : null}
                    <div className="d-flex justify-content-between gap-3 align-items-end">
                      <div className="fw-semibold">
                        {page.showPricing
                          ? formatCurrency(item.price, item.currency)
                          : "Contact for pricing"}
                      </div>
                      <span className="small text-muted text-end">
                        {item.inStock ? "In stock" : "Check availability"}
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !error && !items.length ? (
          <div className="theme-section-container rounded-4 p-5 text-center">
            <i className="bi bi-box-seam fs-1 text-muted d-block mb-3" />
            <h2 className="h4 text-main text-uppercase">
              {activeFilterCount ? "No products match these filters" : "No published products yet"}
            </h2>
            <p className="text-muted mb-3">
              {activeFilterCount
                ? "Try clearing one or more filters, or contact us for help finding the right product."
                : "Contact us for current availability while this product grid is being prepared."}
            </p>
            <div className="d-flex flex-wrap justify-content-center gap-2">
              {activeFilterCount ? (
                <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>
                  Clear Filters
                </button>
              ) : null}
              <Link to="/contact" className="btn-main-cta rounded-3 text-uppercase text-main-light px-4 py-2 text-decoration-none">
                Contact Us
              </Link>
            </div>
          </div>
        ) : null}

        {!loading && !error && items.length ? (
          <div className="catalog-grid-footer d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2 mt-4 pt-3">
            <div className="small text-muted">
              Page {currentPage} of {Math.max(1, totalPages)}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={changePage}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

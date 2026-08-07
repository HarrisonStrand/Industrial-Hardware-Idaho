import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { fetchCatalogSubcategoryPage } from "../../../services/catalogLayoutApi.js";
import ProductDetailFacetPanel from "../ProductDetail/ProductDetailFacetPanel.jsx";
import ProductRangeList from "../ProductRangeList/ProductRangeList.jsx";
import CatalogProductGrid from "../CatalogProductGrid/CatalogProductGrid.jsx";
import "./CatalogSubcategoryPage.css";

function CatalogUnavailable({ title = "Catalog page unavailable", message = "" }) {
  return (
    <div className="theme-detail container-fluid px-3 px-sm-5 py-5">
      <div className="theme-detail-container rounded-4 p-4 p-md-5 text-center">
        <i className="bi bi-tools fs-1 text-muted d-block mb-3" />
        <h1 className="h3 text-main text-uppercase">{title}</h1>
        <p className="text-muted mx-auto" style={{ maxWidth: "720px" }}>
          {message || "This product section is not available yet. Contact us and we will help locate the item you need."}
        </p>
        <div className="d-flex flex-wrap justify-content-center gap-2 mt-4">
          <Link to="/contact" className="btn-main-cta rounded-3 text-uppercase text-main-light px-4 py-2 text-decoration-none">
            Contact Us
          </Link>
          <Link to="/products" className="btn btn-outline-secondary rounded-3 px-4 py-2">
            Back to Products
          </Link>
        </div>
      </div>
    </div>
  );
}

function ComingSoonPage({ page = {} }) {
  return (
    <div className="theme-detail container-fluid px-3 px-sm-5 py-5">
      <div className="theme-detail-container catalog-coming-soon rounded-4 p-4 p-md-5 text-center">
        <div className="catalog-coming-soon-image bg-main-light rounded-4 d-flex align-items-center justify-content-center mx-auto mb-4">
          {page?.image?.url ? (
            <img src={page.image.url} alt={page.image.alt || page.displayName} />
          ) : (
            <i className="bi bi-cone-striped fs-1 text-muted" />
          )}
        </div>
        <div className="small text-muted text-uppercase mb-2">Catalog Update</div>
        <h1 className="text-main text-uppercase mb-3">{page.displayName || "Coming Soon"}</h1>
        <p className="lead text-main mx-auto" style={{ maxWidth: "760px" }}>
          {page.introText || "We are preparing this section for online browsing."}
        </p>
        <p className="text-muted mx-auto" style={{ maxWidth: "760px" }}>
          {page.contactMessage || "The products may still be available in store. Contact us with the size, brand, or part number you need."}
        </p>
        <div className="d-flex flex-wrap justify-content-center gap-2 mt-4">
          <Link to="/contact" className="btn-main-cta rounded-3 text-uppercase text-main-light px-4 py-2 text-decoration-none">
            Contact Us
          </Link>
          <Link to="/products" className="btn btn-outline-secondary rounded-3 px-4 py-2">
            Back to Products
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CatalogSubcategoryPage() {
  const { categoryId, subcategoryId } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const searchParams = new URLSearchParams(location.search);
        const result = await fetchCatalogSubcategoryPage(categoryId, subcategoryId, {
          previewMode: searchParams.get("previewMode") || "",
        });
        if (alive) setData(result);
      } catch (loadError) {
        console.error("Failed to load catalog subcategory page:", loadError);
        if (alive) {
          setData(null);
          setError(loadError.message || "Catalog page unavailable");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [categoryId, subcategoryId, location.search]);

  if (loading) {
    return (
      <div className="catalog-layout-loading d-flex align-items-center justify-content-center text-muted">
        Loading catalog…
      </div>
    );
  }

  if (error || !data?.page) {
    return <CatalogUnavailable message={error} />;
  }

  const page = data.page;
  const mode = page.effectiveMode;

  return (
    <>
      {data.adminPreview ? (
        <div className="container-fluid px-3 px-sm-5 pt-3">
          <div className="alert alert-warning rounded-4 mb-0">
            Admin preview: you are viewing this subcategory outside its current public layout.
          </div>
        </div>
      ) : null}

      {mode === "builder" ? (
        <ProductDetailFacetPanel includeUnpublished={data.isAdmin === true} />
      ) : null}
      {mode === "range-list" ? (
        <ProductRangeList page={page} summary={data.rangeSummary || {}} />
      ) : null}
      {mode === "product-grid" ? <CatalogProductGrid page={page} /> : null}
      {mode === "coming-soon" ? <ComingSoonPage page={page} /> : null}
      {mode === "hidden" ? <CatalogUnavailable /> : null}
    </>
  );
}

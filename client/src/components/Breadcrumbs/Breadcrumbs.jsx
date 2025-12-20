import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import categoriesUI from "../../data/categories.json";
import productParams from "../../data/product-parameters.json";
import "./Breadcrumbs.css";

export default function Breadcrumbs() {
  const location = useLocation();
  const { categoryId, subcategoryId } = useParams();
  const [searchParams] = useSearchParams();

  const categoryQuery = searchParams.get("category");
  const groupQuery = searchParams.get("group");

  const crumbs = [
    {
      label: "Products",
      to: "/products",
      isLink: true
    }
  ];

  // --------------------------------------------------
  // CATEGORY (from categories.json via query param)
  // --------------------------------------------------
  if (categoryQuery) {
    const uiCategory = categoriesUI.categories.find(
      (c) => c.id === categoryQuery
    );

    if (uiCategory) {
      crumbs.push({
        label: `Back to ${uiCategory.name}`,
        to: `/products?category=${uiCategory.id}`,
        isLink: true,
        back: true
      });
    }
  }

  // --------------------------------------------------
  // GROUP (Machine Screws, Sheet Metal Screws, etc.)
  // --------------------------------------------------
  if (categoryQuery && groupQuery) {
    const groupCategory = productParams.categories.find(
      (c) => c.id === groupQuery
    );

    if (groupCategory) {
      crumbs.push({
        label: `Back to ${groupCategory.name}`,
        to: `/products?category=${categoryQuery}&group=${groupCategory.id}`,
        isLink: true,
        back: true
      });
    }
  }

  // --------------------------------------------------
  // FINAL SUBCATEGORY (route param)
  // --------------------------------------------------
  if (subcategoryId) {
    let foundSub = null;

    productParams.categories.forEach((cat) => {
      const sub = cat.subcategories?.find(
        (s) => s.id === subcategoryId
      );
      if (sub) foundSub = sub;
    });

    if (foundSub) {
      crumbs.push({
        label: foundSub.name,
        isLink: false
      });
    }
  }

  // --------------------------------------------------
  // SCHEMA MARKUP (SEO)
  // --------------------------------------------------
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: c.to
        ? `${window.location.origin}${c.to}`
        : window.location.href
    }))
  };

  return (
    <>
      <nav className="breadcrumbs container-fluid px-3 px-sm-5 py-2">
        <ul className="breadcrumb-list d-flex align-items-center gap-2 m-0 p-0 list-unstyled">
          {crumbs.map((crumb, i) => (
            <li key={i} className="breadcrumb-item">
              {crumb.isLink ? (
                <Link
                  to={crumb.to}
                  className="breadcrumb-link text-decoration-none text-main"
                >
                  {crumb.back && (
                    <i className="bi bi-arrow-left me-1" />
                  )}
                  {crumb.label}
                </Link>
              ) : (
                <span className="breadcrumb-current text-main fw-semibold">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* SEO schema */}
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </>
  );
}

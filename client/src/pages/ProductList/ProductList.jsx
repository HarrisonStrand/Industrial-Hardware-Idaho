import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Breadcrumbs from "../../components/Breadcrumbs/Breadcrumbs.jsx";

import categoriesUI from "../../data/categories.json";
import productParams from "../../data/product-parameters.json";

import CategoryCard from "../../components/CategoryCard/CategoryCard";
import "./ProductList.css";
import FeatureBanner from "../../components/FeatureBanner/FeatureBanner";
import ContactBanner from "../../components/ContactBanner/ContactBanner";

export default function ProductList() {
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState([]);

  // ---------------------------------------------
  // READ URL PARAMETERS
  // ---------------------------------------------
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setQuery(p.get("search")?.toLowerCase() || "");
    setCategory(p.get("category")?.toLowerCase() || "");
  }, [location.search]);

  // ---------------------------------------------
  // MAIN FILTER LOGIC
  // ---------------------------------------------
  useEffect(() => {
    // -----------------------------------------
    // SEARCH MODE (search product-parameters)
    // -----------------------------------------
    if (query) {
      const q = query.toLowerCase();
      const matched = [];

      productParams.categories.forEach((cat) => {
        const catMatch = cat.name.toLowerCase().includes(q);

        const subMatches = (cat.subcategories || []).filter((sub) =>
          sub.name.toLowerCase().includes(q)
        );

        if (catMatch || subMatches.length > 0) {
          matched.push({
            ...cat,
            subcategories:
              subMatches.length > 0 ? subMatches : cat.subcategories,
          });
        }
      });

      setResults(matched);
      return;
    }

    // -----------------------------------------
    // UI CATEGORY CLICK → SHOW PRODUCT SUBCATEGORIES
    // -----------------------------------------
    if (category) {
      const productCategory = productParams.categories.find(
        (c) => c.id.toLowerCase() === category
      );

      setResults(productCategory ? productCategory.subcategories : []);
      return;
    }

    // -----------------------------------------
    // DEFAULT VIEW → UI CATEGORIES
    // -----------------------------------------
    setResults(categoriesUI.categories);
  }, [query, category]);

  const showUICategories = !query && !category;
  const showSubcategories = !query && category;
  const showSearchResults = query.length > 0;

  return (
    <>
    <Breadcrumbs/>
      <div className="categories p-4 p-md-5 py-4 py-md-5">

        {/* -------------------------------------
            UI CATEGORY VIEW
        ------------------------------------- */}
        {showUICategories && (
          <>
            <h4 className="categories-title fw-regular text-main text-uppercase text-start mb-3">
              Browse Categories
            </h4>

            <div className="row g-4 justify-content-evenly">
              {results.map((cat) => (
                <div key={cat.id} className="col-sm-6 col-md-6 col-lg-3">
                  <CategoryCard category={cat} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* -------------------------------------
            SUBCATEGORY VIEW
        ------------------------------------- */}
        {showSubcategories && (
          <>
            <h4 className="categories-title fw-regular text-main text-uppercase text-start mb-3">
              {category.replace("-", " ")}
            </h4>

            <div className="row g-4 justify-content-evenly">
              {results.map((sub) => (
                <div key={sub.id} className="col-sm-6 col-md-6 col-lg-3">
                  <CategoryCard
                    category={sub}
                    parentCategoryId={category}
                    isSubcategory
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* -------------------------------------
            SEARCH RESULTS
        ------------------------------------- */}
        {showSearchResults && (
          <>
            <h4 className="categories-title fw-regular text-main text-uppercase text-start mb-3">
              Search results for “{query}”
            </h4>

            {results.length > 0 ? (
              results.map((cat) => (
                <div key={cat.id} className="mb-5">
                  <h4 className="fw-bold text-main">{cat.name}</h4>

                  <div className="row g-4 mt-3 mb-4">
                    {(cat.subcategories || []).map((sub) => (
                      <div
                        key={sub.id}
                        className="col-sm-6 col-md-6 col-lg-3"
                      >
                        <CategoryCard
                          category={sub}
                          parentCategoryId={cat.id}
                          isSubcategory
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted text-center">
                No categories match your search.
              </p>
            )}
          </>
        )}
      </div>

      <ContactBanner />
      <FeatureBanner />
    </>
  );
}

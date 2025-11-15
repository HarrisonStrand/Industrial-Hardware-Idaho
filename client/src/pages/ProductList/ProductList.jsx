import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import categoriesData from "../../data/categories.json";
import CategoryCard from "../../components/CategoryCard/CategoryCard";
import "./ProductList.css";

export default function ProductList() {
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [results, setResults] = useState([]);

  // Read URL parameters
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setQuery(p.get("search")?.toLowerCase() || "");
    setCategory(p.get("category")?.toLowerCase() || "");
    setSubcategory(p.get("subcategory")?.toLowerCase() || "");
  }, [location.search]);

  // MAIN FILTER LOGIC
  useEffect(() => {
    // SEARCH MODE
    if (query) {
      const q = query.toLowerCase();
      const matched = [];

      categoriesData.categories.forEach((cat) => {
        const catMatch = cat.name.toLowerCase().includes(q);

        const subMatches = cat.subcategories.filter((sub) =>
          sub.name.toLowerCase().includes(q)
        );

        if (catMatch || subMatches.length > 0) {
          matched.push({
            ...cat,
            subcategories: subMatches.length > 0 ? subMatches : cat.subcategories
          });
        }
      });

      setResults(matched);
      return;
    }

    // CATEGORY → SHOW SUBCATEGORIES
    if (category && !subcategory) {
      const found = categoriesData.categories.find(
        (c) => c.id.toLowerCase() === category
      );
      setResults(found ? [found] : []);
      return;
    }

    // DEFAULT → SHOW CATEGORIES
    setResults(categoriesData.categories);
  }, [query, category, subcategory]);

  const showCategories = !query && !category;
  const showSubcategories = !query && category && !subcategory;
  const showSearchResults = query.length > 0;

  return (
    <div className="container-fluid m-5">

      {/* CATEGORY VIEW */}
      {showCategories && (
        <>
          <h2 className="mb-4 text-main text-uppercase fw-bold">Browse Categories</h2>
          <div className="row g-4 justify-content-evenly">
            {results.map((cat) => (
              <div key={cat.id} className="col-6 col-md-2 col-lg">
                <CategoryCard category={cat} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* SUBCATEGORY VIEW */}
      {showSubcategories && results.length > 0 && (
        <>
          <h2 className="mb-4 text-main text-uppercase fw-bold">{results[0].name}</h2>
          <div className="row g-4 justify-content-evenly">
            {results[0].subcategories.map((sub) => (
              <div key={sub.id} className="col-6 col-md-4 col-lg-3">
                <CategoryCard
                  category={sub}
                  parentCategoryId={results[0].id}
                  isSubcategory={true}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* SEARCH RESULTS */}
      {showSearchResults && (
        <>
          <h2 className="mb-4 text-main text-uppercase fw-bold">
            Search results for “{query}”
          </h2>

          {results.length > 0 ? (
            results.map((cat) => (
              <div key={cat.id} className="mb-5">
                <h4 className="fw-bold text-main">{cat.name}</h4>
                <div className="row g-4 mt-3 mb-4">
                  {cat.subcategories.map((sub) => (
                    <div key={sub.id} className="col-6 col-md-4 col-lg-3">
                      <CategoryCard
                        category={sub}
                        parentCategoryId={cat.id}
                        isSubcategory={true}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted text-center">No categories match your search.</p>
          )}
        </>
      )}
    </div>
  );
}

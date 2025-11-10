import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import data from "../../data/products-test.json";
import categoriesData from "../../data/categories.json";
import "./ProductList.css";

export default function ProductList() {
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get("search")?.toLowerCase() || "");
    setCategory(params.get("category")?.toLowerCase() || "");
    setSubcategory(params.get("subcategory")?.toLowerCase() || "");
  }, [location.search]);

  useEffect(() => {
    if (query) {
      const results = data.products.filter((p) =>
        Object.values(p).some((val) =>
          String(val).toLowerCase().includes(query)
        )
      );
      setFilteredProducts(results);
    } else if (subcategory) {
      const results = data.products.filter(
        (p) => p.subcategory?.toLowerCase() === subcategory
      );
      setFilteredProducts(results);
    } else {
      setFilteredProducts([]);
    }
  }, [query, subcategory]);

  const currentCategory =
    categoriesData.categories.find(
      (c) => c.slug.toLowerCase() === category
    ) || null;

  const currentSubcategories = currentCategory?.subcategories || [];

  const showCategories = !category && !query;
  const showSubcategories = category && !subcategory && !query;
  const showProducts = query || subcategory;

  return (
    <div className="container my-5">
      {/* 🧭 Category View */}
      {showCategories && (
        <>
          <h2 className="mb-4 text-main text-uppercase fw-bold">
            Browse Categories
          </h2>
          <div className="row g-4">
            {categoriesData.categories.map((cat) => (
              <div key={cat.id} className="col-6 col-md-4 col-lg-3">
                <Link
                  to={`/products?category=${cat.slug}`}
                  className="category-card text-decoration-none"
                >
                  <img src={cat.image} alt={cat.name} className="w-100 rounded" />
                  <h5 className="mt-2 text-dark text-center">{cat.name}</h5>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 🧱 Subcategory View */}
      {showSubcategories && (
        <>
          <h2 className="mb-4 text-main text-uppercase fw-bold">
            {currentCategory.name}
          </h2>
          <div className="row g-4">
            {currentSubcategories.map((sub) => (
              <div key={sub.id} className="col-6 col-md-4 col-lg-3">
                <Link
                  to={`/products?category=${category}&subcategory=${sub.slug}`}
                  className="subcategory-card text-decoration-none"
                >
                  <img src={sub.image} alt={sub.name} className="w-100 rounded" />
                  <h6 className="mt-2 text-dark text-center">{sub.name}</h6>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 🛠 Product View */}
      {showProducts && (
        <>
          <h2 className="mb-4 text-main fw-bold text-uppercase">
            {query
              ? `Search results for “${query}”`
              : `Products in ${subcategory.replace(/-/g, " ")}`}
          </h2>

          {filteredProducts.length > 0 ? (
            <div className="row g-3">
              {filteredProducts.map((item) => (
                <div key={item.id} className="col-6 col-md-4 col-lg-3">
                  <Link
                    to={`/products/${item.id}`}
                    className="product-card text-decoration-none"
                  >
                    <img
                      src={item.image || "/images/default-product.jpg"}
                      alt={item.name}
                      className="w-100 rounded"
                    />
                    <div className="text-center mt-2">
                      <h6 className="fw-semibold text-dark mb-1">
                        {item.name}
                      </h6>
                      <span className="badge bg-secondary">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-center">
              No products match your search or selection.
            </p>
          )}
        </>
      )}
    </div>
  );
}

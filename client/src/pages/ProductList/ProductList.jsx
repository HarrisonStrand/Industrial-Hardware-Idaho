import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import data from "../../data/products-test.json";
import "./ProductList.css";

export default function ProductList() {
  const location = useLocation();
  const [filteredProducts, setFilteredProducts] = useState(data.products);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchQuery = params.get("search")?.toLowerCase() || "";
    setQuery(searchQuery);
  }, [location.search]);

  useEffect(() => {
    if (!query) {
      setFilteredProducts(data.products);
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const results = data.products.filter((p) => {
      const fields = [
        p.name,
        p.type,
        p.grade,
        p.material,
        p.diameter,
        p.length,
        p.thread,
        p.finish,
      ].map((f) => f.toLowerCase());
      return fields.some((field) => field.includes(normalizedQuery));
    });

    setFilteredProducts(results);
  }, [query]);

  return (
    <div className="container my-5">
      {query ? (
        <h2 className="mb-4">
          Search results for: <span className="text-primary">“{query}”</span>
        </h2>
      ) : (
        <h2 className="mb-4">All Products</h2>
      )}

      {filteredProducts.length > 0 ? (
        <ul className="list-group">
          {filteredProducts.map((item) => (
            <li
              key={item.id}
              className="list-group-item d-flex justify-content-between align-items-center"
            >
              <Link
                to={`/products/${item.id}`}
                className="text-decoration-none text-dark"
              >
                {item.name} — {item.grade} — {item.length}
              </Link>
              <span className="badge bg-secondary">${item.price.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted mt-3">No products match your search.</p>
      )}
    </div>
  );
}

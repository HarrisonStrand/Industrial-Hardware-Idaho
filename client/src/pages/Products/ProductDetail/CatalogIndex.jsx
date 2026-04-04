import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCatalog } from "../../../services/catalogApi";

export default function CatalogIndex() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchCatalog({ limit: 100, skip: 0 });
        if (!alive) return;
        setItems(data.items || []);
      } catch (error) {
        console.error("Failed to load catalog:", error);
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="p-4">Loading catalog…</div>;

  return (
    <div className="container py-4">
      <h1 className="mb-4">Catalog</h1>

      <div className="row g-4">
        {items.map((item) => (
          <div className="col-12 col-md-6 col-lg-4" key={item.productId}>
            <Link
              to={`/catalog/product/${item.slug}`}
              className="text-decoration-none text-dark"
            >
              <div className="card h-100">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="card-img-top"
                    style={{ height: "240px", objectFit: "cover" }}
                  />
                ) : null}

                <div className="card-body">
                  <h5 className="card-title">{item.title}</h5>
                  <p className="card-text">{item.shortDescription}</p>
                  <div className="fw-semibold">
                    ${Number(item.price || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
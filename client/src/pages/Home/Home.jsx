import { Link } from "react-router-dom";
import categoriesData from "../../data/categories.json";
import "./Home.css";

export default function Home() {
  return (
    <div className="home container my-5">
      <section className="intro text-center mb-5">
        <h1 className="fw-bold text-main mb-3">Industrial Hardware Idaho</h1>
        <p className="text-muted">
          Quality fasteners and industrial components built for every project.
        </p>
      </section>

      <section className="categories mb-5">
        <h2 className="fw-bold text-main text-uppercase text-center mb-4">
          Shop by Category
        </h2>

        <div className="row g-4 justify-content-center">
          {categoriesData.categories.map((cat) => (
            <div key={cat.id} className="col-6 col-md-4 col-lg-3">
              <Link
                to={`/products?category=${cat.slug}`}
                className="category-card text-decoration-none"
              >
                <div className="category-image-wrapper">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="category-image w-100 rounded"
                  />
                </div>
                <h5 className="mt-3 text-dark text-center fw-semibold">
                  {cat.name}
                </h5>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

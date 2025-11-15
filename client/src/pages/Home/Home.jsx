import { Link } from "react-router-dom";
import categoriesData from "../../data/categories.json";
import CategoryCard from "../../components/CategoryCard/CategoryCard";
import "./Home.css";

export default function Home() {
  return (
    <div className="home container-fluid m-5 hero-main">
      {/* <section className="intro text-center mb-5">
        <h1 className="fw-bold text-main mb-3">Industrial Hardware Idaho</h1>
        <p className="text-muted">
          Quality fasteners and industrial components built for every project.
        </p>
      </section> */}

      <section className="categories mb-5">
        <h4 className="fw-bold text-main text-uppercase text-start mb-4">
          Shop by Category
        </h4>
        <div className="row g-4 justify-content-evenly">
          {categoriesData.categories.map((category) => (
            <div key={category.id} className="col-6 col-md-2 col-lg">
              <CategoryCard category={category}/>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

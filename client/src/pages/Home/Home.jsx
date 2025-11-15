import { Link } from "react-router-dom";
import categoriesData from "../../data/categories.json";
import CategoryCard from "../../components/CategoryCard/CategoryCard";
import Hero from "../../components/Hero/Hero"
import "./Home.css";

export default function Home() {
  return (
    <div className="home container-fluid m-5 hero-main">
      <section className="categories mb-5">
        <h4 className="categories-title fw-regular text-main text-uppercase text-start mb-4">
          Product Categories
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

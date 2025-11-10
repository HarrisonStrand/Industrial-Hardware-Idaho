import { Link } from "react-router-dom";
import "./CategoryCard.css";

export default function CategoryCard({ name, slug, image }) {
  return (
    <Link to={`/products?category=${slug}`} className="category-card text-decoration-none">
      <div className="category-card-image">
        <img src={image} alt={name} loading="lazy" />
      </div>
      <h5 className="category-card-title text-center mt-2">{name}</h5>
    </Link>
  );
}
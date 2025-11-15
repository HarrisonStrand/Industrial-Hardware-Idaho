import { Link } from "react-router-dom";
import "./CategoryCard.css";

export default function CategoryCard({
  category,
  parentCategoryId = null,
  isSubcategory = false
}) {
  let linkTo = "";

  if (isSubcategory && parentCategoryId) {
    // SUBCATEGORY → Product Detail Page
    linkTo = `/products/${parentCategoryId}/${category.id}`;
  } else {
    // MAIN CATEGORY → Show subcategories
    linkTo = `/products?category=${category.id}`;
  }

  return (
    <div className="category-card card border-0 shadow-sm rounded-3 overflow-hidden">
      <Link to={linkTo} className="text-decoration-none text-dark">
        <div className="category-image-wrapper position-relative">
          <img
            src={category.image}
            alt={category.name}
            className="category-image w-100 h-100 object-fit-cover"
          />

          <div className="category-overlay position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center">
            <h5 className="category-name text-white text-uppercase fw-bold">
              {category.name}
            </h5>
          </div>
        </div>
      </Link>
    </div>
  );
}

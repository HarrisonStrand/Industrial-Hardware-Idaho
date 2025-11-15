import { Link } from "react-router-dom";
import "./CategoryCard.css";

export default function CategoryCard({
  category,
  parentCategoryId = null,
  isSubcategory = false
}) {
  let linkTo = "";

  if (isSubcategory && parentCategoryId) {
    linkTo = `/products/${parentCategoryId}/${category.id}`;
  } else {
    linkTo = `/products?category=${category.id}`;
  }

  return (
    <div className="category-card shadow-md rounded-4 overflow-hidden">
      <Link to={linkTo} className="text-decoration-none text-dark">
        <div className="category-image-wrapper position-relative">
          <img
            src={category.image}
            alt={category.name}
            className="category-image w-100 h-100 object-fit-cover"
          />

          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-start align-items-end ps-3">
            <h5 className="fs-4 font-secondary category-name text-uppercase fw-semibold">
              {category.name}
            </h5>
          </div>
        </div>
      </Link>
    </div>
  );
}

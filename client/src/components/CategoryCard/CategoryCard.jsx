import { Link } from "react-router-dom";
import "./CategoryCard.css";

const CATEGORY_FALLBACK_IMAGE = "/images/subcategories/subcategory-placeholder.png";

export default function CategoryCard({
  category,
  parentCategoryId = null,
  isSubcategory = false,
  isGroup = false
}) {
  let linkTo = "";

  if (isSubcategory && parentCategoryId) {
    linkTo = `/products/${parentCategoryId}/${category.id}`;
  } else if (isGroup && parentCategoryId) {
    linkTo = `/products?category=${parentCategoryId}&group=${category.id}`;
  } else {
    linkTo = `/products?category=${category.id}`;
  }

  return (
    <div className="category-card rounded-4 overflow-hidden border-0">
      <Link to={linkTo} className="text-decoration-none text-dark">
        <div className="category-card-image-wrapper position-relative flex-row justify-content-end">
          <img
            src={category.image || CATEGORY_FALLBACK_IMAGE}
            alt={category.name}
            className="category-image object-fit-cover w-75 align-self-start m-0"
            onError={(event) => {
              if (event.currentTarget.src.includes(CATEGORY_FALLBACK_IMAGE)) return;
              event.currentTarget.src = CATEGORY_FALLBACK_IMAGE;
            }}
          />
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-start align-items-end ps-3">
            <div>
              {category.comingSoon ? (
                <div className="category-coming-soon badge rounded-pill text-bg-light border mb-2">
                  Coming Soon
                </div>
              ) : null}
              <h5 className="font-secondary category-name text-uppercase fw-semibold">
                {category.name}
              </h5>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

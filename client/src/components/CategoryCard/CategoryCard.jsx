import { Link } from "react-router-dom";
import "./CategoryCard.css";

const CATEGORY_FALLBACK_IMAGE =
	"/images/subcategories/subcategory-placeholder.png";

function isLockedCategory(category = {}) {
	return Boolean(
		category.locked ||
			category.isLocked ||
			category.disabled ||
			category.comingSoon,
	);
}

export default function CategoryCard({
	category,
	parentCategoryId = null,
	isSubcategory = false,
	isGroup = false,
}) {
	const locked = isLockedCategory(category);

	let linkTo = category.directPath || category.path || category.href || "";

	if (!linkTo && isSubcategory && parentCategoryId) {
		linkTo = `/products/${parentCategoryId}/${category.id}`;
	} else if (!linkTo && isGroup && parentCategoryId) {
		linkTo = `/products?category=${parentCategoryId}&group=${category.id}`;
	} else if (!linkTo) {
		linkTo = `/products?category=${category.id}`;
	}

	const cardInner = (
		<div className='category-card-image-wrapper position-relative flex-row justify-content-end'>
			<img
				src={category.image || CATEGORY_FALLBACK_IMAGE}
				alt={category.name}
				className='category-image object-fit-cover w-75 align-self-start m-0'
				onError={(event) => {
					if (event.currentTarget.src.includes(CATEGORY_FALLBACK_IMAGE)) return;
					event.currentTarget.src = CATEGORY_FALLBACK_IMAGE;
				}}
			/>

			<div className='category-card-text-layer position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-start align-items-end ps-3'>
				<div>
					<h5 className='font-secondary category-name text-uppercase fw-semibold'>
						{category.name}
					</h5>
				</div>
			</div>

			{locked ? (
				<div className='category-card-locked-overlay'>
					<div className='category-card-locked-panel rounded-4 text-center'>
						<div className='category-card-locked-title text-uppercase fw-semibold'>
							{category.name}
						</div>

						<button
							type='button'
							className='category-card-locked-button rounded-3 text-uppercase'
							disabled>
							Coming Soon
						</button>
					</div>
				</div>
			) : null}
		</div>
	);

	return (
		<div
			className={`category-card rounded-4 overflow-hidden border-0 ${
				locked ? "category-card-locked" : ""
			}`}
			aria-disabled={locked ? "true" : undefined}>
			{locked ? (
				<div className='text-decoration-none text-dark'>{cardInner}</div>
			) : (
				<Link to={linkTo} className='text-decoration-none text-dark'>
					{cardInner}
				</Link>
			)}
		</div>
	);
}

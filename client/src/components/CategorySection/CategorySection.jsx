import categoriesData from "../../data/categories.json";
import CategoryCard from "../CategoryCard/CategoryCard";
import useDraftPreview from "../../hooks/useDraftPreview.js";

export default function CategorySection() {
	// Local draft preview shows the home-hidden categories too; "hidden" ones never show.
	const previewMode = useDraftPreview();
	return (
		<div className='categories p-3 p-sm-4 p-md-5 py-4 py-md-5 fade-in'>
			<h4 className='categories-title fw-regular text-main text-uppercase text-start mb-3'>
				Product Categories
			</h4>
			<div className='row g-4 justify-content-evenly'>
				{categoriesData.categories.filter((category) => !category.hidden && (previewMode || !category.homeHidden)).map((category) => (
					<div key={category.id} className='col-sm-6 col-md-3 col-xl-3'>
						<CategoryCard category={category} />
					</div>
				))}
			</div>
		</div>
	);
}

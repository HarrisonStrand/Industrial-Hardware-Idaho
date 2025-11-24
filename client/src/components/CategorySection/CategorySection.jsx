import categoriesData from "../../data/categories.json";
import CategoryCard from "../CategoryCard/CategoryCard";

export default function CategorySection() {
	return (
		<div className='categories p-4 p-md-5'>
			<h4 className='categories-title fw-regular text-main text-uppercase text-start mb-3'>
				Product Categories
			</h4>
			<div className='row g-4 justify-content-evenly'>
				{categoriesData.categories.map((category) => (
					<div key={category.id} className='col-sm-6 col-md-3 col-xl'>
						<CategoryCard category={category} />
					</div>
				))}
			</div>
		</div>
	);
}

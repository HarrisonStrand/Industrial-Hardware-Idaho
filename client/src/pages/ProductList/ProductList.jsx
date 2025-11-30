import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import categoriesData from "../../data/categories.json";
import CategoryCard from "../../components/CategoryCard/CategoryCard";
import "./ProductList.css";
import FeatureBanner from "../../components/FeatureBanner/FeatureBanner";
import { BrandContext } from "../../context/BrandContext";
import { VariableContext } from "../../context/VariableContext";

export default function ProductList() {
	const location = useLocation();
	const brand = useContext(BrandContext);
  const variables = useContext(VariableContext);

	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("");
	const [subcategory, setSubcategory] = useState("");
	const [results, setResults] = useState([]);

	// Read URL parameters
	useEffect(() => {
		const p = new URLSearchParams(location.search);
		setQuery(p.get("search")?.toLowerCase() || "");
		setCategory(p.get("category")?.toLowerCase() || "");
		setSubcategory(p.get("subcategory")?.toLowerCase() || "");
	}, [location.search]);

	// MAIN FILTER LOGIC
	useEffect(() => {
		// SEARCH MODE
		if (query) {
			const q = query.toLowerCase();
			const matched = [];

			categoriesData.categories.forEach((cat) => {
				const catMatch = cat.name.toLowerCase().includes(q);

				const subMatches = cat.subcategories.filter((sub) =>
					sub.name.toLowerCase().includes(q)
				);

				if (catMatch || subMatches.length > 0) {
					matched.push({
						...cat,
						subcategories:
							subMatches.length > 0 ? subMatches : cat.subcategories,
					});
				}
			});

			setResults(matched);
			return;
		}

		// CATEGORY → SHOW SUBCATEGORIES
		if (category && !subcategory) {
			const found = categoriesData.categories.find(
				(c) => c.id.toLowerCase() === category
			);
			setResults(found ? [found] : []);
			return;
		}

		// DEFAULT → SHOW CATEGORIES
		setResults(categoriesData.categories);
	}, [query, category, subcategory]);

	const showCategories = !query && !category;
	const showSubcategories = !query && category && !subcategory;
	const showSearchResults = query.length > 0;

	return (
		<>
			<div className='categories p-4 p-md-5 py-4 py-md-5'>
				{/* CATEGORY VIEW */}
				{showCategories && (
					<>
						<h4 className='categories-title fw-regular text-main text-uppercase text-start mb-3'>
							Browse Categories
						</h4>
						<div className='row g-4 justify-content-evenly'>
							{results.map((cat) => (
								<div key={cat.id} className='col-sm-6 col-md-6 col-lg-3'>
									<CategoryCard category={cat} />
								</div>
							))}
						</div>
					</>
				)}

				{/* SUBCATEGORY VIEW */}
				{showSubcategories && results.length > 0 && (
					<>
						<h4 className='categories-title fw-regular text-main text-uppercase text-start mb-3'>
							{results[0].name}
						</h4>
						<div className='row g-4 justify-content-evenly'>
							{results[0].subcategories.map((sub) => (
								<div key={sub.id} className='col-sm-6 col-md-6 col-lg-3'>
									<CategoryCard
										category={sub}
										parentCategoryId={results[0].id}
										isSubcategory={true}
									/>
								</div>
							))}
						</div>
					</>
				)}

				{/* SEARCH RESULTS */}
				{showSearchResults && (
					<>
						<h4 className='categories-title fw-regular text-main text-uppercase text-start mb-3'>
							Search results for “{query}”
						</h4>

						{results.length > 0 ? (
							results.map((cat) => (
								<div key={cat.id} className='mb-5'>
									<h4 className='fw-bold text-main'>{cat.name}</h4>
									<div className='row g-4 mt-3 mb-4'>
										{cat.subcategories.map((sub) => (
											<div key={sub.id} className='col-sm-6 col-md-6 col-lg-3'>
												<CategoryCard
													category={sub}
													parentCategoryId={cat.id}
													isSubcategory={true}
												/>
											</div>
										))}
									</div>
								</div>
							))
						) : (
							<p className='text-muted text-center'>
								No categories match your search.
							</p>
						)}
					</>
				)}
			</div>
			<div className='contact-banner-container m-5 align-items-center d-flex row justify-content-center m-auto pb-5 py-0 pb-xl-5 px-0 px-lg-5'>
				<div className='main-linebreak border-0 border-top border-main py-2'></div>
				<div className='contact-banner-title fs-3 text-main text-center text-uppercase mb-3'>
					{variables.contactBannerTitle}
				</div>
				<div className="contact-banner-card row align-items-center justify-content-evenly rounded-4 border border-3 border-main py-2 py-xl-3 px-xl-3 fw-semibold">
					<div className="col-12 col-xl-5 align-items-center contact-banner-left text-main text-uppercase fs-4 text-start py-1 py-xl-0 px-lg-0 px-xl-2">
						{variables.contactBannerLeft} <i className="fs-5 px-1 bi bi-telephone"/> {brand.phone}
					</div>
					<div className="col-12 col-xl-7 align-items-center contact-banner-right text-main text-uppercase fs-4 text-end py-1 py-xl-0 px-lg-0 px-xl-2">
						{variables.contactBannerRight} <i className="fs-5 px-1 bi bi-envelope-open"/> {brand.email}
					</div>
				</div>
			</div>
			<FeatureBanner />
		</>
	);
}

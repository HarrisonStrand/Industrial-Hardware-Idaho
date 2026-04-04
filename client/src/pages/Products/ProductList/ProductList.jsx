import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import categoriesUI from "../../../data/categories.json";
import CategoryCard from "../../../components/CategoryCard/CategoryCard.jsx";
import "./ProductList.css";
import FeatureBanner from "../../../components/FeatureBanner/FeatureBanner.jsx";
import ContactBanner from "../../../components/ContactBanner/ContactBanner.jsx";

function formatTitle(value = "") {
	return String(value)
		.replace(/-/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ProductList() {
	const location = useLocation();

	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("");

	useEffect(() => {
		const p = new URLSearchParams(location.search);
		setQuery((p.get("search") || "").trim().toLowerCase());
		setCategory((p.get("category") || "").trim().toLowerCase());
	}, [location.search]);

	const selectedCategory = useMemo(() => {
		if (!category) return null;

		return (
			categoriesUI.categories.find(
				(cat) => String(cat.id).toLowerCase() === category,
			) || null
		);
	}, [category]);

	const searchResults = useMemo(() => {
		if (!query) return [];

		const q = query.toLowerCase();

		return categoriesUI.categories
			.map((cat) => {
				const catName = String(cat.name || "").toLowerCase();
				const catId = String(cat.id || "").toLowerCase();

				const categoryMatches = catName.includes(q) || catId.includes(q);

				const matchingSubs = (cat.subcategories || []).filter((sub) => {
					const subName = String(sub.name || "").toLowerCase();
					const subId = String(sub.id || "").toLowerCase();
					return subName.includes(q) || subId.includes(q);
				});

				if (categoryMatches) {
					return {
						...cat,
						subcategories: cat.subcategories || [],
					};
				}

				if (matchingSubs.length) {
					return {
						...cat,
						subcategories: matchingSubs,
					};
				}

				return null;
			})
			.filter(Boolean);
	}, [query]);

	const showUICategories = !query && !category;
	const showSubcategories = !query && !!category;
	const showSearchResults = !!query;

	return (
		<>

			<div className='categories p-4 p-md-5 py-4 py-md-5'>
				{showUICategories && (
					<>
						<h4 className='categories-title fw-regular text-main text-uppercase text-start mb-3'>
							Browse Categories
						</h4>

						<div className='row g-4 justify-content-evenly'>
							{categoriesUI.categories.map((cat) => (
								<div key={cat.id} className='col-sm-6 col-md-6 col-lg-3'>
									<CategoryCard category={cat} />
								</div>
							))}
						</div>
					</>
				)}

				{showSubcategories && (
					<>
						<h4 className='categories-title fw-regular text-main text-uppercase text-start mb-3'>
							{selectedCategory?.name || formatTitle(category)}
						</h4>

						{selectedCategory?.subcategories?.length ? (
							<div className='row g-4 justify-content-evenly'>
								{selectedCategory.subcategories.map((sub) => (
									<div key={sub.id} className='col-sm-6 col-md-6 col-lg-3'>
										<CategoryCard
											category={sub}
											parentCategoryId={selectedCategory.id}
											isSubcategory
										/>
									</div>
								))}
							</div>
						) : (
							<p className='text-muted text-center'>
								No subcategories found for this category.
							</p>
						)}
					</>
				)}

				{showSearchResults && (
					<>
						<h4 className='categories-title fw-regular text-main text-uppercase text-start mb-3'>
							Search results for “{query}”
						</h4>

						{searchResults.length > 0 ? (
							searchResults.map((cat) => (
								<div key={cat.id} className='mb-5'>
									<h4 className='fw-bold text-main'>{cat.name}</h4>

									<div className='row g-4 mt-3 mb-4'>
										{(cat.subcategories || []).map((sub) => (
											<div
												key={sub.id}
												className='col-sm-6 col-md-6 col-lg-3'>
												<CategoryCard
													category={sub}
													parentCategoryId={cat.id}
													isSubcategory
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

			<ContactBanner />
			<FeatureBanner />
		</>
	);
}
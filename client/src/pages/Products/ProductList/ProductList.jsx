import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import categoriesUI from "../../../data/categories.json";
import CategoryCard from "../../../components/CategoryCard/CategoryCard.jsx";
import { fetchGlobalSearch } from "../../../services/searchApi.js";
import "./ProductList.css";
import FeatureBanner from "../../../components/FeatureBanner/FeatureBanner.jsx";
import ContactBanner from "../../../components/ContactBanner/ContactBanner.jsx";

function formatTitle(value = "") {
	return String(value)
		.replace(/-/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCategoryCardFromBuilder(item = {}) {
	return {
		id: item.subcategoryId || item.categoryId || item.path || item.label,
		name: item.name || item.label || "Builder",
		image: item.image || "/images/subcategories/subcategory-placeholder.png",
		path: item.path || "/products",
	};
}

function ProductSearchCard({ item }) {
	return (
		<Link
			to={item.path || "/products"}
			className='product-search-card rounded-4 overflow-hidden text-decoration-none h-100 d-flex flex-column'>
			<div className='product-search-card-image d-flex align-items-center justify-content-center'>
				{item.image ? (
					<img src={item.image} alt={item.title} />
				) : (
					<div className='product-search-card-placeholder text-muted'>
						<i className='bi bi-box-seam fs-2' />
					</div>
				)}
			</div>

			<div className='product-search-card-body p-3 d-flex flex-column flex-grow-1'>
				<div className='small text-muted text-uppercase fw-semibold mb-1'>
					{item.partNumber || item.matchLabel || "Product"}
				</div>

				<h5 className='product-search-card-title text-main fw-semibold mb-2'>
					{item.title}
				</h5>

				<div className='product-search-card-meta small text-muted mb-2'>
					{[item.category, item.subcategory].filter(Boolean).join(" / ")}
				</div>

				{item.attributes?.length > 0 ? (
					<div className='d-flex flex-wrap gap-2 mt-auto'>
						{item.attributes.slice(0, 4).map((attribute) => (
							<span key={attribute} className='product-search-chip rounded-pill px-2 py-1'>
								{attribute}
							</span>
						))}
					</div>
				) : null}
			</div>
		</Link>
	);
}

export default function ProductList() {
	const location = useLocation();

	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("");
	const [globalResults, setGlobalResults] = useState({
		products: [],
		builders: [],
		totals: { products: 0, builders: 0 },
	});
	const [loadingSearch, setLoadingSearch] = useState(false);
	const [searchError, setSearchError] = useState("");

	useEffect(() => {
		const p = new URLSearchParams(location.search);
		setQuery((p.get("search") || "").trim());
		setCategory((p.get("category") || "").trim().toLowerCase());
	}, [location.search]);

	useEffect(() => {
		if (!query || query.length < 2) {
			setGlobalResults({
				products: [],
				builders: [],
				totals: { products: 0, builders: 0 },
			});
			setLoadingSearch(false);
			setSearchError("");
			return;
		}

		const controller = new AbortController();

		async function loadSearchResults() {
			try {
				setLoadingSearch(true);
				setSearchError("");

				const data = await fetchGlobalSearch(query, {
					productLimit: 48,
					builderLimit: 24,
					signal: controller.signal,
				});

				setGlobalResults({
					products: Array.isArray(data?.products) ? data.products : [],
					builders: Array.isArray(data?.builders) ? data.builders : [],
					totals: data?.totals || { products: 0, builders: 0 },
				});
			} catch (error) {
				if (error?.name === "AbortError") return;
				console.error("Product search failed:", error);
				setSearchError("Search is unavailable right now.");
			} finally {
				if (!controller.signal.aborted) setLoadingSearch(false);
			}
		}

		loadSearchResults();

		return () => controller.abort();
	}, [query]);

	const selectedCategory = useMemo(() => {
		if (!category) return null;

		return (
			categoriesUI.categories.find(
				(cat) => String(cat.id).toLowerCase() === category,
			) || null
		);
	}, [category]);

	const localCategorySearchResults = useMemo(() => {
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

	const builderResults = useMemo(() => {
		if (globalResults.builders.length > 0) return globalResults.builders;

		return localCategorySearchResults.flatMap((cat) =>
			(cat.subcategories || []).map((sub) => ({
				type: "builder",
				label: `${cat.name} / ${sub.name}`,
				name: sub.name,
				categoryId: cat.id,
				subcategoryId: sub.id,
				image: sub.image || cat.image || "",
				path: `/products/${cat.id}/${sub.id}`,
			})),
		);
	}, [globalResults.builders, localCategorySearchResults]);

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

						{loadingSearch && (
							<p className='text-muted text-center py-4'>Searching products…</p>
						)}

						{!loadingSearch && searchError && (
							<div className='alert alert-warning rounded-4'>{searchError}</div>
						)}

						{!loadingSearch && !searchError && globalResults.products.length > 0 && (
							<div className='mb-5'>
								<div className='d-flex justify-content-between align-items-end gap-3 mb-3'>
									<h4 className='fw-bold text-main mb-0'>Matching Products</h4>
									<div className='small text-muted'>
										{globalResults.products.length} result
										{globalResults.products.length === 1 ? "" : "s"}
									</div>
								</div>

								<div className='row g-4'>
									{globalResults.products.map((item) => (
										<div key={item.productId} className='col-sm-6 col-lg-4 col-xxl-3'>
											<ProductSearchCard item={item} />
										</div>
									))}
								</div>
							</div>
						)}

						{!loadingSearch && !searchError && builderResults.length > 0 && (
							<div className='mb-5'>
								<h4 className='fw-bold text-main'>Matching Builders / Categories</h4>

								<div className='row g-4 mt-3 mb-4'>
									{builderResults.map((item) => (
										<div key={item.path} className='col-sm-6 col-md-6 col-lg-3'>
											<CategoryCard category={normalizeCategoryCardFromBuilder(item)} />
										</div>
									))}
								</div>
							</div>
						)}

						{!loadingSearch &&
							!searchError &&
							globalResults.products.length === 0 &&
							builderResults.length === 0 && (
								<p className='text-muted text-center'>
									No products or categories match your search.
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

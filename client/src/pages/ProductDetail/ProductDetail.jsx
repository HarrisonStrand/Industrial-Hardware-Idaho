import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import categoriesData from "../../data/product-parameters.json";
import skuData from "../../data/product-skus.json";
import { useCart } from "../../context/CartContext";
import "./ProductDetail.css";

export default function ProductDetail() {
	const { categoryId, subcategoryId } = useParams();
	const { addToCart, openCart } = useCart();

	const [subcategory, setSubcategory] = useState(null);

	const halfWidthFields = ["quantity", "brand"];
	const needsHalfWidthFields = ["washers", "nuts"].includes(
		categoryId?.toLowerCase()
	);

	const [selected, setSelected] = useState({
		measurement: "",
		drive_type: "",
		thread: "",
		quantity: "",
		finish: "",
		grade: "",
		diameter: "",
		length: "",
		type: "",
	});

	// --------------------------------------------------
	// LOAD SUBCATEGORY
	// --------------------------------------------------
	useEffect(() => {
		const category = categoriesData.categories.find(
			(c) => c.id.toLowerCase() === categoryId.toLowerCase()
		);

		if (!category) {
			setSubcategory(null);
			return;
		}

		const sub = category.subcategories.find(
			(s) => s.id.toLowerCase() === subcategoryId.toLowerCase()
		);

		setSubcategory(sub || null);
	}, [categoryId, subcategoryId]);

	// --------------------------------------------------
	// ALL SKUS FOR THIS SUBCATEGORY
	// --------------------------------------------------
	const subcategorySkus = useMemo(() => {
		if (!subcategory) return [];
		return skuData.filter((sku) => sku.subcategory === subcategory.id);
	}, [subcategory]);

	// --------------------------------------------------
	// FILTER VALID OPTIONS BASED ON CURRENT SELECTION
	// --------------------------------------------------
	const validOptions = useMemo(() => {
		const options = {};
		if (!subcategory) return options;

		const filteredSkus = subcategorySkus.filter((sku) =>
			Object.entries(selected).every(([key, val]) => {
				if (!val || key === "quantity") return true;
				return sku.attributes[key] === val;
			})
		);

		Object.keys(subcategory.attributes).forEach((key) => {
			options[key] = [
				...new Set(
					filteredSkus.map((sku) => sku.attributes[key]).filter(Boolean)
				),
			];
		});

		return options;
	}, [selected, subcategory, subcategorySkus]);

	// --------------------------------------------------
	// FIND MATCHING SKU
	// --------------------------------------------------
	const matchingSku = useMemo(() => {
		if (!subcategory) return null;

		return subcategorySkus.find((sku) =>
			Object.entries(selected).every(([key, val]) => {
				if (!val || key === "quantity") return true;
				return sku.attributes[key] === val;
			})
		);
	}, [selected, subcategory, subcategorySkus]);

	// --------------------------------------------------
	// HANDLERS
	// --------------------------------------------------
	const handleChange = (attr, value) => {
		setSelected((prev) => ({ ...prev, [attr]: value }));
	};

	const handleAddToCart = () => {
		if (!matchingSku) {
			alert("Invalid product configuration.");
			return;
		}

		addToCart(matchingSku.partNumber, Number(selected.quantity || 1));

		openCart(); // 👈 THIS triggers App drawer
	};

	// --------------------------------------------------
	// SAFE EARLY RETURN
	// --------------------------------------------------
	if (!subcategory) {
		return <h2 className='text-center mt-5'>Product not found.</h2>;
	}

	const attributes = subcategory.attributes || {};

	// --------------------------------------------------
	// RENDER
	// --------------------------------------------------
	return (
		<div className='product-detail container-fluid px-3 px-sm-5 py-4 py-md-5'>
			<div className='product-detail-container py-4 product-detail fade-in rounded-4 px-3 px-sm-5'>
				<div className='product-title text-center text-main fs-1 py-3 text-uppercase'>
					{subcategory.name}
				</div>

				<div className='product-description-card row p-3 rounded-4 m-0'>
					{/* IMAGE */}
					<div className='col-12 col-lg-4'>
						<div className='product-image-card rounded-4 overflow-hidden'>
							<img
								src={subcategory.image}
								alt={subcategory.name}
								className='product-image'
							/>
						</div>
					</div>

					<div className='col-12 col-lg-4'>
						<div className='product-description rounded-4 overflow-hidden'>
							<div className='description-title text-main text-decoration-underline fs-3 text-uppercase'>
								Description
							</div>
							<div className='description-copy fs-5 text-main'>
								{subcategory.description}
							</div>
						</div>
					</div>
				</div>

				{/* OPTIONS */}
				<div className='product-choices row py-4 m-0'>
					<div className='text-main text-uppercase mb-1 fs-4 px-0'>
						Product Details
					</div>
					<div className='main-linebreak border-0 border-top border-main py-2' />

					<div className='row m-0 p-0'>
						{Object.entries(attributes)
							.filter(
								([_, values]) => Array.isArray(values) && values.length > 0
							)
							.map(([key, values]) => {
								const label = key.replace(/_/g, " ");
								const options = validOptions[key] || values;

								return (
									<div
										key={key}
										className={
											needsHalfWidthFields && halfWidthFields.includes(key)
												? "mb-3 col-6 col-sm-4 col-md-2"
												: "mb-3 col-12 col-sm-6 col-md-4"
										}>
										<label className='form-label text-uppercase small fw-bold mb-0 text-main'>
											{label}
										</label>

										<select
											className='form-select option-select'
											value={selected[key]}
											onChange={(e) => handleChange(key, e.target.value)}>
											<option value=''>Select {label}</option>
											{options.map((v) => (
												<option key={v} value={v}>
													{v}
												</option>
											))}
										</select>
									</div>
								);
							})}

						{/* QUANTITY */}
						<div
							className={
								needsHalfWidthFields
									? "mb-3 col-6 col-sm-4 col-md-2"
									: "mb-3 col-12 col-sm-6 col-md-4"
							}>
							<label className='form-label text-uppercase small fw-bold mb-0 text-main'>
								Quantity
							</label>
							<input
								type='number'
								min='1'
								className='form-control option-select'
								value={selected.quantity}
								onChange={(e) => handleChange("quantity", e.target.value)}
								placeholder='Enter quantity'
							/>
						</div>
					</div>
				</div>

				<div className='main-linebreak border-0 border-top border-main py-2 w-75 mx-auto' />

				<div className='row bottom-price-row'>
					<div className='col-4' />

					<div className='col-4 text-center'>
						<button
							className='btn-main-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main-light'
							onClick={handleAddToCart}
							disabled={!matchingSku || !selected.quantity}>
							Add to Cart
						</button>
					</div>

					<div className='col-4 price-container text-end fs-1 text-main'>
						{matchingSku && selected.quantity
							? `$${(matchingSku.price * Number(selected.quantity)).toFixed(2)}`
							: "$0.00"}
						<div className='fs-6 text-muted'>
					{matchingSku && selected.quantity 
					? `$${matchingSku.price.toFixed(2)} each`
					: "$0.00"}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

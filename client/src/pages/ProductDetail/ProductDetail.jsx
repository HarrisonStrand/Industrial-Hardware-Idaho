import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import categoriesData from "../../data/product-parameters.json";
import "./ProductDetail.css";

export default function ProductDetail() {
	const { categoryId, subcategoryId } = useParams();
	const [subcategory, setSubcategory] = useState({});
	const halfWidthFields = ["quantity", "brand"];
	const needsHalfWidthFields = ["washers", "nuts"].includes(categoryId.toLowerCase());

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

	useEffect(() => {
		const category = categoriesData.categories.find(
			(c) => c.id.toLowerCase() === categoryId.toLowerCase()
		);

		if (!category) return;

		const sub = category.subcategories.find(
			(s) => s.id.toLowerCase() === subcategoryId.toLowerCase()
		);

		if (sub) setSubcategory(sub);
	}, [categoryId, subcategoryId]);

	if (!subcategory) {
		return <h2 className='text-center mt-5'>Product not found.</h2>;
	}

	const attributes = subcategory.attributes || {};

	const handleChange = (attr, value) => {
		setSelected((prev) => ({ ...prev, [attr]: value }));
	};

	const handleAddToCart = () => {
		console.log("Adding to cart:", {
			subcategory: subcategory.id,
			...selected,
		});

		alert("Product added to cart!");
	};

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
					<div className='main-linebreak border-0 border-top border-main py-2'></div>

					<div className='row m-0 p-0'>
						{/* INPUT TYPES */}
						{Object.entries(attributes).map(([key, values]) => {
							const label = key.replace(/_/g, " ");

							// Render field logic
							const renderField = () => {
								if (key === "quantity") {
									return (
										<input
											type='number'
											min='1'
											className='form-control option-select'
											value={selected.quantity}
											onChange={(e) => handleChange("quantity", e.target.value)}
											placeholder='Enter quantity'
										/>
									);
								}

								const safeValues = Array.isArray(values) ? values : [];

								return (
									<select
										className='form-select option-select'
										value={selected[key]}
										onChange={(e) => handleChange(key, e.target.value)}>
										<option value=''>Select {label}</option>
										{safeValues.map((v) => (
											<option key={v} value={v}>
												{v}
											</option>
										))}
									</select>
								);
							};

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
									{renderField()}
								</div>
							);
						})}
					</div>
				</div>

				<div className='main-linebreak border-0 border-top border-main py-2 w-75 mx-auto'></div>
				<div className='row bottom-price-row'>
					<div className='col-4'></div>
					<div className='col-4 text-center'>
						<button
							className='btn-main-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main-light'
							onClick={handleAddToCart}
							disabled={Object.values(selected).includes("")}>
							Add to Cart
						</button>
					</div>
					<div className='col-4 price-container text-end fs-1 text-main'>
						$0.00
					</div>
				</div>
			</div>
		</div>
	);
}

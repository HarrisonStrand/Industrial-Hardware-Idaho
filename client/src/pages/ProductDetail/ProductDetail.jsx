import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import categoriesData from "../../data/categories.json";
import "./ProductDetail.css";

export default function ProductDetail() {
	const { categoryId, subcategoryId } = useParams();
	const [subcategory, setSubcategory] = useState(null);

	const [selected, setSelected] = useState({
		finish: "",
		grade: "",
		quantity: "",
		thread_pitch: "",
		diameter: "",
		length: "",
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
			<div className='product-detail-container product-detail fade-in rounded-4 px-3 px-sm-5'>
					<div className='product-title text-center text-main fs-1 py-3 text-uppercase'>
						{subcategory.name}
					</div>
				<div className='product-description-card row p-3 rounded-4'>
					{/* IMAGE */}
					<div className='col-12 col-lg-4'>
						<div className='product-image-card rounded-4 overflow-hidden'>
							<img
								src={subcategory.image}
								alt={subcategory.name}
								className='w-100 h-100 object-fit-cover'
							/>
						</div>
					</div>
					<div className='col-12 col-lg-4'>
						<div className='product-description rounded-4 overflow-hidden'>
              <div className="description-title text-main text-decoration-underline fs-3 text-uppercase">
                Description
              </div>
              <div className="description-copy fs-5 text-main">
                here is the description of the part
              </div>
						</div>
					</div>
				</div>

				{/* OPTIONS */}
				<div className='product-choices row py-4'>

						<div className='text-main text-uppercase mb-1 fs-4 px-0'>
							Product Details
						</div>
            <div className='main-linebreak border-0 border-top border-main py-2'></div>

					<div className='row px-0'>
						{/* DROPDOWNS */}
						{Object.entries(attributes).map(([key, values]) => (
							<div key={key} className='mb-3 col-12 col-sm-6 col-md-4'>
								<label className='form-label text-uppercase small fw-bold mb-0 text-main'>
									{key.replace("_", " ")}
								</label>
                {/* ADD MAPPING HERE WITH INPUT TYPE */}
								<select
									className='form-select option-select'
									value={selected[key]}
									onChange={(e) => handleChange(key, e.target.value)}>
									<option value=''>Select {key.replace("_", " ")}</option>
									{values.map((v) => (
										<option key={v} value={v}>
											{v}
										</option>
									))}
								</select>
							</div>
						))}
					</div>
				</div>
        <div className="row justify-content-center align-items-center">
            <div className='main-linebreak border-0 border-top border-main py-2 w-75 mx-auto'></div>
						<button
							className='btn-main px-4 py-2 mt-3 shadow'
							onClick={handleAddToCart}
							disabled={Object.values(selected).includes("")}>
							Add to Cart
						</button>
              </div>
			</div>
		</div>
	);
}

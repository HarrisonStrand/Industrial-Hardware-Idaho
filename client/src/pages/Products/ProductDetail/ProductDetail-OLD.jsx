import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useCart } from "../../../context/CartContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { fetchCatalogBuilderSubcategory } from "../../../services/catalogBuilderApi.js";
import "./ProductDetail.css";

export default function ProductDetail() {
	const { categoryId, subcategoryId } = useParams();
	const { addToCart, cartItemCount } = useCart();
	const { showToast } = useToast();
	const navigate = useNavigate();

	const [builderData, setBuilderData] = useState(null);
	const [loading, setLoading] = useState(true);

	const [selected, setSelected] = useState({
		measurementSystem: "",
		drive_type: "",
		threadPitch: "",
		quantity: "",
		finish: "",
		grade: "",
		diameter: "",
		length: "",
		fastenerType: "",
		material: "",
	});

	const halfWidthFields = ["quantity", "brand"];
	const needsHalfWidthFields = ["washers", "nuts"].includes(
		categoryId?.toLowerCase()
	);

	useEffect(() => {
		let alive = true;

		async function load() {
			try {
				setLoading(true);
				const data = await fetchCatalogBuilderSubcategory(categoryId, subcategoryId);
				if (!alive) return;
				setBuilderData(data);
			} catch (error) {
				console.error("Failed to load builder data:", error);
				if (alive) setBuilderData(null);
			} finally {
				if (alive) setLoading(false);
			}
		}

		load();
		return () => {
			alive = false;
		};
	}, [categoryId, subcategoryId]);

	const variants = builderData?.variants || [];
	const attributes = builderData?.attributes || {};

	const validOptions = useMemo(() => {
		const options = {};
		if (!variants.length) return options;

		const filteredVariants = variants.filter((variant) =>
			Object.entries(selected).every(([key, val]) => {
				if (!val || key === "quantity") return true;
				return String(variant.attributes?.[key] || "") === String(val);
			})
		);

		Object.keys(attributes).forEach((key) => {
			options[key] = [
				...new Set(
					filteredVariants
						.map((variant) => variant.attributes?.[key])
						.filter(Boolean)
				),
			];
		});

		return options;
	}, [selected, attributes, variants]);

	const matchingVariant = useMemo(() => {
		if (!variants.length) return null;

		return (
			variants.find((variant) =>
				Object.entries(selected).every(([key, val]) => {
					if (!val || key === "quantity") return true;
					return String(variant.attributes?.[key] || "") === String(val);
				})
			) || null
		);
	}, [selected, variants]);

	const handleChange = (attr, value) => {
		setSelected((prev) => ({ ...prev, [attr]: value }));
	};

	const handleAddToCart = () => {
		if (!matchingVariant) {
			alert("Invalid product configuration.");
			return;
		}

		const qty = Math.max(1, Number(selected.quantity || 1));

		addToCart({
			productId: matchingVariant.productId,
			vendorOfferingId: matchingVariant.vendorOfferingId || null,
			quantity: qty,
			partNumber: matchingVariant.partNumber,
			sku: matchingVariant.sku,
			title: matchingVariant.name,
			image: matchingVariant.image,
			attributes: matchingVariant.attributes || {},
			price: Number(matchingVariant.price || 0),
			category: builderData?.categoryId || "",
			subcategory: builderData?.subcategoryId || "",
			vendorName: matchingVariant.vendorName || "",
			vendorPartNumber: matchingVariant.vendorPartNumber || "",
			shortDescription: matchingVariant.shortDescription || "",
		});

		showToast({
			message: qty > 1 ? `Added ${qty} items to cart` : "Added to cart",
			variant: "success",
			actionLabel: "View Cart",
			onAction: () => navigate("/cart"),
			duration: 4000,
		});
	};

	if (loading) {
		return <h2 className="text-center mt-5">Loading product…</h2>;
	}

	if (!builderData || !variants.length) {
		return <h2 className="text-center mt-5">Product not found.</h2>;
	}

	const displayImage = matchingVariant?.image || builderData.image || "";
	const displayName = matchingVariant?.name || builderData.name || subcategoryId;
	const displayDescription =
		matchingVariant?.description || builderData.description || "";

	return (
		<div className="theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5">
			<div className="theme-detail-container py-4 theme-detail fade-in rounded-4 px-3 px-sm-5">
				<div className="theme-title text-center text-main fs-1 py-3 text-uppercase">
					{displayName}
				</div>

				<div className="product-description-card row p-3 rounded-4 m-0">
					<div className="col-12 col-lg-4">
						<div className="product-image-card rounded-4 overflow-hidden">
							{displayImage ? (
								<img
									src={displayImage}
									alt={displayName}
									className="product-image"
								/>
							) : (
								<div className="p-4 text-center text-muted">No image available</div>
							)}
						</div>
					</div>

					<div className="col-12 col-lg-4">
						<div className="product-description rounded-4 overflow-hidden">
							<div className="description-title text-main text-decoration-underline fs-3 text-uppercase">
								Description
							</div>
							<div className="description-copy fs-5 text-main">
								{displayDescription}
							</div>
						</div>
					</div>
				</div>

				<div className="product-choices row py-4 m-0">
					<div className="text-main text-uppercase mb-1 fs-4 px-0">
						Product Details
					</div>
					<div className="main-linebreak border-0 border-top border-main py-2" />

					<div className="row m-0 p-0">
						{Object.entries(attributes)
							.filter(([_, values]) => Array.isArray(values) && values.length > 0)
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
										}
									>
										<label className="form-label text-uppercase small fw-bold mb-0 text-main">
											{label}
										</label>

										<select
											className="product-option-dropdown form-select form-control rounded-3 text-secondary option-select form-input"
											value={selected[key] || ""}
											onChange={(e) => handleChange(key, e.target.value)}
										>
											<option value="">Select {label}</option>
											{options.map((v) => (
												<option key={v} value={v}>
													{v}
												</option>
											))}
										</select>
									</div>
								);
							})}

						<div
							className={
								needsHalfWidthFields
									? "mb-3 col-6 col-sm-4 col-md-2"
									: "mb-3 col-12 col-sm-6 col-md-4"
							}
						>
							<label className="form-label text-uppercase small fw-bold mb-0 text-main">
								Quantity
							</label>

							<div className="position-relative">
								<input
									type="number"
									min="1"
									className="form-control rounded-3 text-secondary option-select form-input pe-4"
									value={selected.quantity}
									onChange={(e) => handleChange("quantity", e.target.value)}
									placeholder="Enter quantity"
								/>

								<div className="quantity-arrows d-flex flex-column pe-3">
									<i
										className="bi bi-chevron-up"
										onClick={() =>
											handleChange("quantity", Math.max(1, Number(selected.quantity || 0) + 1))
										}
									/>
									<i
										className="bi bi-chevron-down"
										onClick={() =>
											handleChange(
												"quantity",
												Math.max(1, Number(selected.quantity || 1) - 1)
											)
										}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="main-linebreak border-0 border-top border-main py-2 w-75 mx-auto" />

				<div className="row bottom-price-row">
					<div className="col-12 col-md-4" />

					<div className="col-12 col-md-4 text-center">
						<div className="d-flex justify-content-center align-items-center gap-4">
							<button
								className="btn-main-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main-light"
								onClick={handleAddToCart}
								disabled={!matchingVariant || !selected.quantity}
							>
								Add to Cart
							</button>

							{cartItemCount > 0 && (
								<button
									className="btn-main-cta btn-secondary-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main"
									onClick={() => navigate("/cart")}
									type="button"
								>
									View Cart
								</button>
							)}
						</div>
					</div>

					<div className="col-12 col-md-4 price-container text-end fs-1 text-main font-secondary pt-3 pt-md-0">
						{matchingVariant && selected.quantity
							? `$${(Number(matchingVariant.price || 0) * Number(selected.quantity)).toFixed(2)}`
							: "$0.00"}
						<div className="fs-6 text-muted">
							{matchingVariant
								? `$${Number(matchingVariant.price || 0).toFixed(2)} each`
								: "$0.00"}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
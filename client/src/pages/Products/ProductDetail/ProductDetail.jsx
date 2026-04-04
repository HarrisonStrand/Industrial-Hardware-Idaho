import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useCart } from "../../../context/CartContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { fetchCatalogBuilderSubcategory } from "../../../services/catalogBuilderApi.js";
import "./ProductDetail.css";

function parseFraction(value = "") {
	const str = String(value).trim();

	if (!str) return null;

	if (/^\d+\/\d+$/.test(str)) {
		const [num, den] = str.split("/").map(Number);
		return den ? num / den : null;
	}

	if (/^\d+\s+\d+\/\d+$/.test(str)) {
		const [whole, frac] = str.split(" ");
		const [num, den] = frac.split("/").map(Number);
		return den ? Number(whole) + num / den : null;
	}

	if (/^\d+(\.\d+)?$/.test(str)) {
		return Number(str);
	}

	return null;
}

function sortOptionValues(values = [], key = "") {
	const lower = key.toLowerCase();

	if (["diameter", "length"].includes(lower)) {
		return [...values].sort((a, b) => {
			const aNum = parseFraction(a);
			const bNum = parseFraction(b);

			if (aNum !== null && bNum !== null) return aNum - bNum;

			return String(a).localeCompare(String(b), undefined, {
				numeric: true,
				sensitivity: "base",
			});
		});
	}

	return [...values].sort((a, b) =>
		String(a).localeCompare(String(b), undefined, {
			numeric: true,
			sensitivity: "base",
		})
	);
}

function formatAttributeLabel(key = "") {
	const labelMap = {
		fastenerType: "Bolt Type",
		measurementSystem: "Measurement System",
		threadPitch: "Thread Pitch",
		drive_type: "Drive Type",
		diameter: "Diameter",
		length: "Length",
		finish: "Finish",
		grade: "Grade",
		material: "Material",
		size: "Size",
	};

	if (labelMap[key]) return labelMap[key];

	return String(key)
		.replace(/_/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function flattenVariants(builderData) {
	if (Array.isArray(builderData?.families) && builderData.families.length > 0) {
		return builderData.families.flatMap((family) =>
			Array.isArray(family?.variants) ? family.variants : []
		);
	}

	return Array.isArray(builderData?.variants) ? builderData.variants : [];
}

function collectAttributesFromVariants(variants = []) {
	const map = new Map();

	for (const variant of variants) {
		const attrs = variant?.attributes || {};

		for (const [key, value] of Object.entries(attrs)) {
			if (
				value === undefined ||
				value === null ||
				value === "" ||
				[
					"fishbowlPartNum",
					"sku",
					"internalPartNumber",
					"familyKey",
					"familySlug",
					"familyTitle",
					"familyAttributeOptions",
				].includes(key)
			) {
				continue;
			}

			if (!map.has(key)) {
				map.set(key, new Set());
			}

			map.get(key).add(String(value));
		}
	}

	const result = {};
	for (const [key, values] of map.entries()) {
		result[key] = sortOptionValues(Array.from(values), key);
	}

	return result;
}

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
		size: "",
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

				const data = await fetchCatalogBuilderSubcategory(
					categoryId,
					subcategoryId
				);

				if (!alive) return;

				setBuilderData(data);

				setSelected({
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
					size: "",
				});
			} catch (error) {
				console.error("Failed to load builder data:", error);
				if (alive) {
					setBuilderData(null);
				}
			} finally {
				if (alive) setLoading(false);
			}
		}

		load();

		return () => {
			alive = false;
		};
	}, [categoryId, subcategoryId]);

	const variants = useMemo(() => flattenVariants(builderData), [builderData]);

	const attributes = useMemo(() => {
		if (builderData?.attributes && Object.keys(builderData.attributes).length > 0) {
			const cleaned = {};

			for (const [key, values] of Object.entries(builderData.attributes)) {
				if (
					[
						"familyKey",
						"familySlug",
						"familyTitle",
						"familyAttributeOptions",
						"fishbowlPartNum",
						"sku",
						"internalPartNumber",
					].includes(key)
				) {
					continue;
				}

				cleaned[key] = Array.isArray(values)
					? sortOptionValues(values, key)
					: [];
			}

			return cleaned;
		}

		return collectAttributesFromVariants(variants);
	}, [builderData, variants]);

	const hasSelectedOptions = useMemo(() => {
		return Object.entries(selected).some(
			([key, value]) => key !== "quantity" && Boolean(value)
		);
	}, [selected]);

	const validOptions = useMemo(() => {
		const options = {};
		if (!variants.length) return options;

		Object.keys(attributes).forEach((key) => {
			const possibleValues = new Set();

			for (const candidate of variants) {
				const candidateValue = candidate.attributes?.[key];
				if (!candidateValue) continue;

				const matchesOtherSelections = Object.entries(selected).every(
					([selectedKey, selectedVal]) => {
						if (selectedKey === "quantity") return true;
						if (selectedKey === key) return true;
						if (!selectedVal) return true;

						return (
							String(candidate.attributes?.[selectedKey] || "") ===
							String(selectedVal)
						);
					}
				);

				if (matchesOtherSelections) {
					possibleValues.add(String(candidateValue));
				}
			}

			const collected = Array.from(possibleValues);
			options[key] = collected.length
				? sortOptionValues(collected, key)
				: sortOptionValues(attributes[key] || [], key);
		});

		return options;
	}, [selected, attributes, variants]);

	const matchingVariant = useMemo(() => {
		if (!variants.length) return null;

		const selectedKeys = Object.entries(selected)
			.filter(([key, value]) => key !== "quantity" && Boolean(value))
			.map(([key]) => key);

		if (!selectedKeys.length) return null;

		return (
			variants.find((variant) =>
				selectedKeys.every(
					(key) =>
						String(variant.attributes?.[key] || "") ===
						String(selected[key] || "")
				)
			) || null
		);
	}, [selected, variants]);

	const handleChange = (attr, value) => {
		setSelected((prev) => ({ ...prev, [attr]: value }));
	};

	const handleAddToCart = () => {
		if (!matchingVariant) {
			showToast({
				message: "Please select a valid product configuration.",
				variant: "danger",
			});
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
		return <h2 className='text-center mt-5'>Loading product…</h2>;
	}

	if (!builderData || !variants.length) {
		return <h2 className='text-center mt-5'>Product not found.</h2>;
	}

	const displayImage = matchingVariant?.image || builderData?.image || "";

	const displayName =
		hasSelectedOptions && matchingVariant?.name
			? matchingVariant.name
			: builderData?.name || subcategoryId;

	const displayDescription =
		matchingVariant?.description || builderData?.description || "";

	return (
		<div className='theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5'>
			<div className='theme-detail-container py-4 theme-detail fade-in rounded-4 px-3 px-sm-5'>
				<div className='theme-title text-center text-main fs-1 py-3 text-uppercase'>
					{displayName}
				</div>

				<div className='product-description-card row p-3 rounded-4 m-0'>
					<div className='col-12 col-lg-4'>
						<div className='product-image-card rounded-4 overflow-hidden'>
							{displayImage ? (
								<img
									src={displayImage}
									alt={displayName}
									className='product-image'
								/>
							) : (
								<div className='p-4 text-center text-muted'>
									No image available
								</div>
							)}
						</div>
					</div>

					<div className='col-12 col-lg-4'>
						<div className='product-description rounded-4 overflow-hidden'>
							<div className='description-title text-main text-decoration-underline fs-3 text-uppercase'>
								Description
							</div>
							<div className='description-copy fs-5 text-main'>
								{displayDescription}
							</div>
						</div>
					</div>
				</div>

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
							.filter(([key]) => (validOptions[key] || []).length > 0)
							.map(([key, values]) => {
								const label = formatAttributeLabel(key);
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
											className='product-option-dropdown form-select form-control rounded-3 text-secondary option-select form-input'
											value={selected[key] || ""}
											onChange={(e) =>
												handleChange(key, e.target.value)
											}>
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

						<div
							className={
								needsHalfWidthFields
									? "mb-3 col-6 col-sm-4 col-md-2"
									: "mb-3 col-12 col-sm-6 col-md-4"
							}>
							<label className='form-label text-uppercase small fw-bold mb-0 text-main'>
								Quantity
							</label>

							<div className='position-relative'>
								<input
									type='number'
									min='1'
									className='form-control rounded-3 text-secondary option-select form-input pe-4'
									value={selected.quantity}
									onChange={(e) =>
										handleChange("quantity", e.target.value)
									}
									placeholder='Enter quantity'
								/>

								<div className='quantity-arrows d-flex flex-column pe-3'>
									<i
										className='bi bi-chevron-up'
										onClick={() =>
											handleChange(
												"quantity",
												Math.max(1, Number(selected.quantity || 0) + 1)
											)
										}
									/>
									<i
										className='bi bi-chevron-down'
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

				<div className='main-linebreak border-0 border-top border-main py-2 w-75 mx-auto' />

				<div className='row bottom-price-row'>
					<div className='col-12 col-md-4' />

					<div className='col-12 col-md-4 text-center'>
						<div className='d-flex justify-content-center align-items-center gap-4'>
							<button
								className='btn-main-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main-light'
								onClick={handleAddToCart}
								disabled={!matchingVariant || !selected.quantity}>
								Add to Cart
							</button>

							{cartItemCount > 0 && (
								<button
									className='btn-main-cta btn-secondary-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main'
									onClick={() => navigate("/cart")}
									type='button'>
									View Cart
								</button>
							)}
						</div>
					</div>

					<div className='col-12 col-md-4 price-container text-end fs-1 text-main font-secondary pt-3 pt-md-0'>
						{matchingVariant && selected.quantity
							? `$${(
									Number(matchingVariant.price || 0) *
									Number(selected.quantity)
							  ).toFixed(2)}`
							: "$0.00"}
						<div className='fs-6 text-muted'>
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
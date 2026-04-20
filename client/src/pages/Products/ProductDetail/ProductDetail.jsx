import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { useCart } from "../../../context/CartContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { fetchCatalogBuilderSubcategory } from "../../../services/catalogBuilderApi.js";
import "./ProductDetail.css";

const HIDDEN_ATTRIBUTE_KEYS = new Set([
	"fishbowlPartNum",
	"sku",
	"internalPartNumber",
	"familyKey",
	"familySlug",
	"familyTitle",
	"familyTitleBase",
	"familyType",
	"familyAttributeOptions",
	"displayMaterial",
	"displayFinish",
	"insideDiameter",
	"outsideDiameter",
	"size",
	"material",
	"finish",
]);

const ATTRIBUTE_ORDER = [
	"measurementSystem",
	"washerStandard",
	"washerType",
	"materialFinish",
	"diameter",
	"width",
	"grade",
	"thickness",
	"threadPitch",
	"length",
	"drive_type",
	"fastenerType",
];

const INITIAL_SELECTED_STATE = {
	measurementSystem: "",
	washerStandard: "",
	washerType: "",
	materialFinish: "",
	drive_type: "",
	threadPitch: "",
	quantity: 1,
	grade: "",
	diameter: "",
	width: "",
	thickness: "",
	length: "",
	fastenerType: "",
};

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
	const lower = String(key || "").toLowerCase();

	if (["diameter", "length", "width", "thickness"].includes(lower)) {
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
		}),
	);
}

function inferProductFamilyLabelContext(builderData = {}, variants = []) {
	const subcategory = String(builderData?.subcategoryId || "").toLowerCase();
	const category = String(builderData?.categoryId || "").toLowerCase();

	const familyType =
		variants.find((variant) => variant?.attributes?.familyType)?.attributes
			?.familyType || "";

	const combined = `${category} ${subcategory} ${familyType}`.toLowerCase();

	if (combined.includes("washer")) return "washer";
	if (combined.includes("nut")) return "nut";
	if (combined.includes("pin")) return "pin";
	if (combined.includes("abrasive")) return "abrasive";
	if (combined.includes("bolt") || combined.includes("screw"))
		return "fastener";

	return "generic";
}

function shouldHideAttributeForContext(
	key = "",
	context = "generic",
	subcategoryId = "",
) {
	const sub = String(subcategoryId || "").toLowerCase();

	if (context === "washer" && key === "length") return true;
	if (context === "washer" && key === "fastenerType") return true;

	if (sub === "fender washers" && key === "washerStandard") return true;
	if (sub === "fender washers" && key === "washerType") return true;

	if (sub === "flat washers" && key === "washerType") return true;
	if (sub === "lock washers" && key === "washerStandard") return true;
	if (sub === "lock washers" && key === "width") return true;

	return false;
}

function formatAttributeLabel(key = "", context = "generic") {
	const baseMap = {
		measurementSystem: "Measurement System",
		threadPitch: "Thread Pitch",
		drive_type: "Drive Type",
		diameter: "Diameter",
		width: "Width",
		length: "Length",
		thickness: "Thickness",
		grade: "Grade",
		washerStandard: "Standard",
		washerType: "Type",
		materialFinish: "Material / Finish",
	};

	if (baseMap[key]) return baseMap[key];

	return String(key)
		.replace(/_/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCurrency(value = 0, currency = "USD") {
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency || "USD",
		}).format(Number(value || 0));
	} catch {
		return `$${Number(value || 0).toFixed(2)}`;
	}
}

function collectAttributesFromVariants(variants = [], context = "generic") {
	const map = new Map();

	for (const variant of variants) {
		const attrs = variant?.attributes || {};

		for (const [key, value] of Object.entries(attrs)) {
			if (
				value === undefined ||
				value === null ||
				value === "" ||
				HIDDEN_ATTRIBUTE_KEYS.has(key) ||
				shouldHideAttributeForContext(key, context)
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

function getOrderedAttributeEntries(attributes = {}) {
	return Object.entries(attributes)
		.filter(([_, values]) => Array.isArray(values) && values.length > 0)
		.sort(([a], [b]) => {
			const aIndex = ATTRIBUTE_ORDER.indexOf(a);
			const bIndex = ATTRIBUTE_ORDER.indexOf(b);

			if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
			if (aIndex === -1) return 1;
			if (bIndex === -1) return -1;
			return aIndex - bIndex;
		});
}

function variantMatchesSelection(variant, selection = {}) {
	const attrs = variant?.attributes || {};

	return Object.entries(selection).every(([key, value]) => {
		if (key === "quantity") return true;
		if (!value) return true;
		return String(attrs[key] || "") === String(value);
	});
}

function getCompatibleVariants(variants = [], selection = {}) {
	return variants.filter((variant) =>
		variantMatchesSelection(variant, selection),
	);
}

function getAllowedValuesForKey(variants = [], selection = {}, key = "") {
	const values = new Set();

	for (const variant of variants) {
		const attrs = variant?.attributes || {};

		const matchesOtherSelections = Object.entries(selection).every(
			([selKey, selValue]) => {
				if (selKey === "quantity") return true;
				if (selKey === key) return true;
				if (!selValue) return true;
				return String(attrs[selKey] || "") === String(selValue);
			},
		);

		if (!matchesOtherSelections) continue;

		const candidate = attrs[key];
		if (candidate !== undefined && candidate !== null && candidate !== "") {
			values.add(String(candidate));
		}
	}

	return Array.from(values);
}

function buildAutofilledSelection(
	baseSelection = {},
	variant = {},
	keys = [],
	manualKeys = new Set(),
) {
	const next = { ...baseSelection };
	const attrs = variant?.attributes || {};

	for (const key of keys) {
		if (manualKeys.has(key)) continue;
		if (!next[key] && attrs[key]) {
			next[key] = String(attrs[key]);
		}
	}

	return next;
}

function hasAnyRealSelection(selected = {}) {
	return Object.entries(selected).some(
		([key, value]) => key !== "quantity" && Boolean(value),
	);
}

function getGenericDisplayName(builderData, subcategoryId) {
	return builderData?.name || String(subcategoryId || "").replace(/-/g, " ");
}

export default function ProductDetail() {
	const { categoryId, subcategoryId } = useParams();
	const { addToCart, cartItemCount } = useCart();
	const { showToast } = useToast();
	const navigate = useNavigate();

	const [builderData, setBuilderData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [selected, setSelected] = useState(INITIAL_SELECTED_STATE);

	const hasUserMadeSelectionRef = useRef(false);
	const manualKeysRef = useRef(new Set());

	useEffect(() => {
		let alive = true;

		async function load() {
			try {
				setLoading(true);
				const data = await fetchCatalogBuilderSubcategory(
					categoryId,
					subcategoryId,
				);

				if (!alive) return;

				setBuilderData(data);
				setSelected(INITIAL_SELECTED_STATE);
				hasUserMadeSelectionRef.current = false;
				manualKeysRef.current = new Set();
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

	const variants = useMemo(() => {
		return Array.isArray(builderData?.variants) ? builderData.variants : [];
	}, [builderData]);

	const labelContext = useMemo(() => {
		return inferProductFamilyLabelContext(builderData, variants);
	}, [builderData, variants]);

	const attributes = useMemo(() => {
		const topLevel = builderData?.attributes || {};
		const cleaned = {};

		for (const [key, values] of Object.entries(topLevel)) {
			if (HIDDEN_ATTRIBUTE_KEYS.has(key)) continue;
			if (
				shouldHideAttributeForContext(
					key,
					labelContext,
					builderData?.subcategoryId,
				)
			)
				continue;

			if (Array.isArray(values) && values.length > 0) {
				cleaned[key] = sortOptionValues(values, key);
			}
		}

		if (Object.keys(cleaned).length > 0) return cleaned;
		return collectAttributesFromVariants(
			variants.filter(Boolean).map((variant) => ({
				...variant,
				attributes: Object.fromEntries(
					Object.entries(variant.attributes || {}).filter(
						([key]) =>
							!shouldHideAttributeForContext(
								key,
								labelContext,
								builderData?.subcategoryId,
							),
					),
				),
			})),
			labelContext,
		);
	}, [builderData, variants, labelContext]);

	const attributeEntries = useMemo(() => {
		return getOrderedAttributeEntries(attributes);
	}, [attributes]);

	const visibleKeys = useMemo(() => {
		return attributeEntries.map(([key]) => key);
	}, [attributeEntries]);

	const dropdownOptions = useMemo(() => {
		const options = {};

		for (const [key, values] of attributeEntries) {
			options[key] = sortOptionValues(values, key).map((value) => ({
				value,
			}));
		}

		return options;
	}, [attributeEntries]);

	const validVariants = useMemo(() => {
		if (!variants.length) return [];
		return getCompatibleVariants(variants, selected);
	}, [variants, selected]);

	const exactVariant = useMemo(() => {
		if (!hasAnyRealSelection(selected)) return null;
		return validVariants[0] || null;
	}, [selected, validVariants]);

	const quantity = Math.max(1, Number(selected.quantity || 1));
	const displayVariant = exactVariant || null;

	const displayName =
		displayVariant?.name || getGenericDisplayName(builderData, subcategoryId);
	const displayImage = displayVariant?.image || builderData?.image || "";
	const displayDescription =
		displayVariant?.description || builderData?.description || "";

	const unitPrice = Number(displayVariant?.price || 0);
	const currency = displayVariant?.currency || "USD";
	const totalPrice = unitPrice * quantity;
	const qtyAvailable = Number(displayVariant?.qtyAvailable || 0);

	const handleChange = (attr, value) => {
		setSelected((prev) => {
			if (attr === "quantity") {
				return {
					...prev,
					quantity: Math.max(1, Number(value || 1)),
				};
			}

			hasUserMadeSelectionRef.current = true;

			if (attr === "measurementSystem") {
				return {
					...INITIAL_SELECTED_STATE,
					quantity: prev.quantity || 1,
					measurementSystem: value,
				};
			}

			return {
				...prev,
				[attr]: value,
			};
		});
	};

	const handleAddToCart = () => {
		if (!displayVariant) {
			showToast({
				message: "Please select a valid product configuration.",
				variant: "danger",
			});
			return;
		}

		addToCart({
			productId: displayVariant.productId,
			quantity,
			partNumber: displayVariant.partNumber,
			sku: displayVariant.sku,
			slug: displayVariant.slug || "",
			title: displayVariant.name,
			image: displayVariant.image,
			attributes: displayVariant.attributes || {},
			price: Number(displayVariant.price || 0),
			category: builderData?.categoryId || "",
			subcategory: builderData?.subcategoryId || "",
			shortDescription: displayVariant.shortDescription || "",
			metadata: {
				source: "catalog-builder",
				duplicateCount: displayVariant.duplicateCount || 1,
				groupedPartNumbers: displayVariant.groupedPartNumbers || [],
			},
		});

		showToast({
			message:
				quantity > 1 ? `Added ${quantity} items to cart` : "Added to cart",
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

	return (
		<div className='theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5'>
			<div className='theme-detail-container py-4 theme-detail fade-in rounded-4 px-3 px-sm-5'>
				<div className='theme-title text-center text-main fs-1 py-3 text-uppercase'>
					{displayName}
				</div>

				<div className='product-description-card row p-3 rounded-4 m-0'>
					<div className='col-12 col-lg-4 mb-4 mb-lg-0'>
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

					<div className='col-12 col-lg-4 mb-4 mb-lg-0'>
						<div className='product-description rounded-4 overflow-hidden'>
							<div className='description-title text-main text-decoration-underline fs-3 text-uppercase'>
								Description
							</div>
							<div className='description-copy fs-5 text-main'>
								{displayDescription}
							</div>
						</div>
					</div>

					<div className='col-12 col-lg-4'>
						<div className='product-description rounded-4 overflow-hidden'>
							<div className='description-title text-main text-decoration-underline fs-3 text-uppercase'>
								Pricing & Availability
							</div>

							<div className='description-copy fs-5 text-main'>
								<div>
									<strong>Our Price:</strong>{" "}
									{displayVariant
										? `${formatCurrency(unitPrice, currency)} each`
										: "Select options"}
								</div>

								<div className='mt-2'>
									<strong>Status:</strong>{" "}
									{displayVariant
										? displayVariant.inStock
											? "Available"
											: "Available on request"
										: "Select options"}
								</div>

								<div className='mt-2'>
									<strong>Available Qty:</strong>{" "}
									{displayVariant ? qtyAvailable : "Select options"}
								</div>

								<div className='mt-2'>
									<strong>Part Number:</strong>{" "}
									{displayVariant?.partNumber || "Select options"}
								</div>
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
						{attributeEntries.map(([key]) => {
							const label = formatAttributeLabel(key, labelContext);
							const options = dropdownOptions[key] || [];

							return (
								<div key={key} className='mb-3 col-12 col-sm-6 col-md-4'>
									<label className='form-label text-uppercase small fw-bold mb-0 text-main'>
										{label}
									</label>

									<select
										className='product-option-dropdown form-select form-control rounded-3 text-secondary option-select form-input'
										value={selected[key] || ""}
										onChange={(e) => handleChange(key, e.target.value)}>
										<option value=''>Select {label}</option>
										{options.map((option) => (
											<option key={option.value} value={option.value}>
												{option.value}
											</option>
										))}
									</select>
								</div>
							);
						})}

						<div className='mb-3 col-12 col-sm-6 col-md-4'>
							<label className='form-label text-uppercase small fw-bold mb-0 text-main'>
								Quantity
							</label>

							<div className='position-relative'>
								<input
									type='number'
									min='1'
									className='form-control rounded-3 text-secondary option-select form-input pe-4'
									value={selected.quantity}
									onChange={(e) => handleChange("quantity", e.target.value)}
									placeholder='Enter quantity'
								/>

								<div className='quantity-arrows d-flex flex-column pe-3'>
									<i
										className='bi bi-chevron-up'
										onClick={() =>
											handleChange(
												"quantity",
												Math.max(1, Number(selected.quantity || 1) + 1),
											)
										}
									/>
									<i
										className='bi bi-chevron-down'
										onClick={() =>
											handleChange(
												"quantity",
												Math.max(1, Number(selected.quantity || 1) - 1),
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
					<div className='col-12 col-md-4'>
						<div className='small text-main'>
							{hasAnyRealSelection(selected)
								? `${validVariants.length} valid matching option${
										validVariants.length === 1 ? "" : "s"
									}`
								: `${variants.length} total variants available`}
						</div>
					</div>

					<div className='col-12 col-md-4 text-center'>
						<div className='d-flex justify-content-center align-items-center gap-4'>
							<button
								className='btn-main-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main-light'
								onClick={handleAddToCart}
								disabled={!displayVariant}>
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
						{displayVariant ? formatCurrency(totalPrice, currency) : "--"}
						<div className='fs-6 text-muted'>
							{displayVariant
								? `${formatCurrency(unitPrice, currency)} each`
								: "Select options for pricing"}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

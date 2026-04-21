import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
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

function getDisplayQuantityValue(value) {
	return value === "" || value === null || value === undefined
		? ""
		: String(value);
}

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
	selected = {},
) {
	const sub = String(subcategoryId || "").toLowerCase();
	const measurementSystem = String(
		selected?.measurementSystem || "",
	).toLowerCase();

	if (context === "washer" && key === "length") return true;
	if (context === "washer" && key === "fastenerType") return true;

	if (measurementSystem === "metric" && key === "washerStandard") return true;

	if (sub === "fender washers" && key === "washerStandard") return true;
	if (sub === "fender washers" && key === "washerType") return true;

	if (sub === "flat washers" && key === "washerType") return true;
	if (sub === "lock washers" && key === "washerStandard") return true;
	if (sub === "lock washers" && key === "width") return true;

	return false;
}

function formatAttributeLabel(key = "") {
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

function collectAttributesFromVariants(
	variants = [],
	context = "generic",
	subcategoryId = "",
	selected = {},
) {
	const map = new Map();

	for (const variant of variants) {
		const attrs = variant?.attributes || {};

		for (const [key, value] of Object.entries(attrs)) {
			if (
				value === undefined ||
				value === null ||
				value === "" ||
				HIDDEN_ATTRIBUTE_KEYS.has(key) ||
				shouldHideAttributeForContext(key, context, subcategoryId, selected)
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

function hasAnyRealSelection(selected = {}) {
	return Object.entries(selected).some(
		([key, value]) => key !== "quantity" && Boolean(value),
	);
}

function getGenericDisplayName(builderData, subcategoryId) {
	return builderData?.name || String(subcategoryId || "").replace(/-/g, " ");
}

function FacetOptionCard({ label, selected = false, count = null, onClick }) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={`w-100 text-start rounded-4 p-3 ${
				selected ? "option-box-selected" : "option-box border-secondary-subtle"
			}`}>
			<div className='fw-semibold text-main text-uppercase'>{label}</div>
			{count !== null ? (
				<div className='small text-muted mt-1'>{count} matching</div>
			) : null}
		</button>
	);
}

function SelectedPathSummary({ selected = {}, attributeEntries = [] }) {
	const chips = attributeEntries
		.map(([key]) => ({
			key,
			label: formatAttributeLabel(key),
			value: selected[key] || "",
		}))
		.filter((item) => item.value);

	if (!chips.length) {
		return <div className='text-muted small'>No filters selected yet.</div>;
	}

	return (
		<div className='d-flex flex-wrap gap-2'>
			{chips.map((chip) => (
				<span
					key={chip.key}
					className='badge rounded-pill text-bg-light border px-3 py-2'>
					{chip.label}: {chip.value}
				</span>
			))}
		</div>
	);
}

function getSectionOpenState(attributeEntries = [], selected = {}) {
	const state = {};
	let unlocked = true;

	for (const [key] of attributeEntries) {
		state[key] = unlocked;
		if (!selected[key]) unlocked = false;
	}

	return state;
}

export default function ProductDetailFacetPanel() {
	const { categoryId, subcategoryId } = useParams();
	const { addToCart, cartItemCount } = useCart();
	const [showViewCartCta, setShowViewCartCta] = useState(false);
	const { showToast } = useToast();
	const navigate = useNavigate();

	const [builderData, setBuilderData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [selected, setSelected] = useState(INITIAL_SELECTED_STATE);
	const [expandedSections, setExpandedSections] = useState({});
	const [activeSectionKey, setActiveSectionKey] = useState("");
	const [detailOffset, setDetailOffset] = useState(0);
	const [isResettingBuilder, setIsResettingBuilder] = useState(false);

	const sectionRefs = useRef({});
	const highlightTimeoutRef = useRef(null);
	const detailCardRef = useRef(null);
	const builderCardRef = useRef(null);

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
				setActiveSectionKey("");
				setDetailOffset(0);
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
			if (highlightTimeoutRef.current) {
				clearTimeout(highlightTimeoutRef.current);
			}
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
					selected,
				)
			) {
				continue;
			}

			if (Array.isArray(values) && values.length > 0) {
				cleaned[key] = sortOptionValues(values, key);
			}
		}

		if (Object.keys(cleaned).length > 0) return cleaned;

		return collectAttributesFromVariants(
			variants,
			labelContext,
			builderData?.subcategoryId,
			selected,
		);
	}, [builderData, variants, labelContext, selected]);

	const attributeEntries = useMemo(() => {
		return getOrderedAttributeEntries(attributes);
	}, [attributes]);

	const filteredAttributeEntries = useMemo(() => {
		return attributeEntries
			.map(([key, values]) => {
				const allowedValues = sortOptionValues(
					getAllowedValuesForKey(variants, selected, key),
					key,
				);
				return [key, allowedValues.length ? allowedValues : values];
			})
			.filter(([_, values]) => values.length > 0);
	}, [attributeEntries, variants, selected]);

	useEffect(() => {
		const progressive = getSectionOpenState(filteredAttributeEntries, selected);
		setExpandedSections((prev) => ({ ...progressive, ...prev }));
	}, [filteredAttributeEntries, selected]);

	const validVariants = useMemo(() => {
		if (!variants.length) return [];
		return getCompatibleVariants(variants, selected);
	}, [variants, selected]);

	const exactVariant = useMemo(() => {
		if (!hasAnyRealSelection(selected)) return null;
		return validVariants.length === 1 ? validVariants[0] : null;
	}, [selected, validVariants]);

	const previewVariant = exactVariant || validVariants[0] || null;

	const displayName =
		previewVariant?.name || getGenericDisplayName(builderData, subcategoryId);
	const displayImage = previewVariant?.image || builderData?.image || "";
	const displayDescription =
		previewVariant?.description || builderData?.description || "";

	const unitPrice = Number(previewVariant?.price || 0);
	const currency = previewVariant?.currency || "USD";
	const quantity = Math.max(1, Number(selected.quantity || 1));
	const totalPrice = unitPrice * quantity;
	const qtyAvailable = Number(previewVariant?.qtyAvailable || 0);

	useEffect(() => {
		const updateDetailOffset = () => {
			if (window.innerWidth < 1200) {
				setDetailOffset(0);
				return;
			}

			const builder = builderCardRef.current;
			const detail = detailCardRef.current;

			if (!builder || !detail) {
				setDetailOffset(0);
				return;
			}

			const scrollY = window.scrollY;
			const builderTop = builder.getBoundingClientRect().top + scrollY;
			const builderHeight = builder.offsetHeight;
			const detailHeight = detail.offsetHeight;
			const topGap = 16;

			const maxOffset = Math.max(0, builderHeight - detailHeight);
			const rawOffset = scrollY + topGap - builderTop;
			const nextOffset = Math.max(0, Math.min(maxOffset, rawOffset));

			setDetailOffset(nextOffset);
		};

		updateDetailOffset();

		window.addEventListener("scroll", updateDetailOffset, { passive: true });
		window.addEventListener("resize", updateDetailOffset);

		return () => {
			window.removeEventListener("scroll", updateDetailOffset);
			window.removeEventListener("resize", updateDetailOffset);
		};
	}, [
		builderData,
		filteredAttributeEntries.length,
		selected,
		displayDescription,
		displayName,
	]);

	const flashSection = (key) => {
		setActiveSectionKey(key);
		if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
		highlightTimeoutRef.current = setTimeout(() => {
			setActiveSectionKey("");
		}, 1600);
	};

	const scrollToNextSection = (attr) => {
		const keys = filteredAttributeEntries.map(([key]) => key);
		const currentIndex = keys.indexOf(attr);
		const nextKey = keys[currentIndex + 1];
		if (!nextKey) return;

		setExpandedSections((prev) => ({
			...prev,
			[nextKey]: true,
		}));

		flashSection(nextKey);

		requestAnimationFrame(() => {
			const el = sectionRefs.current[nextKey];
			if (el) {
				el.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
			}
		});
	};

	const handleSelect = (attr, value) => {
		setSelected((prev) => {
			let next;

			if (attr === "measurementSystem") {
				next = {
					...INITIAL_SELECTED_STATE,
					quantity: prev.quantity || 1,
					measurementSystem: prev.measurementSystem === value ? "" : value,
				};
			} else {
				const nextValue = prev[attr] === value ? "" : value;
				next = {
					...prev,
					[attr]: nextValue,
				};
			}

			if (next[attr]) {
				setTimeout(() => scrollToNextSection(attr), 50);
			}

			return next;
		});
	};

const handleAddToCart = () => {
	if (!exactVariant) {
		showToast({
			message: "Please narrow the selection to one exact product.",
			variant: "danger",
		});
		return;
	}

	const safeQuantity = Math.max(1, Number(selected.quantity || 1));

	addToCart({
		productId: exactVariant.productId,
		quantity: safeQuantity,
		partNumber: exactVariant.partNumber,
		sku: exactVariant.sku,
		slug: exactVariant.slug || "",
		title: exactVariant.name,
		image: exactVariant.image,
		attributes: exactVariant.attributes || {},
		price: Number(exactVariant.price || 0),
		category: builderData?.categoryId || "",
		subcategory: builderData?.subcategoryId || "",
		shortDescription: exactVariant.shortDescription || "",
		metadata: {
			source: "catalog-builder-faceted",
			duplicateCount: exactVariant.duplicateCount || 1,
			groupedPartNumbers: exactVariant.groupedPartNumbers || [],
		},
	});

	showToast({
		message:
			safeQuantity > 1
				? `Added ${safeQuantity} items to cart`
				: "Added to cart",
		variant: "success",
		duration: 4000,
	});

	setShowViewCartCta(true);
	setIsResettingBuilder(true);

	window.setTimeout(() => {
		window.scrollTo({
			top: 0,
			behavior: "smooth",
		});
	}, 120);

	window.setTimeout(() => {
		setSelected(INITIAL_SELECTED_STATE);
		setExpandedSections({});
		setActiveSectionKey("");
		setDetailOffset(0);
	}, 420);

	window.setTimeout(() => {
		setIsResettingBuilder(false);

		const firstKey = filteredAttributeEntries?.[0]?.[0];
		if (firstKey && sectionRefs.current[firstKey]) {
			sectionRefs.current[firstKey].scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
		}
	}, 760);
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
				<div className='row g-4 align-items-start'>
					<div className='col-12 col-xl-4'>
						<div
							className={`theme-section-container rounded-4 p-3 p-md-4 bg-main-light builder-reset-shell ${
								isResettingBuilder ? "builder-resetting" : ""
							}`}
							ref={builderCardRef}>
							<div className='d-flex justify-content-between align-items-start gap-3 mb-3'>
								<div>
									<div className='text-main text-uppercase fs-5'>
										Builder Panel
									</div>
									<div className='small text-muted'>
										Process-of-elimination product finder
									</div>
								</div>

								<button
									type='button'
									className='btn btn-outline-secondary btn-sm'
									onClick={() =>
										setSelected((prev) => ({
											...INITIAL_SELECTED_STATE,
											quantity: prev.quantity || 1,
										}))
									}>
									Clear
								</button>
							</div>

							<div className='mb-4'>
								<div className='small text-muted mb-2'>Selected Path</div>
								<SelectedPathSummary
									selected={selected}
									attributeEntries={filteredAttributeEntries}
								/>
							</div>

							<div className='mb-4'>
								<div className='small text-muted mb-2'>Matching Variants</div>
								<div className='fw-semibold text-main fs-5'>
									{validVariants.length}
								</div>
							</div>

							<div className='d-flex flex-column gap-3'>
								{filteredAttributeEntries.map(([key, values], index) => {
									const isOpen = expandedSections[key] ?? index === 0;
									const isActiveGlow = activeSectionKey === key;

									return (
										<div
											key={key}
											ref={(el) => {
												sectionRefs.current[key] = el;
											}}
											className={`section-box border rounded-4 overflow-hidden bg-light transition ${
												isActiveGlow
													? "shadow border-success"
													: "border-secondary-subtle"
											}`}
											style={{
												boxShadow: isActiveGlow
													? "0 0 0 4px rgba(25, 135, 84, 0.20), 0 10px 24px rgba(0,0,0,0.08)"
													: undefined,
												transition:
													"box-shadow 0.6s ease, border-color 0.6s ease",
											}}>
											<button
												type='button'
												className='w-100 d-flex justify-content-between align-items-center border-0 bg-light px-3 py-3 text-start'
												onClick={() =>
													setExpandedSections((prev) => ({
														...prev,
														[key]: !isOpen,
													}))
												}>
												<div>
													<div className='text-main text-uppercase small fw-bold'>
														{formatAttributeLabel(key)}
													</div>
													<div className='small text-muted text-capitalize'>
														{selected[key] || "Choose an option"}
													</div>
												</div>

												<span className='fs-3 text-muted'>
													{isOpen ? "−" : "+"}
												</span>
											</button>

											{isOpen ? (
												<div className='p-3'>
													<div className='row g-2'>
														{values.map((value) => {
															const count = getCompatibleVariants(variants, {
																...selected,
																[key]: value,
															}).length;

															return (
																<div
																	key={`${key}-${value}`}
																	className='col-12 col-sm-6'>
																	<FacetOptionCard
																		label={value}
																		count={count}
																		selected={selected[key] === value}
																		onClick={() => handleSelect(key, value)}
																	/>
																</div>
															);
														})}
													</div>
												</div>
											) : null}
										</div>
									);
								})}
							</div>
						</div>
					</div>

					<div className='col-12 col-xl-8 position-relative'>
						<div
							ref={detailCardRef}
							style={{
								transform: `translateY(${detailOffset}px)`,
								transition: "transform 180ms ease-out",
								willChange: "transform",
							}}>
							<div className='rounded-4 p-3 p-md-4 theme-section-container bg-main-light'>
								<div className='text-center text-main fs-2 fs-md-1 py-2 text-uppercase mb-3'>
									{displayName}
								</div>

								<div className='row g-4 align-items-start m-0'>
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

									<div className='col-12 col-lg-8'>
										<div className='d-flex flex-column gap-4'>
											<div className='product-description rounded-4 overflow-hidden'>
												<div className='text-main text-uppercase fs-4'>
													Description
												</div>
												<hr className='mt-0 bg-main text-main' />
												<div className='description-copy fs-5 text-main'>
													{displayDescription}
												</div>
											</div>

											<div className='product-description rounded-4 overflow-hidden'>
												<div className='text-main text-uppercase fs-4'>
													Product Details
												</div>
												<hr className='mt-0 bg-main text-main' />
												<div className='description-copy fs-5 text-main row d-flex justify-content-between'>
													<div className='col-12 col-md-6 py-2'>
														<strong className='fw-semibold text-uppercase fs-5'>
															Our Price:
														</strong>{" "}
														{previewVariant
															? `${formatCurrency(unitPrice, currency)} each`
															: "Select options"}
													</div>

													<div className='col-12 col-md-6 py-2'>
														<strong className='fw-semibold text-uppercase fs-5'>
															Status:
														</strong>{" "}
														{previewVariant
															? previewVariant.inStock
																? "Available"
																: "Available on request"
															: "Select options"}
													</div>

													<div className='col-12 col-md-6 py-2'>
														<strong className='fw-semibold text-uppercase fs-5'>
															Available Qty:
														</strong>{" "}
														{previewVariant ? qtyAvailable : "Select options"}
													</div>

													<div className='col-12 col-md-6 py-2'>
														<strong className='fw-semibold text-uppercase fs-5'>
															Part Number:
														</strong>{" "}
														{exactVariant?.partNumber ||
															previewVariant?.partNumber ||
															"Select options"}
													</div>

													<div className='col-12 py-2'>
														<strong className='fw-semibold text-uppercase fs-5'>
															Resolved Match:
														</strong>{" "}
														{exactVariant
															? "Exact variant found"
															: "Still narrowing"}
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>

								<hr className='bg-main' />

								<div className='row bottom-price-row align-items-center'>
									<div className='col-12 col-md-10'>
										<div className='d-flex align-items-center justify-content-center justify-content-md-end gap-3 py-1 w-100'>
											<div className='d-flex align-items-center gap-2 flex-shrink-0'>
												<label className='form-label text-uppercase small fw-bold mb-0 text-main'>
													Quantity
												</label>

												<button
													type='button'
													className='btn btn-outline-secondary'
													onClick={() =>
														setSelected((prev) => ({
															...prev,
															quantity: Math.max(
																1,
																Number(prev.quantity || 1) - 1,
															),
														}))
													}>
													−
												</button>

												<input
													type='number'
													min='1'
													className='form-control text-center flex-shrink-0'
													style={{ width: "90px" }}
													value={
														selected.quantity === ""
															? ""
															: String(selected.quantity)
													}
													onFocus={() => {
														setSelected((prev) => ({
															...prev,
															quantity:
																String(prev.quantity || "1") === "1"
																	? ""
																	: prev.quantity,
														}));
													}}
													onChange={(e) => {
														const raw = e.target.value;

														if (raw === "" || /^\d+$/.test(raw)) {
															setSelected((prev) => ({
																...prev,
																quantity: raw,
															}));
														}
													}}
													onBlur={() => {
														setSelected((prev) => ({
															...prev,
															quantity: Math.max(1, Number(prev.quantity || 1)),
														}));
													}}
												/>

												<button
													type='button'
													className='btn btn-outline-secondary'
													onClick={() =>
														setSelected((prev) => ({
															...prev,
															quantity: Math.max(
																1,
																Number(prev.quantity || 1) + 1,
															),
														}))
													}>
													+
												</button>
											</div>

											<button
												className='btn-main-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main-light flex-shrink-0'
												onClick={handleAddToCart}
												disabled={!exactVariant}>
												Add to Cart
											</button>

											{showViewCartCta && (
												<button
													className='btn-main-cta btn-secondary-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main px-3'
													onClick={() => navigate("/cart")}
													type='button'>
													View Cart
												</button>
											)}
										</div>
									</div>

									<div className='col-12 col-md-2'>
										<div className='price-container text-center text-md-end fs-1 text-main font-secondary pt-3 pt-md-0'>
											{previewVariant
												? formatCurrency(totalPrice, currency)
												: "--"}
											<div className='fs-6 text-muted'>
												{previewVariant
													? `${formatCurrency(unitPrice, currency)} each`
													: "Select options for pricing"}
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

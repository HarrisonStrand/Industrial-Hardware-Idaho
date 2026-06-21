import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCart } from "../../../context/CartContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { fetchCatalogBuilderSubcategory } from "../../../services/catalogBuilderApi.js";
import "./ProductDetail.css";
import "./ProductDetailBuilderGrid.css";

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
	"diameter",
	"threadSeries",
	"threadPitch",
	"length",
	"drive_type",
	"materialFinish",
	"grade",
	"washerStandard",
	"washerType",
	"width",
	"thickness",
	"fastenerType",
	"headType",
];

const INITIAL_SELECTED_STATE = {
	measurementSystem: "",
	diameter: "",
	threadSeries: "",
	threadPitch: "",
	length: "",
	drive_type: "",
	materialFinish: "",
	grade: "",
	washerStandard: "",
	washerType: "",
	width: "",
	thickness: "",
	fastenerType: "",
	headType: "",
	quantity: 1,
};

const DEFAULT_VISIBLE_RESULT_COUNT = 12;

function getDisplayQuantityValue(value) {
	return value === "" || value === null || value === undefined
		? ""
		: String(value);
}

const NUMBERED_DIAMETER_SIZES = new Set(["2", "3", "4", "5", "6", "8", "10", "12"]);

function parseSizeSortValue(value = "", key = "") {
	const lowerKey = String(key || "").toLowerCase();
	let str = String(value || "")
		.trim()
		.replace(/[”″]/g, '"')
		.replace(/"|in\.?$/gi, "")
		.replace(/mm$/i, "")
		.trim();

	if (!str) return null;

	const metricMatch = str.match(/^m(\d+(?:\.\d+)?)$/i);
	if (metricMatch) return { primary: Number(metricMatch[1]), secondary: 0 };

	const numberedThreadMatch = str.match(/^#?(\d+)\s*-\s*(\d+(?:\.\d+)?)$/);
	if (numberedThreadMatch && NUMBERED_DIAMETER_SIZES.has(numberedThreadMatch[1])) {
		return {
			primary: Number(numberedThreadMatch[1]) / 1000,
			secondary: Number(numberedThreadMatch[2]),
		};
	}

	str = str.replace(/^(\d+)\s*-\s*(\d+\/\d+)$/, "$1 $2");

	if (/^\d+\/\d+$/.test(str)) {
		const [num, den] = str.split("/").map(Number);
		return den ? { primary: num / den, secondary: 0 } : null;
	}

	if (/^\d+\s+\d+\/\d+$/.test(str)) {
		const [whole, frac] = str.split(/\s+/, 2);
		const [num, den] = frac.split("/").map(Number);
		return den ? { primary: Number(whole) + num / den, secondary: 0 } : null;
	}

	if (/^#\d+(?:\.\d+)?$/.test(str)) {
		return { primary: Number(str.replace(/^#/, "")) / 1000, secondary: 0 };
	}

	if (lowerKey === "diameter" && NUMBERED_DIAMETER_SIZES.has(str)) {
		return { primary: Number(str) / 1000, secondary: 0 };
	}

	if (/^\d+(?:\.\d+)?$/.test(str)) {
		return { primary: Number(str), secondary: 0 };
	}

	return null;
}

function formatThreadedNumberedDiameterLabel(value = "", variants = [], selected = {}) {
	const raw = String(value || "").trim();
	if (!raw) return raw;

	const existing = raw.match(/^#?(\d+)\s*-\s*(\d+(?:\.\d+)?)$/);
	if (existing && NUMBERED_DIAMETER_SIZES.has(existing[1])) {
		return `${existing[1]}-${existing[2]}`;
	}

	const normalizedRaw = raw.replace(/^#/, "");
	if (!NUMBERED_DIAMETER_SIZES.has(normalizedRaw)) return raw;

	const compatible = getCompatibleVariants(variants, {
		...selected,
		diameter: value,
	});

	const pitches = Array.from(
		new Set(
			compatible
				.map((variant) => String(variant?.attributes?.threadPitch || "").trim())
				.filter(Boolean),
		),
	);

	if (pitches.length !== 1) return normalizedRaw;

	return `${normalizedRaw}-${pitches[0]}`;
}

function formatFacetOptionLabel(key = "", value = "", variants = [], selected = {}) {
	if (key === "diameter") {
		return formatThreadedNumberedDiameterLabel(value, variants, selected);
	}

	return value;
}

function sortOptionValues(values = [], key = "") {
	const lower = String(key || "").toLowerCase();

	if (["diameter", "length", "width", "thickness", "threadpitch"].includes(lower)) {
		return [...values].sort((a, b) => {
			const aSort = parseSizeSortValue(a, key);
			const bSort = parseSizeSortValue(b, key);

			if (aSort && bSort) {
				if (aSort.primary !== bSort.primary) return aSort.primary - bSort.primary;
				if (aSort.secondary !== bSort.secondary) return aSort.secondary - bSort.secondary;
			}

			if (aSort && !bSort) return -1;
			if (!aSort && bSort) return 1;

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

	if (sub === "hex cap screws" && key === "headType") return true;
	if (sub === "hex cap screws" && key === "fastenerType") return true;

	return false;
}

function formatAttributeLabel(key = "") {
	const baseMap = {
		measurementSystem: "Measurement System",
		threadPitch: "Thread Pitch",
		threadSeries: "Thread Series",
		drive_type: "Drive Type",
		diameter: "Diameter",
		width: "Width",
		length: "Length",
		thickness: "Thickness",
		grade: "Grade",
		washerStandard: "Standard",
		washerType: "Type",
		materialFinish: "Material / Finish",
		headType: "Head Type",
		fastenerType: "Fastener Type",
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

function reorderAttributeEntriesForSubcategory(
	entries = [],
	subcategoryId = "",
) {
	const sub = String(subcategoryId || "").toLowerCase();
	if (sub !== "hex cap screws") return entries;

const boltOrder = [
	"measurementSystem",
	"diameter",
	"threadSeries",
	"threadPitch",
	"length",
	"drive_type",
	"materialFinish",
	"grade",
];

	return [...entries].sort(([a], [b]) => {
		const aIndex = boltOrder.indexOf(a);
		const bIndex = boltOrder.indexOf(b);

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

function getVariantKey(variant = {}) {
	return String(
		variant?.productId ||
			variant?.enrichmentId ||
			variant?.partNumber ||
			variant?.sku ||
			variant?.name ||
			"",
	);
}

const BUILDER_URL_SELECTION_KEYS = Object.keys(INITIAL_SELECTED_STATE).filter(
	(key) => key !== "quantity",
);

function normalizeProductIdentity(value = "") {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
}

function getSearchParam(searchParams, key = "") {
	return String(searchParams.get(key) || "").trim();
}

function variantIdentityValues(variant = {}) {
	const attrs = variant?.attributes || {};
	return [
		variant?.productId,
		variant?.enrichmentId,
		variant?.slug,
		variant?.partNumber,
		variant?.sku,
		variant?.internalPartNumber,
		attrs?.fishbowlPartNum,
		attrs?.sku,
		attrs?.internalPartNumber,
	]
		.filter(Boolean)
		.map(normalizeProductIdentity)
		.filter(Boolean);
}

function findVariantForSearchParams(variants = [], searchParams) {
	const identityParams = [
		getSearchParam(searchParams, "productId"),
		getSearchParam(searchParams, "enrichmentId"),
		getSearchParam(searchParams, "slug"),
		getSearchParam(searchParams, "partNumber"),
		getSearchParam(searchParams, "sku"),
		getSearchParam(searchParams, "internalPartNumber"),
	]
		.map(normalizeProductIdentity)
		.filter(Boolean);

	if (!identityParams.length) return null;

	return (
		variants.find((variant) => {
			const identities = variantIdentityValues(variant);
			return identityParams.some((param) => identities.includes(param));
		}) || null
	);
}

function buildSelectedStateFromVariant(variant = {}, searchParams) {
	const attrs = variant?.attributes || {};
	const next = {
		...INITIAL_SELECTED_STATE,
		quantity: Math.max(1, Number(getSearchParam(searchParams, "quantity") || 1)),
	};

	for (const key of BUILDER_URL_SELECTION_KEYS) {
		const value = attrs?.[key];
		if (value !== undefined && value !== null && value !== "") {
			next[key] = String(value);
		}
	}

	return next;
}

function buildSelectedStateFromSearchParams(searchParams) {
	const next = {
		...INITIAL_SELECTED_STATE,
		quantity: Math.max(1, Number(getSearchParam(searchParams, "quantity") || 1)),
	};

	for (const key of BUILDER_URL_SELECTION_KEYS) {
		const value = getSearchParam(searchParams, key);
		if (value) next[key] = value;
	}

	return next;
}


function formatModalSpecValue(value = "") {
	const raw = String(value || "").replace(/\s+/g, " ").trim();
	if (!raw) return "";

	const acronyms = new Set(["a307", "a325", "an", "f436", "hdg", "sae", "ss", "uss"]);

	return raw.replace(/\b[a-zA-Z][a-zA-Z0-9./#-]*\b/g, (word) => {
		const lower = word.toLowerCase();
		if (acronyms.has(lower)) return lower.toUpperCase();
		if (/^m\d/i.test(word)) return word.toUpperCase();
		if (/^[a-z]+\d+$/i.test(word)) return word.toUpperCase();

		return word
			.split("-")
			.map((part) => {
				if (!part) return part;
				const partLower = part.toLowerCase();
				if (acronyms.has(partLower)) return partLower.toUpperCase();
				return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
			})
			.join("-");
	});
}

function buildThreadSpecValue(attrs = {}) {
	const threadSeries = formatModalSpecValue(attrs.threadSeries || attrs.thread_series || "");
	const threadPitch = String(attrs.threadPitch || "").replace(/\s+/g, " ").trim();

	if (threadSeries && threadPitch) return `${threadSeries} - ${threadPitch}`;
	return threadSeries || threadPitch || "";
}

function buildVariantSpecRows(variant = {}, subcategoryId = "", maxRows = 18) {
	const attrs = variant?.attributes || {};
	const sub = String(subcategoryId || "").toLowerCase();

	const preferredKeys = sub.includes("abrasive")
		? [
				"measurementSystem",
				"productType",
				"size",
				"diameter",
				"width",
				"length",
				"thickness",
				"grit",
				"arborSize",
				"abrasiveMaterial",
				"wheelType",
				"attachmentStyle",
				"materialFinish",
				"material",
				"finish",
			]
		: sub.includes("driver") || sub.includes("bit")
			? [
					"productType",
					"drive_type",
					"driveType",
					"diameter",
					"length",
					"size",
					"materialFinish",
					"material",
					"finish",
					"grade",
					"brand",
				]
			: [
					"measurementSystem",
					"diameter",
					"length",
					"threadCoverage",
					"drive_type",
					"driveType",
					"headType",
					"materialFinish",
					"material",
					"finish",
					"grade",
					"washerStandard",
					"washerType",
					"size",
					"width",
					"thickness",
				];

	const hiddenSpecKeys = new Set([
		"fishbowlPartNum",
		"sku",
		"internalPartNumber",
		"familyKey",
		"familySlug",
		"familyTitle",
		"familyTitleBase",
		"familyAttributeOptions",
		"categoryCanonical",
		"subcategoryCanonical",
		"fishbowlDescription",
		"fastenerType",
		"fastenerTypeCanonical",
		"threadSeries",
		"thread_series",
		"threadPitch",
	]);

	const seen = new Set();
	const rows = [];
	const threadValue = buildThreadSpecValue(attrs);

	if (threadValue) {
		seen.add("thread");
		seen.add("threadSeries");
		seen.add("thread_series");
		seen.add("threadPitch");
		rows.push({
			key: "thread",
			label: "Thread",
			value: threadValue,
		});
	}

	const pushRow = (key) => {
		if (!key || seen.has(key) || hiddenSpecKeys.has(key)) return;
		const value = attrs[key];
		if (value === undefined || value === null || value === "") return;

		seen.add(key);
		rows.push({
			key,
			label: formatAttributeLabel(key === "driveType" ? "drive_type" : key),
			value: formatModalSpecValue(value),
		});
	};

	preferredKeys.forEach(pushRow);

	Object.keys(attrs)
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
		.forEach(pushRow);

	return rows.slice(0, maxRows);
}

function getVariantAttributeRows(variant = {}, subcategoryId = "") {
	return buildVariantSpecRows(variant, subcategoryId, 6);
}

function normalizeDisplayText(value = "") {
	return formatModalSpecValue(String(value || "").replace(/\s+/g, " ").trim());
}

function formatDimensionValue(value = "", measurementSystem = "") {
	const stringValue = String(value || "").trim();
	if (!stringValue) return "";

	if (/metric/i.test(measurementSystem || "")) {
		if (/^m\d/i.test(stringValue) || /mm$/i.test(stringValue)) return stringValue;
		return `${stringValue}mm`;
	}

	if (/"$|in\.?$/i.test(stringValue)) return stringValue;
	return `${stringValue}"`;
}

function getProductTypeLabel(variant = {}, subcategoryId = "", fallback = "Product") {
	const attrs = variant?.attributes || {};
	const sub = String(subcategoryId || "").toLowerCase();
	const rawType =
		attrs.fastenerType ||
		attrs.productType ||
		attrs.familyTitleBase ||
		attrs.familyTitle ||
		fallback;

	if (sub.includes("hex cap screws")) return "Hex Cap Screw";

	return normalizeDisplayText(String(rawType || fallback).replace(/-/g, " "));
}

function getVariantSizeLine(variant = {}) {
	const attrs = variant?.attributes || {};
	const measurementSystem = attrs.measurementSystem || "";

	const size = String(attrs.size || "").trim();
	const diameterRaw = String(attrs.diameter || "").trim();
	const widthRaw = String(attrs.width || "").trim();
	const threadPitch = String(attrs.threadPitch || "").trim();
	const lengthRaw = String(attrs.length || "").trim();

	const diameter = diameterRaw;
	const width = formatDimensionValue(widthRaw, measurementSystem);
	const length = formatDimensionValue(lengthRaw, measurementSystem);

	if (size && !diameterRaw && !widthRaw && !lengthRaw) {
		return /^m\d/i.test(size) ? size : formatDimensionValue(size, measurementSystem);
	}

	const primarySize = diameter || width;
	const diameterAlreadyIncludesThread =
		threadPitch &&
		new RegExp(`^#?\\d+\\s*-\\s*${threadPitch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i").test(primarySize);
	const diameterThread = diameterAlreadyIncludesThread
		? primarySize
		: [primarySize, threadPitch].filter(Boolean).join("-");

	if (diameterThread && length) return `${diameterThread} x ${length}`;
	if (diameterThread) return diameterThread;
	if (width && length) return `${width} x ${length}`;
	if (width) return width;
	if (length) return length;

	return size;
}

function getVariantMaterialFinishLine(variant = {}) {
	const attrs = variant?.attributes || {};
	const material = normalizeDisplayText(attrs.material || attrs.displayMaterial || "");
	const finish = normalizeDisplayText(attrs.finish || attrs.displayFinish || "");

	if (material && finish) return `${material} - ${finish}`;

	const materialFinish = normalizeDisplayText(attrs.materialFinish || "").replace(
		/\s*\/\s*/g,
		" - ",
	);

	return materialFinish;
}

function getVariantCardTitleLines(variant = {}) {
	return [
		getVariantSizeLine(variant),
		normalizeDisplayText(variant?.attributes?.grade || ""),
		getVariantMaterialFinishLine(variant),
	].filter(Boolean);
}

function getStockQuantityValue(variant = {}) {
	const value = Number(variant?.qtyAvailable || 0);
	return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatStockQuantity(value = 0) {
	const qty = Number(value || 0);

	if (!Number.isFinite(qty) || qty <= 0) return "0";

	return new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 0,
	}).format(qty);
}

function formatStockQuantityCompact(value = 0) {
	const qty = Number(value || 0);
	if (!Number.isFinite(qty) || qty <= 0) return "0";

	if (qty >= 10000) {
		const bucket = Math.floor(qty / 10000) * 10;
		return `${bucket}k+`;
	}

	return formatStockQuantity(qty);
}

function getStockLabel(variant = {}) {
	const qty = getStockQuantityValue(variant);
	if (qty > 0) return `${formatStockQuantity(qty)} available`;
	return "Available on request";
}

function getGridStockLabel(variant = {}) {
	return `${formatStockQuantityCompact(getStockQuantityValue(variant))} available`;
}

function getStockLevelClass(variant = {}) {
	const qty = getStockQuantityValue(variant);
	if (qty > 500) return "is-high";
	if (qty >= 101) return "is-medium";
	if (qty >= 1) return "is-low";
	return "is-none";
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

function SelectedPathSummary({ selected = {}, attributeEntries = [], variants = [] }) {
	const chips = attributeEntries
		.map(([key]) => ({
			key,
			label: formatAttributeLabel(key),
			value: formatFacetOptionLabel(key, selected[key] || "", variants, selected),
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
					className='badge rounded-3 text-bg-light border px-3 py-2'>
					{chip.label}: {chip.value}
				</span>
			))}
		</div>
	);
}

function ProductResultCard({
	variant,
	builderImage = "",
	subcategoryId = "",
	selected = false,
	onClick,
}) {
	const image = variant?.image || builderImage || "";
	const title = variant?.name || variant?.title || "Product option";
	const productTypeLabel = getProductTypeLabel(variant, subcategoryId, title);
	const titleLines = getVariantCardTitleLines(variant);
	const price = Number(variant?.price || 0);
	const currency = variant?.currency || "USD";

	return (
		<button
			type='button'
			onClick={onClick}
			className={`h-100 w-100 text-start rounded-4 bg-light p-0 overflow-hidden product-result-card ${
				selected ? "selected border-2" : "border-secondary-subtle"
			}`}
			style={{ transition: "box-shadow 180ms ease, border-color 180ms ease" }}>
			<div className='row g-0 h-100'>
				<div className='col-4 col-sm-12'>
					<div
						className='bg-white d-flex align-items-center justify-content-center border-bottom builder-result-card-image-shell'
						style={{ minHeight: "120px" }}>
						<span className='builder-result-card-type-label'>
							{productTypeLabel}
						</span>
						{image ? (
							<img
								src={image}
								alt={title}
								className='img-fluid p-2'
								style={{ maxHeight: "130px", objectFit: "contain" }}
							/>
						) : (
							<div className='small text-muted text-center p-3'>No image</div>
						)}
					</div>
				</div>

				<div className='col-8 col-sm-12'>
					<div className='p-3 d-flex flex-column gap-2 h-100'>
						<div className='builder-result-card-title-lines'>
							{titleLines.length ? (
								titleLines.map((line, index) => (
									<div
										key={`${getVariantKey(variant)}-title-${index}`}
										className={
											index === 0
												? "builder-result-card-title-line builder-result-card-title-line-main text-main"
												: "builder-result-card-title-line text-main"
										}>
										{line}
									</div>
								))
							) : (
								<div className='builder-result-card-title-line builder-result-card-title-line-main text-main'>
									{title}
								</div>
							)}
						</div>

						<div className='mt-auto pt-2 d-flex justify-content-between align-items-end gap-2'>
							<div>
								<div className='small text-muted'>Part #</div>
								<div className='small fw-semibold text-main'>
									{variant?.partNumber || variant?.sku || "—"}
								</div>
							</div>

							<div className='text-end'>
								<div className='fw-semibold text-main'>
									{formatCurrency(price, currency)}
								</div>
								<div className='builder-grid-stock small text-muted justify-content-end'>
									<span
										className={`builder-grid-stock-dot ${getStockLevelClass(variant)}`}
										aria-hidden='true'
									/>
									<span>{getGridStockLabel(variant)}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</button>
	);
}

function ProductResultsGrid({
	variants = [],
	builderImage = "",
	subcategoryId = "",
	selectedVariantKey = "",
	visibleCount = DEFAULT_VISIBLE_RESULT_COUNT,
	onSelectVariant,
	onShowMore,
}) {
	const visibleVariants = variants.slice(0, visibleCount);
	const remainingCount = Math.max(0, variants.length - visibleVariants.length);

	return (
		<div className='rounded-4 p-3 p-md-4 theme-section-container bg-main-light mb-4'>
			<div className='d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3'>
				<div>
					<div className='text-main text-uppercase fs-4'>Matching Products</div>
					<div className='small text-muted'>
						Click a card to preview full details and add it to cart.
					</div>
				</div>

				<div className='badge rounded-pill text-bg-light border px-3 py-2'>
					{variants.length} match{variants.length === 1 ? "" : "es"}
				</div>
			</div>

			{visibleVariants.length ? (
				<>
					<div className='row g-3'>
						{visibleVariants.map((variant) => {
							const key = getVariantKey(variant);
							return (
								<div key={key} className='col-12 col-md-6 col-xxl-4'>
									<ProductResultCard
										variant={variant}
										builderImage={builderImage}
										subcategoryId={subcategoryId}
										selected={selectedVariantKey === key}
										onClick={() => onSelectVariant?.(variant)}
									/>
								</div>
							);
						})}
					</div>

					{remainingCount > 0 ? (
						<div className='text-center mt-3'>
							<button
								type='button'
								className='btn btn-outline-secondary rounded-3 px-4'
								onClick={onShowMore}>
								Show {Math.min(DEFAULT_VISIBLE_RESULT_COUNT, remainingCount)} more
							</button>
							<div className='small text-muted mt-2'>
								{remainingCount} more matching products hidden
							</div>
						</div>
					) : null}
				</>
			) : (
				<div className='text-muted text-center py-4'>
					No products match the current filters. Clear a filter to broaden the
					results.
				</div>
			)}
		</div>
	);
}



function ProductPreviewPanel({
	variant,
	builderImage = "",
	subcategoryId = "",
	displayName = "",
	unitPrice = 0,
	currency = "USD",
	qtyAvailable = 0,
	quantity = 1,
	totalPrice = 0,
	exactVariant = null,
	showViewCartCta = false,
	onQuantityChange,
	onAddToCart,
	onViewCart,
	onOpenDetails,
}) {
	const image = variant?.image || builderImage || "";
	const title = variant?.name || variant?.title || displayName || "Product preview";
	const productTypeLabel = getProductTypeLabel(variant, subcategoryId, displayName || title);
	const titleLines = getVariantCardTitleLines(variant);
	return (
		<div className='rounded-4 p-3 p-md-4 theme-section-container bg-main-light builder-product-preview mb-4'>
			<div className='builder-product-preview-label small text-muted text-uppercase'>
				Selected Preview
			</div>
			<div className='d-flex flex-column flex-md-row align-items-md-center gap-3'>
				<div className='builder-product-preview-image bg-white rounded-4 border d-flex align-items-center justify-content-center'>
					{image ? (
						<img src={image} alt={title} className='img-fluid' />
					) : (
						<div className='small text-muted text-center p-3'>No image</div>
					)}
				</div>

				<div className='flex-grow-1 min-w-0'>
					<div className='text-main text-uppercase fs-4 lh-sm'>{productTypeLabel}</div>
					{titleLines.length ? (
						<div className='builder-product-preview-title-lines mt-1'>
							{titleLines.map((line, index) => (
								<div
									key={`${getVariantKey(variant)}-preview-title-${index}`}
									className='builder-product-preview-title-line text-main'>
									{line}
								</div>
							))}
						</div>
					) : null}
					<div className='d-flex flex-wrap gap-2 mt-2'>
						<span className='badge rounded-3 text-bg-light border fw-normal'>
							Part #: {variant?.partNumber || variant?.sku || "Select a product"}
						</span>
						<span className='badge rounded-3 text-bg-light border fw-normal'>
							{variant ? getStockLabel(variant) : "Select options"}
						</span>
						<span className='badge rounded-3 text-bg-light border fw-normal'>
							Qty: {variant ? formatStockQuantity(qtyAvailable) : "—"}
						</span>
					</div>
				</div>

				<div className='builder-product-preview-actions'>
					<div className='price-container text-main font-secondary fs-2 text-md-end mb-2'>
						{variant ? formatCurrency(totalPrice, currency) : "--"}
						<div className='fs-6 text-muted font-sans-serif'>
							{variant ? `${formatCurrency(unitPrice, currency)} each` : "Select a card for pricing"}
						</div>
					</div>

					<div className='d-flex align-items-center justify-content-md-end gap-2 mb-3'>
						<label className='form-label text-uppercase small fw-bold mb-0 text-main'>Qty</label>
						<button
							type='button'
							className='btn btn-md bg-main-light builder-detail-qty-btn'
							onClick={() => onQuantityChange?.(Math.max(1, Number(quantity || 1) - 1))}>
							−
						</button>
						<input
							type='number'
							min='1'
							className='form-control form-control-md text-center builder-detail-qty-input bg-light'
							style={{ width: "76px" }}
							value={getDisplayQuantityValue(quantity)}
							onChange={(e) => {
								const raw = e.target.value;
								if (raw === "" || /^\d+$/.test(raw)) onQuantityChange?.(raw);
							}}
							onBlur={() => onQuantityChange?.(Math.max(1, Number(quantity || 1)))}
						/>
						<button
							type='button'
							className='btn btn-md bg-main-light builder-detail-qty-btn'
							onClick={() => onQuantityChange?.(Math.max(1, Number(quantity || 1) + 1))}>
							+
						</button>
					</div>

					<div className='d-flex flex-wrap justify-content-md-end gap-2'>
						<button
							type='button'
							className='btn btn-outline-secondary rounded-3 px-3'
							disabled={!variant}
							onClick={onOpenDetails}>
							View Full Details
						</button>


						<button
							type='button'
							className='btn-main-cta rounded-3 text-uppercase text-main-light px-4 py-2'
							onClick={onAddToCart}>
							Add to Cart
						</button>

						{showViewCartCta ? (
							<button
								type='button'
								className='btn btn-outline-secondary rounded-3 px-3'
								onClick={onViewCart}>
								View Cart
							</button>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}

function ProductDetailModal({
	show = false,
	variant,
	builderImage = "",
	subcategoryId = "",
	displayName = "",
	displayDescription = "",
	unitPrice = 0,
	currency = "USD",
	qtyAvailable = 0,
	quantity = 1,
	totalPrice = 0,
	exactVariant = null,
	onClose,
	onAddToCart,
	onQuantityChange,
}) {
	const [descriptionExpanded, setDescriptionExpanded] = useState(false);
	const [modalScrollState, setModalScrollState] = useState({ atTop: true, atBottom: true });

	const updateModalScrollState = (element) => {
		if (!element) return;

		const threshold = 4;
		const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
		const scrollTop = element.scrollTop || 0;

		setModalScrollState({
			atTop: scrollTop <= threshold,
			atBottom: scrollTop >= maxScrollTop - threshold,
		});
	};

	useEffect(() => {
		if (!show) return undefined;

		const handleKeyDown = (event) => {
			if (event.key === "Escape") onClose?.();
		};

		setDescriptionExpanded(false);
		document.body.classList.add("builder-detail-modal-active");
		document.addEventListener("keydown", handleKeyDown);

		requestAnimationFrame(() => {
			document.querySelector(".builder-detail-modal")?.scrollTo?.(0, 0);
			const modalBody = document.querySelector(".builder-detail-modal-body");
			modalBody?.scrollTo?.(0, 0);
			document.querySelector(".builder-detail-description-scroll")?.scrollTo?.(0, 0);
			updateModalScrollState(modalBody);
		});

		return () => {
			document.body.classList.remove("builder-detail-modal-active");
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [show, onClose, variant]);

	if (!show || !variant) return null;

	const image = variant?.image || builderImage || "";
	const title = variant?.name || variant?.title || displayName || "Product details";
	const partNumber = variant?.partNumber || variant?.sku || "—";
	const rows = buildVariantSpecRows(variant, subcategoryId, 18);
	const fullDescription =
		variant?.description ||
		displayDescription ||
		variant?.shortDescription ||
		"Review the selected product details before adding it to your cart.";
	const descriptionText = String(fullDescription || "").trim();
	const hasLongDescription = descriptionText.length > 240;
	const descriptionClassName = `builder-detail-description-scroll ${
		descriptionExpanded ? "is-expanded" : ""
	}`;
	const modalContentClassName = `modal-content builder-detail-modal-content theme-detail-container rounded-4 overflow-hidden ${
		modalScrollState.atTop ? "is-scrolled-top" : "has-scroll-above"
	} ${modalScrollState.atBottom ? "is-scrolled-bottom" : "has-scroll-below"}`;

	return createPortal(
		<>
			<div
				className='builder-detail-modal-backdrop'
				onClick={onClose}
			/>
			<div
				className='builder-detail-modal'
				tabIndex='-1'
				role='dialog'
				aria-modal='true'
				aria-labelledby='builderProductDetailModalTitle'
				onMouseDown={(event) => {
					if (event.target === event.currentTarget) onClose?.();
				}}>
				<div className='builder-detail-modal-dialog modal-dialog modal-xl bg-secondary-light rounded-4'>
					<div className={modalContentClassName}>
						<div className='modal-header builder-detail-modal-header border-0 align-items-start'>
							<div className='pe-3'>
								<div className='small text-muted text-uppercase mb-1'>Product Details</div>
								<h5 id='builderProductDetailModalTitle' className='modal-title text-main text-uppercase mb-1'>
									{title}
								</h5>
								<div className='builder-detail-modal-part small text-muted'>Part #: {partNumber}</div>
							</div>
							<button type='button' className='btn-close' aria-label='Close' onClick={onClose} />
						</div>

						<div className='modal-body builder-detail-modal-body py-0' onScroll={(event) => updateModalScrollState(event.currentTarget)}>
							<div className='builder-detail-modal-top row g-4 align-items-stretch'>
								<div className='col-12 col-lg-4'>
									<div className='builder-detail-modal-media theme-section-container bg-main-light rounded-4 h-100 d-flex align-items-center justify-content-center'>
										{image ? (
											<img src={image} alt={title} className='builder-detail-modal-image' />
										) : (
											<div className='builder-detail-modal-empty text-muted text-center'>No image available</div>
										)}
									</div>
								</div>

								<div className='col-12 col-lg-8'>
									<div className='builder-detail-modal-info d-flex flex-column gap-4 h-100'>
										<div className='row g-3'>
											<div className='col-6 col-md-4'>
												<div className='builder-detail-stat theme-section-container bg-main-light rounded-4 p-3 h-100'>
													<div className='small text-muted text-uppercase'>Price</div>
													<div className='fw-semibold text-main'>{formatCurrency(unitPrice, currency)}</div>
													<div className='small text-muted'>each</div>
												</div>
											</div>
											<div className='col-6 col-md-4'>
												<div className='builder-detail-stat theme-section-container bg-main-light rounded-4 p-3 h-100'>
													<div className='small text-muted text-uppercase'>Available</div>
													<div className='fw-semibold text-main'>{formatStockQuantity(qtyAvailable)}</div>
													<div className='small text-muted'>{getStockLabel(variant)}</div>
												</div>
											</div>
											<div className='col-12 col-md-4'>
												<div className='builder-detail-stat theme-section-container bg-main-light rounded-4 p-3 h-100'>
													<div className='small text-muted text-uppercase'>Total</div>
													<div className='fw-semibold text-main'>{formatCurrency(totalPrice, currency)}</div>
													<div className='small text-muted'>{quantity} selected</div>
												</div>
											</div>
										</div>

										<div className='builder-detail-description-card theme-section-container bg-main-light rounded-4 p-3 p-md-4 flex-grow-1 d-flex flex-column'>
											<div className='d-flex justify-content-between align-items-center gap-3 mb-2'>
												<div className='small text-muted text-uppercase'>Product Description</div>
												{hasLongDescription ? (
													<button
														type='button'
														className='btn btn-link btn-sm p-0 text-main builder-detail-description-toggle'
														onClick={() => setDescriptionExpanded((prev) => !prev)}>
														{descriptionExpanded ? "See less" : "See more"}
													</button>
												) : null}
											</div>
											<div className={descriptionClassName}>
												<p className='text-main mb-0 builder-detail-modal-copy'>{descriptionText}</p>
											</div>
										</div>
									</div>
								</div>
							</div>

							{rows.length ? (
								<div className='builder-detail-spec-section theme-detail-container bg-main-light rounded-4 border p-3 p-md-4 my-0 my-md-4 mt-4'>
									<div className='small text-muted text-uppercase mb-3'>Specs</div>
									<div className='builder-detail-spec-grid'>
										{rows.map((row) => (
											<div key={row.key} className='builder-detail-spec theme-section-container bg-light rounded-4 border p-3'>
												<div className='small text-muted text-uppercase'>{row.label}</div>
												<div className='fw-semibold text-main'>{row.value}</div>
											</div>
										))}
									</div>
								</div>
							) : null}
						</div>
						<div className='modal-footer builder-detail-modal-footer border-0'>
							<button type='button' className='back-to-builder-btn rounded-3 px-4' onClick={onClose}>
								Back to Builder
							</button>

							<div className='builder-detail-modal-purchase text-end'>
								<div className='d-flex align-items-center justify-content-end gap-2 mb-3'>
									<label className='form-label text-uppercase small fw-bold mb-0 text-main'>Qty</label>
									<button
										type='button'
										className='btn btn-md bg-main-light builder-detail-qty-btn'
										onClick={() => onQuantityChange?.(Math.max(1, Number(quantity || 1) - 1))}>
										−
									</button>
									<input
										type='number'
										min='1'
										className='form-control form-control-md text-center builder-detail-qty-input bg-secondary-light'
										value={getDisplayQuantityValue(quantity)}
										onChange={(e) => {
											const raw = e.target.value;
											if (raw === "" || /^\d+$/.test(raw)) onQuantityChange?.(raw);
										}}
										onBlur={() => onQuantityChange?.(Math.max(1, Number(quantity || 1)))}
									/>
									<button
										type='button'
										className='btn bg-main-light btn-md builder-detail-qty-btn'
										onClick={() => onQuantityChange?.(Math.max(1, Number(quantity || 1) + 1))}>
										+
									</button>
								</div>

								<button
									type='button'
									className='btn-main-cta rounded-3 text-uppercase text-main-light px-4 py-2 w-100'
									onClick={onAddToCart}>
									Add to Cart
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>,
		document.body,
	);
}

function getSectionOpenState(attributeEntries = [], selected = {}) {
	const state = {};
	let firstOpenKey = "";

	for (const [key] of attributeEntries) {
		state[key] = false;
		if (!firstOpenKey && !selected[key]) {
			firstOpenKey = key;
		}
	}

	if (firstOpenKey) {
		state[firstOpenKey] = true;
	}

	return state;
}

function getNextAttributeKey(attributeEntries = [], currentKey = "") {
	const keys = attributeEntries.map(([key]) => key);
	const currentIndex = keys.indexOf(currentKey);
	return currentIndex >= 0 ? keys[currentIndex + 1] || "" : "";
}

function scrollElementToContainerTop(element, offset = 138) {
	if (!element || typeof window === "undefined") return;

	const top = element.getBoundingClientRect().top + window.scrollY - offset;
	window.scrollTo({
		top: Math.max(0, top),
		behavior: "smooth",
	});
}

export default function ProductDetailFacetPanel() {
	const { categoryId, subcategoryId } = useParams();
	const { addToCart, cartItemCount } = useCart();
	const [showViewCartCta, setShowViewCartCta] = useState(false);
	const { showToast } = useToast();
	const navigate = useNavigate();
	const location = useLocation();

	const [builderData, setBuilderData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [selected, setSelected] = useState(INITIAL_SELECTED_STATE);
	const [expandedSections, setExpandedSections] = useState({});
	const [activeSectionKey, setActiveSectionKey] = useState("");
	const [isResettingBuilder, setIsResettingBuilder] = useState(false);
	const [selectedVariantKey, setSelectedVariantKey] = useState("");
	const [visibleResultCount, setVisibleResultCount] = useState(DEFAULT_VISIBLE_RESULT_COUNT);
	const [showProductDetailModal, setShowProductDetailModal] = useState(false);

	const sectionRefs = useRef({});
	const selectedPreviewRef = useRef(null);
	const highlightTimeoutRef = useRef(null);
	const appliedSearchSelectionRef = useRef("");

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
				setSelectedVariantKey("");
				setShowProductDetailModal(false);
				setVisibleResultCount(DEFAULT_VISIBLE_RESULT_COUNT);
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

	useEffect(() => {
		if (!variants.length || !location.search) return;

		const searchParams = new URLSearchParams(location.search);
		const hasProductTarget = [
			"productId",
			"enrichmentId",
			"slug",
			"partNumber",
			"sku",
			"internalPartNumber",
		].some((key) => getSearchParam(searchParams, key));
		const hasSelectionTarget = BUILDER_URL_SELECTION_KEYS.some((key) =>
			getSearchParam(searchParams, key),
		);

		if (!hasProductTarget && !hasSelectionTarget) return;

		const selectionKey = `${categoryId || ""}/${subcategoryId || ""}?${location.search}`;
		if (appliedSearchSelectionRef.current === selectionKey) return;

		const matchedVariant = findVariantForSearchParams(variants, searchParams);
		const nextSelected = matchedVariant
			? buildSelectedStateFromVariant(matchedVariant, searchParams)
			: buildSelectedStateFromSearchParams(searchParams);

		if (!matchedVariant && !hasAnyRealSelection(nextSelected)) return;

		appliedSearchSelectionRef.current = selectionKey;
		setSelected(nextSelected);
		setSelectedVariantKey(matchedVariant ? getVariantKey(matchedVariant) : "");
		setExpandedSections({});
		setVisibleResultCount(DEFAULT_VISIBLE_RESULT_COUNT);
		setShowProductDetailModal(false);

		window.setTimeout(() => {
			selectedPreviewRef.current?.scrollIntoView?.({
				behavior: "smooth",
				block: "center",
				inline: "nearest",
			});
		}, 250);
	}, [variants, location.search, categoryId, subcategoryId]);

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
	return reorderAttributeEntriesForSubcategory(
		getOrderedAttributeEntries(attributes),
		builderData?.subcategoryId,
	);
}, [attributes, builderData?.subcategoryId]);

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
		setExpandedSections(getSectionOpenState(filteredAttributeEntries, selected));
	}, [filteredAttributeEntries, selected]);

	const validVariants = useMemo(() => {
		if (!variants.length) return [];
		return getCompatibleVariants(variants, selected);
	}, [variants, selected]);

	const selectedResultVariant = useMemo(() => {
		if (!selectedVariantKey) return null;
		return (
			validVariants.find(
				(variant) => getVariantKey(variant) === selectedVariantKey,
			) || null
		);
	}, [selectedVariantKey, validVariants]);

	const exactVariant = useMemo(() => {
		if (selectedResultVariant) return selectedResultVariant;
		if (!hasAnyRealSelection(selected)) return null;
		return validVariants.length === 1 ? validVariants[0] : null;
	}, [selected, selectedResultVariant, validVariants]);

	const previewVariant = exactVariant || validVariants[0] || null;

	useEffect(() => {
		setVisibleResultCount(DEFAULT_VISIBLE_RESULT_COUNT);
	}, [selected, variants.length]);

	useEffect(() => {
		if (!selectedVariantKey) return;
		const stillMatches = validVariants.some(
			(variant) => getVariantKey(variant) === selectedVariantKey,
		);
		if (!stillMatches) {
			setSelectedVariantKey("");
			setShowProductDetailModal(false);
		}
	}, [selectedVariantKey, validVariants]);

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


	const flashSection = (key) => {
		setActiveSectionKey(key);
		if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
		highlightTimeoutRef.current = setTimeout(() => {
			setActiveSectionKey("");
		}, 1600);
	};

	const scrollToNextSection = (attr) => {
		const nextKey = getNextAttributeKey(filteredAttributeEntries, attr);
		if (!nextKey) return;

		flashSection(nextKey);

		requestAnimationFrame(() => {
			const el = sectionRefs.current[nextKey];
			if (el) scrollElementToContainerTop(el);
		});
	};

	const scrollToSelectedPreview = () => {
		window.setTimeout(() => {
			const el = selectedPreviewRef.current;
			if (!el) return;

			el.scrollIntoView({
				behavior: "smooth",
				block: "center",
				inline: "nearest",
			});
		}, 0);
	};

	const handleSelect = (attr, value) => {
		setSelectedVariantKey("");
		setShowProductDetailModal(false);
		setSelected((prev) => {
			let next;
			let nextValue;

			if (attr === "measurementSystem") {
				nextValue = prev.measurementSystem === value ? "" : value;
				next = {
					...INITIAL_SELECTED_STATE,
					quantity: prev.quantity || 1,
					measurementSystem: nextValue,
				};
			} else {
				nextValue = prev[attr] === value ? "" : value;
				next = {
					...prev,
					[attr]: nextValue,
				};
			}

			const nextSectionKey = getNextAttributeKey(filteredAttributeEntries, attr);
			setExpandedSections((prevExpanded) => ({
				...prevExpanded,
				[attr]: !nextValue,
				...(nextValue && nextSectionKey ? { [nextSectionKey]: true } : {}),
			}));

			if (nextValue) {
				setTimeout(() => scrollToNextSection(attr), 340);
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
		setSelectedVariantKey("");
		setShowProductDetailModal(false);
		setVisibleResultCount(DEFAULT_VISIBLE_RESULT_COUNT);
	}, 420);

	window.setTimeout(() => {
		setIsResettingBuilder(false);

		const firstKey = filteredAttributeEntries?.[0]?.[0];
		if (firstKey && sectionRefs.current[firstKey]) {
			scrollElementToContainerTop(sectionRefs.current[firstKey]);
		}
	}, 760);
};

	const handleOpenProductDetailModal = () => {
		if (!previewVariant) return;

		setShowProductDetailModal(true);

		window.setTimeout(() => {
			document.querySelector(".builder-detail-modal")?.scrollTo?.(0, 0);
			document.querySelector(".builder-detail-modal-body")?.scrollTo?.(0, 0);
		}, 0);
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
							}`}>
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
									onClick={() => {
									setSelectedVariantKey("");
									setSelected((prev) => ({
										...INITIAL_SELECTED_STATE,
										quantity: prev.quantity || 1,
									}));
								}}>
									Clear
								</button>
							</div>

							<div className='mb-4'>
								<div className='small text-muted mb-2'>Selected Path</div>
								<SelectedPathSummary
									selected={selected}
									attributeEntries={filteredAttributeEntries}
									variants={variants}
									/>
							</div>

							<div className='mb-4'>
								<div className='small text-muted mb-2'>Matching Products</div>
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
											className={`section-box builder-accordion-section border rounded-4 overflow-hidden bg-light transition ${
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
												className='builder-accordion-header w-100 d-flex justify-content-between align-items-center border-0 bg-light px-3 py-3 text-start'
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
														{selected[key] ? formatFacetOptionLabel(key, selected[key], variants, selected) : "Choose an option"}
													</div>
												</div>

												<span
													className={`builder-plus-toggle ${isOpen ? "is-open" : ""}`}
													aria-hidden='true'>
													<span className='builder-plus-line builder-plus-line-horizontal' />
													<span className='builder-plus-line builder-plus-line-vertical' />
												</span>
											</button>

											<div className={`builder-accordion-body ${isOpen ? "is-open" : ""}`}>
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
																		label={formatFacetOptionLabel(key, value, variants, selected)}
																		count={count}
																		selected={selected[key] === value}
																		onClick={() => handleSelect(key, value)}
																	/>
																</div>
															);
														})}
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</div>

					<div className='col-12 col-xl-8 builder-results-column'>
						<div className='builder-results-sticky-zone mb-4'>
							<div className='builder-results-follow-shell'>
								<ProductResultsGrid
								variants={validVariants}
								builderImage={builderData?.image || ""}
								subcategoryId={builderData?.subcategoryId || subcategoryId}
								selectedVariantKey={selectedVariantKey}
								visibleCount={visibleResultCount}
								onSelectVariant={(variant) => {
									setSelectedVariantKey(getVariantKey(variant));
									scrollToSelectedPreview();
								}}
								onShowMore={() => setVisibleResultCount((prev) => prev + DEFAULT_VISIBLE_RESULT_COUNT)}
							/>
							</div>
						</div>

						<div ref={selectedPreviewRef} className='builder-selected-preview-anchor'>
							<ProductPreviewPanel
								variant={previewVariant}
								builderImage={builderData?.image || ""}
								subcategoryId={builderData?.subcategoryId || subcategoryId}
								displayName={displayName}
								unitPrice={unitPrice}
								currency={currency}
								qtyAvailable={qtyAvailable}
								quantity={selected.quantity}
								totalPrice={totalPrice}
								exactVariant={exactVariant}
								showViewCartCta={showViewCartCta}
								onQuantityChange={(value) =>
									setSelected((prev) => ({
										...prev,
										quantity: value,
									}))
								}
								onAddToCart={handleAddToCart}
								onViewCart={() => navigate("/cart")}
								onOpenDetails={handleOpenProductDetailModal}
							/>
						</div>

						<ProductDetailModal
							show={showProductDetailModal}
							variant={previewVariant}
							builderImage={builderData?.image || ""}
							subcategoryId={builderData?.subcategoryId || subcategoryId}
							displayName={displayName}
							displayDescription={displayDescription}
							unitPrice={unitPrice}
							currency={currency}
							qtyAvailable={qtyAvailable}
							quantity={quantity}
							totalPrice={totalPrice}
							exactVariant={exactVariant}
							onClose={() => setShowProductDetailModal(false)}
							onAddToCart={handleAddToCart}
							onQuantityChange={(value) =>
								setSelected((prev) => ({
									...prev,
									quantity: value,
								}))
							}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

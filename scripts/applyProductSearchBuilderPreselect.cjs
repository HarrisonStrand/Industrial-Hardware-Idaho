#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const target = path.resolve(
  process.cwd(),
  "client/src/pages/Products/ProductDetail/ProductDetailFacetPanel.jsx",
);

if (!fs.existsSync(target)) {
  console.error(`Could not find ProductDetailFacetPanel.jsx at: ${target}`);
  process.exit(1);
}

let source = fs.readFileSync(target, "utf8");

if (source.includes("findVariantForSearchParams")) {
  console.log("Product search builder preselect patch already applied.");
  process.exit(0);
}

source = source.replace(
  /import\s+\{\s*useParams,\s*useNavigate\s*\}\s+from\s+["']react-router-dom["'];/,
  'import { useParams, useNavigate, useLocation } from "react-router-dom";',
);

if (!source.includes("useLocation")) {
  console.error("Could not update react-router-dom import to include useLocation.");
  process.exit(1);
}

const helperCode = `

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
`;

const getVariantKeyRegex = /function getVariantKey\(variant = \{\}\) \{[\s\S]*?\n\}/;
const getVariantKeyMatch = source.match(getVariantKeyRegex);
if (!getVariantKeyMatch) {
  console.error("Could not find getVariantKey helper in ProductDetailFacetPanel.jsx.");
  process.exit(1);
}
source = source.replace(getVariantKeyMatch[0], `${getVariantKeyMatch[0]}${helperCode}`);

source = source.replace(
  /const navigate = useNavigate\(\);/,
  `const navigate = useNavigate();\n\tconst location = useLocation();`,
);

if (!source.includes("const location = useLocation();")) {
  console.error("Could not insert location hook.");
  process.exit(1);
}

source = source.replace(
  /const highlightTimeoutRef = useRef\(null\);/,
  `const highlightTimeoutRef = useRef(null);\n\tconst appliedSearchSelectionRef = useRef("");`,
);

if (!source.includes("appliedSearchSelectionRef")) {
  console.error("Could not insert appliedSearchSelectionRef.");
  process.exit(1);
}

const variantsMemo = `	const variants = useMemo(() => {
		return Array.isArray(builderData?.variants) ? builderData.variants : [];
	}, [builderData]);
`;

const preselectEffect = [
"",
"\tuseEffect(() => {",
"\t\tif (!variants.length || !location.search) return;",
"",
"\t\tconst searchParams = new URLSearchParams(location.search);",
"\t\tconst hasProductTarget = [",
"\t\t\t\"productId\",",
"\t\t\t\"enrichmentId\",",
"\t\t\t\"slug\",",
"\t\t\t\"partNumber\",",
"\t\t\t\"sku\",",
"\t\t\t\"internalPartNumber\",",
"\t\t].some((key) => getSearchParam(searchParams, key));",
"\t\tconst hasSelectionTarget = BUILDER_URL_SELECTION_KEYS.some((key) =>",
"\t\t\tgetSearchParam(searchParams, key),",
"\t\t);",
"",
"\t\tif (!hasProductTarget && !hasSelectionTarget) return;",
"",
"\t\tconst selectionKey = `${categoryId || \"\"}/${subcategoryId || \"\"}?${location.search}`;",
"\t\tif (appliedSearchSelectionRef.current === selectionKey) return;",
"",
"\t\tconst matchedVariant = findVariantForSearchParams(variants, searchParams);",
"\t\tconst nextSelected = matchedVariant",
"\t\t\t? buildSelectedStateFromVariant(matchedVariant, searchParams)",
"\t\t\t: buildSelectedStateFromSearchParams(searchParams);",
"",
"\t\tif (!matchedVariant && !hasAnyRealSelection(nextSelected)) return;",
"",
"\t\tappliedSearchSelectionRef.current = selectionKey;",
"\t\tsetSelected(nextSelected);",
"\t\tsetSelectedVariantKey(matchedVariant ? getVariantKey(matchedVariant) : \"\");",
"\t\tsetExpandedSections({});",
"\t\tsetVisibleResultCount(DEFAULT_VISIBLE_RESULT_COUNT);",
"\t\tsetShowProductDetailModal(false);",
"",
"\t\twindow.setTimeout(() => {",
"\t\t\tselectedPreviewRef.current?.scrollIntoView?.({",
"\t\t\t\tbehavior: \"smooth\",",
"\t\t\t\tblock: \"center\",",
"\t\t\t\tinline: \"nearest\",",
"\t\t\t});",
"\t\t}, 250);",
"\t}, [variants, location.search, categoryId, subcategoryId]);",
"",
].join("\n");

if (!source.includes(variantsMemo)) {
  console.error("Could not find variants useMemo insertion point.");
  process.exit(1);
}
source = source.replace(variantsMemo, `${variantsMemo}${preselectEffect}`);

fs.writeFileSync(target, source, "utf8");
console.log("Applied ProductDetailFacetPanel search-click preselect patch.");

// client/src/pages/AdminDashboard/AdminProducts.jsx
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch.js";
import "./AdminProducts.css";

const REVIEW_BUCKETS = [
	{ key: "needs-review", label: "Needs Review" },
	{ key: "ready", label: "Ready / No Review Needed" },
	{ key: "approved", label: "Approved" },
	{ key: "published", label: "Published" },
];

const EMPTY_FORM = {
	title: "",
	shortTitle: "",
	shortDescription: "",
	description: "",
	category: "",
	subcategory: "",
	slug: "",
	websiteBrand: "",
	websiteVendor: "",
	tagsText: "",
	notes: "",
	attributes: {},
	pricingBasePrice: "",
	pricingSalePrice: "",
	isActive: true,
};

const DEFAULT_FILTERS = {
	search: "",
	category: "",
	subcategory: "",
	familyType: "",
	issueCode: "",
	publishReady: "",
	renderable: "",
	page: 1,
	limit: 25,
};

function formatDate(value) {
	if (!value) return "—";
	try {
		return new Date(value).toLocaleString();
	} catch {
		return "—";
	}
}

function formatNumber(value = 0) {
	const number = Number(value || 0);
	if (!Number.isFinite(number)) return "0";
	return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number);
}

function formatDuration(value = 0) {
	const ms = Number(value || 0);
	if (!Number.isFinite(ms) || ms <= 0) return "—";
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function safeArray(value) {
	return Array.isArray(value) ? value : [];
}

function safeObject(value) {
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: {};
}

function parseTags(text = "") {
	return String(text)
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function stringifyTags(tags = []) {
	return safeArray(tags).join(", ");
}

function normalizeAttributesForTextarea(attributes = {}) {
	return JSON.stringify(safeObject(attributes), null, 2);
}

function getIssueMessage(issue) {
	if (!issue) return "";
	if (typeof issue === "string") return issue;
	return issue.message || issue.code || "Unknown issue";
}

function getIssueSeverity(issue) {
	if (!issue || typeof issue === "string") return "warning";
	return issue.severity || "warning";
}

function getCandidateReason(candidate) {
	if (!candidate) return "";
	if (candidate.reason) return candidate.reason;
	if (Array.isArray(candidate.reasons) && candidate.reasons.length) {
		return candidate.reasons.join(", ");
	}
	return "";
}

function buildReviewQuery(bucket, filters) {
	const params = new URLSearchParams();

	params.set("status", bucket);
	params.set("page", String(filters.page || 1));
	params.set("limit", String(filters.limit || 25));

	if (filters.search) params.set("search", filters.search);
	if (filters.category) params.set("category", filters.category);
	if (filters.subcategory) params.set("subcategory", filters.subcategory);
	if (filters.familyType) params.set("familyType", filters.familyType);
	if (filters.issueCode) params.set("issueCode", filters.issueCode);
	if (filters.publishReady) params.set("publishReady", filters.publishReady);
	if (filters.renderable) params.set("renderable", filters.renderable);

	return params.toString();
}

function SummaryCard({ label, value, muted = false }) {
	return (
		<div className='theme-sub-card-container border rounded-4 p-3 h-100'>
			<div className='small text-muted'>{label}</div>
			<div className={`fw-semibold fs-5 ${muted ? "text-muted" : ""}`}>
				{value}
			</div>
		</div>
	);
}

export default function AdminProducts() {
	const [bucket, setBucket] = useState("needs-review");
	const [rows, setRows] = useState([]);
	const [summary, setSummary] = useState(null);
	const [filters, setFilters] = useState(DEFAULT_FILTERS);
	const [loadingList, setLoadingList] = useState(true);
	const [loadingSummary, setLoadingSummary] = useState(true);
	const [inventorySyncStatus, setInventorySyncStatus] = useState(null);
	const [inventorySyncLoading, setInventorySyncLoading] = useState(false);
	const [inventorySyncRunning, setInventorySyncRunning] = useState(false);
	const [inventorySyncMessage, setInventorySyncMessage] = useState("");
	const [selectedId, setSelectedId] = useState("");
	const [selectedItem, setSelectedItem] = useState(null);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [saving, setSaving] = useState(false);
	const [selectedIds, setSelectedIds] = useState(new Set());
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [attributesText, setAttributesText] = useState("{}");
	const [form, setForm] = useState(EMPTY_FORM);
	const [error, setError] = useState("");
	const [listMeta, setListMeta] = useState({
		page: 1,
		limit: 25,
		totalItems: 0,
		totalPages: 0,
	});

	async function loadSummary() {
		try {
			setLoadingSummary(true);
			const data = await apiFetch("/api/products/admin/review-summary");
			setSummary(data);
		} catch (err) {
			console.error(err);
			setError(err.message || "Failed to load review summary");
		} finally {
			setLoadingSummary(false);
		}
	}

	async function loadInventorySyncStatus() {
		try {
			const data = await apiFetch("/api/fishbowl/inventory-sync/status");
			setInventorySyncStatus(data);
			setInventorySyncRunning(Boolean(data?.runtime?.running));
		} catch (err) {
			console.error(err);
		}
	}

	async function loadList(nextBucket = bucket, nextFilters = filters) {
		try {
			setLoadingList(true);
			setError("");

			const qs = buildReviewQuery(nextBucket, nextFilters);
			const data = await apiFetch(`/api/products/admin/review?${qs}`);
			const items = safeArray(data?.items);

			setRows(items);
			setListMeta({
				page: Number(data?.page || 1),
				limit: Number(data?.limit || 25),
				totalItems: Number(data?.totalItems || 0),
				totalPages: Number(data?.totalPages || 0),
			});

			if (
				!items.find((item) => String(item.productId) === String(selectedId))
			) {
				const nextId = items[0]?.productId ? String(items[0].productId) : "";
				setSelectedId(nextId);
			}
		} catch (err) {
			console.error(err);
			setError(err.message || "Failed to load products");
			setRows([]);
		} finally {
			setLoadingList(false);
		}
	}

	async function loadDetail(productId) {
		if (!productId) {
			setSelectedItem(null);
			setForm(EMPTY_FORM);
			setAttributesText("{}");
			return;
		}

		try {
			setLoadingDetail(true);
			setError("");

			const data = await apiFetch(`/api/products/admin/${productId}`);
			setSelectedItem(data);

			const product = data?.product || {};
			const enrichment = data?.enrichment || {};
			const attributes = safeObject(enrichment?.attributes);

			setForm({
				title: enrichment?.title || "",
				shortTitle: enrichment?.shortTitle || "",
				shortDescription: enrichment?.shortDescription || "",
				description: enrichment?.description || "",
				category: enrichment?.category || "",
				subcategory: enrichment?.subcategory || "",
				slug: enrichment?.seo?.slug || "",
				websiteBrand: enrichment?.websiteBrand || product?.brand || "",
				websiteVendor: enrichment?.websiteVendor || product?.vendor || "",
				tagsText: stringifyTags(enrichment?.tags),
				notes: enrichment?.notes || "",
				attributes,
				pricingBasePrice:
					product?.pricing?.basePrice === null ||
					product?.pricing?.basePrice === undefined
						? ""
						: String(product.pricing.basePrice),
				pricingSalePrice:
					product?.pricing?.salePrice === null ||
					product?.pricing?.salePrice === undefined
						? ""
						: String(product.pricing.salePrice),
				isActive: product?.isActive !== false,
			});

			setAttributesText(normalizeAttributesForTextarea(attributes));
		} catch (err) {
			console.error(err);
			setError(err.message || "Failed to load product detail");
			setSelectedItem(null);
		} finally {
			setLoadingDetail(false);
		}
	}

	useEffect(() => {
		loadSummary();
		loadInventorySyncStatus();
	}, []);

	useEffect(() => {
		loadList(bucket, filters);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bucket, filters]);

	useEffect(() => {
		loadDetail(selectedId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedId]);

	const currentBucketLabel = useMemo(() => {
		return (
			REVIEW_BUCKETS.find((item) => item.key === bucket)?.label || "Products"
		);
	}, [bucket]);

	const selectedCount = selectedIds.size;
	const allPageSelected = rows.length > 0 && rows.every((item) => selectedIds.has(String(item.productId)));

	const selectedReadiness = selectedItem?.readiness || {};
	const selectedProduct = selectedItem?.product || {};
	const selectedEnrichment = selectedItem?.enrichment || {};
	const review = selectedProduct?.review || {};
	const similarCandidates = safeArray(
		selectedReadiness?.similarFamilyCandidates,
	);
	const issues = safeArray(selectedReadiness?.issues);
	const missingRequired = safeArray(
		selectedReadiness?.missingRequiredAttributes,
	);
	const missingRecommended = safeArray(
		selectedReadiness?.missingRecommendedAttributes,
	);

	function updateForm(key, value) {
		setForm((prev) => ({
			...prev,
			[key]: value,
		}));
	}

	function updateFilter(key, value) {
		setFilters((prev) => ({
			...prev,
			[key]: value,
			page: key === "page" || key === "limit" ? value : 1,
		}));
	}

	function resetFilters() {
		setFilters((prev) => ({
			...DEFAULT_FILTERS,
			limit: prev.limit || 25,
		}));
	}


	function toggleSelectedId(productId) {
		const id = String(productId || "");
		if (!id) return;
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleSelectAllOnPage() {
		const pageIds = rows.map((item) => String(item.productId));
		setSelectedIds((prev) => {
			const next = new Set(prev);
			const everySelected = pageIds.every((id) => next.has(id));
			if (everySelected) pageIds.forEach((id) => next.delete(id));
			else pageIds.forEach((id) => next.add(id));
			return next;
		});
	}

	function clearSelection() {
		setSelectedIds(new Set());
	}

	async function runBulkAction(action, options = {}) {
		const productIds = Array.from(selectedIds);
		if (!productIds.length) {
			setError("Select at least one product first.");
			return;
		}
		try {
			setSaving(true);
			setError("");
			await apiFetch(`/api/products/admin/bulk-action`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action, productIds, ...options }),
			});
			if (action === "delete") {
				setSelectedId("");
				setSelectedItem(null);
				setForm(EMPTY_FORM);
				setAttributesText("{}");
			}
			clearSelection();
			await loadList(bucket, filters);
			await loadSummary();
			if (selectedId && action !== "delete") await loadDetail(selectedId);
		} catch (err) {
			console.error(err);
			setError(err.message || `Failed to ${action} selected products`);
		} finally {
			setSaving(false);
		}
	}

	async function handleBulkSave() {
		let parsedAttributes = {};
		try {
			parsedAttributes = JSON.parse(attributesText || "{}");
		} catch {
			setError("Attributes JSON is invalid. Please fix it before saving.");
			return;
		}
		await runBulkAction("patch", {
			product: {
				isActive: Boolean(form.isActive),
				pricing: {
					basePrice: form.pricingBasePrice === "" ? null : Number(form.pricingBasePrice),
					salePrice: form.pricingSalePrice === "" ? null : Number(form.pricingSalePrice),
				},
				brand: form.websiteBrand,
				vendor: form.websiteVendor,
			},
			enrichment: {
				title: form.title,
				shortTitle: form.shortTitle,
				shortDescription: form.shortDescription,
				description: form.description,
				category: form.category,
				subcategory: form.subcategory,
				websiteBrand: form.websiteBrand,
				websiteVendor: form.websiteVendor,
				tags: parseTags(form.tagsText),
				notes: form.notes,
				attributes: parsedAttributes,
				seo: { slug: form.slug },
			},
		});
	}

	async function handleSave() {
		if (!selectedId) return;

		let parsedAttributes = {};
		try {
			parsedAttributes = JSON.parse(attributesText || "{}");
		} catch {
			setError("Attributes JSON is invalid. Please fix it before saving.");
			return;
		}

		try {
			setSaving(true);
			setError("");

			await apiFetch(`/api/products/admin/${selectedId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					product: {
						isActive: Boolean(form.isActive),
						pricing: {
							basePrice:
								form.pricingBasePrice === ""
									? null
									: Number(form.pricingBasePrice),
							salePrice:
								form.pricingSalePrice === ""
									? null
									: Number(form.pricingSalePrice),
						},
						brand: form.websiteBrand,
						vendor: form.websiteVendor,
					},
					enrichment: {
						title: form.title,
						shortTitle: form.shortTitle,
						shortDescription: form.shortDescription,
						description: form.description,
						category: form.category,
						subcategory: form.subcategory,
						websiteBrand: form.websiteBrand,
						websiteVendor: form.websiteVendor,
						tags: parseTags(form.tagsText),
						notes: form.notes,
						attributes: parsedAttributes,
						seo: {
							slug: form.slug,
						},
					},
				}),
			});

			await loadDetail(selectedId);
			await loadList(bucket, filters);
			await loadSummary();
		} catch (err) {
			console.error(err);
			setError(err.message || "Failed to save changes");
		} finally {
			setSaving(false);
		}
	}

	async function handleDeleteProduct() {
		if (!selectedId) return;

		try {
			setDeleting(true);
			setError("");

			await apiFetch(`/api/products/${selectedId}`, {
				method: "DELETE",
			});

			setShowDeleteModal(false);
			setSelectedId("");
			setSelectedItem(null);
			setForm(EMPTY_FORM);
			setAttributesText("{}");

			await loadList(bucket, filters);
			await loadSummary();
		} catch (err) {
			console.error(err);
			setError(err.message || "Failed to delete product");
		} finally {
			setDeleting(false);
		}
	}

	async function handleAction(action) {
		if (!selectedId) return;

		try {
			setSaving(true);
			setError("");

			await apiFetch(`/api/products/admin/${selectedId}/${action}`, {
				method: "POST",
			});

			await loadDetail(selectedId);
			await loadList(bucket, filters);
			await loadSummary();
		} catch (err) {
			console.error(err);
			setError(err.message || `Failed to ${action} product`);
		} finally {
			setSaving(false);
		}
	}

	async function handleRunInventorySync() {
		try {
			setInventorySyncLoading(true);
			setInventorySyncRunning(true);
			setInventorySyncMessage("Checking Fishbowl quantities now…");
			setError("");

			const data = await apiFetch("/api/fishbowl/inventory-sync/run", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ samples: true, category: "bolts" }),
			});

			setInventorySyncMessage(data?.message || "Inventory quantities updated.");
			await loadInventorySyncStatus();
			if (selectedId) await loadDetail(selectedId);
		} catch (err) {
			console.error(err);
			setInventorySyncMessage("");
			setError(err.message || "Failed to run Fishbowl quantity sync");
		} finally {
			setInventorySyncLoading(false);
			setInventorySyncRunning(false);
		}
	}

	const latestInventoryRun = inventorySyncStatus?.lastRun || null;
	const latestInventoryMetadata = latestInventoryRun?.metadata || {};
	const latestInventorySummary = latestInventoryMetadata?.inventorySummary || {};
	const latestQuantitySummary = latestInventoryMetadata?.syncSummary || {};
	const inventorySchedule = inventorySyncStatus?.schedule || {};
	const inventoryRuntime = inventorySyncStatus?.runtime || {};

	const totalPages = listMeta.totalPages || 0;
	const currentPage = listMeta.page || 1;

	return (
		<div className='container-fluid px-0'>
			<div className='d-flex flex-column gap-4'>
				<div>
					<div className='text-main text-uppercase mb-2 fs-4'>
						Products Review Workflow
					</div>
					<div className='text-muted'>
						Review rendering readiness, search and filter families, edit
						enrichment data, and control publishing.
					</div>
				</div>

				{error ? (
					<div className='alert alert-danger mb-0' role='alert'>
						{error}
					</div>
				) : null}

				<div className='theme-card-container card shadow-sm rounded-4 border-0'>
					<div className='card-body'>
						<div className='d-flex flex-column flex-xl-row justify-content-between gap-3'>
							<div>
								<div className='text-main text-uppercase fs-5'>
									Fishbowl Quantity Sync
								</div>
								<div className='text-muted small'>
									Update website quantities from Fishbowl live inventory for bolt products.
								</div>
							</div>

							<div className='d-flex flex-wrap align-items-center gap-2'>
								<button
									type='button'
									className='btn btn-dark rounded-3 px-4'
									onClick={handleRunInventorySync}
									disabled={inventorySyncLoading || inventorySyncRunning}>
									{inventorySyncLoading || inventorySyncRunning
										? "Checking…"
										: "Check Quantities Now"}
								</button>

								<button
									type='button'
									className='btn btn-outline-secondary rounded-3'
									onClick={loadInventorySyncStatus}
									disabled={inventorySyncLoading}>
									Refresh Status
								</button>
							</div>
						</div>

						<div className='row g-3 mt-1'>
							<div className='col-6 col-lg-3'>
								<SummaryCard
									label='Last Quantity Check'
									value={formatDate(latestInventoryRun?.finishedAt || latestInventoryRun?.startedAt)}
									muted={!latestInventoryRun}
								/>
							</div>
							<div className='col-6 col-lg-3'>
								<SummaryCard
									label='Updated Products'
									value={formatNumber(latestQuantitySummary?.updated)}
								/>
							</div>
							<div className='col-6 col-lg-3'>
								<SummaryCard
									label='Missing Inventory Rows'
									value={formatNumber(latestQuantitySummary?.noInventoryRow)}
								/>
							</div>
							<div className='col-6 col-lg-3'>
								<SummaryCard
									label='Fishbowl Rows Mapped'
									value={formatNumber(latestInventoryMetadata?.uniqueMappedPartNumbers || latestInventorySummary?.rowsMapped)}
								/>
							</div>
						</div>

						<div className='d-flex flex-wrap gap-3 mt-3 small text-muted'>
							<div>
								Status: {inventoryRuntime?.running || inventorySyncRunning ? "Running" : latestInventoryRun?.status || "Not run yet"}
							</div>
							<div>Duration: {formatDuration(latestInventoryRun?.durationMs)}</div>
							<div>
								Schedule: {inventorySchedule?.enabled
									? `Every ${inventorySchedule.intervalMinutes} minutes`
									: "Disabled"}
							</div>
							{inventorySchedule?.nextRunAt ? (
								<div>Next: {formatDate(inventorySchedule.nextRunAt)}</div>
							) : null}
						</div>

						{inventorySyncMessage ? (
							<div className='alert alert-success py-2 px-3 mt-3 mb-0'>
								{inventorySyncMessage}
							</div>
						) : null}
					</div>
				</div>

				<div className='theme-card-container card shadow-sm rounded-4 border-0'>
					<div className='card-body'>
						<div className='row g-3'>
							<div className='col-6 col-md-3'>
								<SummaryCard
									label='Needs Review'
									value={
										loadingSummary ? "…" : (summary?.byStatus?.needsReview ?? 0)
									}
								/>
							</div>
							<div className='col-6 col-md-3'>
								<SummaryCard
									label='Ready'
									value={loadingSummary ? "…" : (summary?.byStatus?.ready ?? 0)}
								/>
							</div>
							<div className='col-6 col-md-3'>
								<SummaryCard
									label='Approved'
									value={
										loadingSummary ? "…" : (summary?.byStatus?.approved ?? 0)
									}
								/>
							</div>
							<div className='col-6 col-md-3'>
								<SummaryCard
									label='Published'
									value={
										loadingSummary ? "…" : (summary?.byStatus?.published ?? 0)
									}
								/>
							</div>
						</div>
					</div>
				</div>

				<div className='theme-card-container card shadow-sm rounded-4 border-0'>
					<div className='card-body'>
						<div className='row g-3 align-items-end'>
							<div className='col-12 col-lg-3'>
								<label className='form-label'>Search</label>
								<input
									className='form-input form-control bg-white'
									placeholder='Title, part number, slug, family type...'
									value={filters.search}
									onChange={(e) => updateFilter("search", e.target.value)}
								/>
							</div>

							<div className='col-6 col-lg-2'>
								<label className='form-label'>Category</label>
								<select
									className='form-select form-control rounded-3 form-input bg-white'
									value={filters.category}
									onChange={(e) => updateFilter("category", e.target.value)}>
									<option value=''>All</option>
									{safeArray(summary?.categories).map((item) => (
										<option key={item.value} value={item.value}>
											{item.value} ({item.count})
										</option>
									))}
								</select>
							</div>

							<div className='col-6 col-lg-2'>
								<label className='form-label'>Subcategory</label>
								<select
									className='form-select form-control rounded-3 form-input bg-white'
									value={filters.subcategory}
									onChange={(e) => updateFilter("subcategory", e.target.value)}>
									<option value=''>All</option>
									{safeArray(summary?.subcategories).map((item) => (
										<option key={item.value} value={item.value}>
											{item.value} ({item.count})
										</option>
									))}
								</select>
							</div>

							<div className='col-6 col-lg-2'>
								<label className='form-label'>Family Type</label>
								<select
									className='form-select form-control rounded-3 form-input bg-white'
									value={filters.familyType}
									onChange={(e) => updateFilter("familyType", e.target.value)}>
									<option value=''>All</option>
									{safeArray(summary?.familyTypes).map((item) => (
										<option key={item.value} value={item.value}>
											{item.value} ({item.count})
										</option>
									))}
								</select>
							</div>

							<div className='col-6 col-lg-2'>
								<label className='form-label'>Issue Code</label>
								<select
									className='form-select form-control rounded-3 form-input bg-white'
									value={filters.issueCode}
									onChange={(e) => updateFilter("issueCode", e.target.value)}>
									<option value=''>All</option>
									{safeArray(summary?.issueCodes).map((item) => (
										<option key={item.value} value={item.value}>
											{item.value} ({item.count})
										</option>
									))}
								</select>
							</div>

							<div className='col-12 col-lg-1 d-grid'>
								<button
									type='button'
									className='btn btn-outline-secondary'
									onClick={resetFilters}>
									Reset
								</button>
							</div>

							<div className='col-6 col-lg-2'>
								<label className='form-label'>Publish Ready</label>
								<select
									className='form-select form-control rounded-3 form-input bg-white'
									value={filters.publishReady}
									onChange={(e) =>
										updateFilter("publishReady", e.target.value)
									}>
									<option value=''>All</option>
									<option value='true'>Yes</option>
									<option value='false'>No</option>
								</select>
							</div>

							<div className='col-6 col-lg-2'>
								<label className='form-label'>Renderable</label>
								<select
									className='form-select form-control rounded-3 form-input bg-white'
									value={filters.renderable}
									onChange={(e) => updateFilter("renderable", e.target.value)}>
									<option value=''>All</option>
									<option value='true'>Yes</option>
									<option value='false'>No</option>
								</select>
							</div>

							<div className='col-6 col-lg-2'>
								<label className='form-label'>Per Page</label>
								<select
									className='form-select form-control rounded-3 form-input bg-white'
									value={filters.limit}
									onChange={(e) =>
										updateFilter("limit", Number(e.target.value))
									}>
									{[10, 25, 50, 100].map((value) => (
										<option key={value} value={value}>
											{value}
										</option>
									))}
								</select>
							</div>

							<div className='col-12 col-lg-6'>
								<div className='d-flex flex-wrap gap-2'>
									{REVIEW_BUCKETS.map((item) => (
										<button
											key={item.key}
											type='button'
											className={`btn ${bucket === item.key ? "btn-dark" : "btn-outline-dark"}`}
											onClick={() => {
												setBucket(item.key);
												setFilters((prev) => ({ ...prev, page: 1 }));
											}}>
											{item.label}
										</button>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className='row g-4 align-items-start'>
					<div className='col-12 col-xl-4'>
						<div className='theme-card-container card shadow-sm rounded-4 border-0'>
							<div
								className='card-body d-flex flex-column'
								style={{ height: "78vh" }}>
								<div className='d-flex justify-content-between align-items-center mb-3 gap-3'>
									<div>
										<div className='fw-semibold'>{currentBucketLabel}</div>
										<div className='small text-muted'>
											{listMeta.totalItems} result{listMeta.totalItems === 1 ? "" : "s"} · {selectedCount} selected
										</div>
									</div>

									<div className='d-flex align-items-center gap-2'>
										<div className='form-check m-0'>
											<input className='form-check-input' type='checkbox' id='selectAllPage' checked={allPageSelected} onChange={toggleSelectAllOnPage} />
											<label className='form-check-label small' htmlFor='selectAllPage'>Page</label>
										</div>
										<button type='button' className='btn btn-sm btn-outline-secondary' onClick={() => loadList(bucket, filters)} disabled={loadingList}>
											Refresh
										</button>
									</div>
								</div>

								<div className='d-flex flex-wrap gap-2 mb-3'>
									<button type='button' className='btn btn-sm btn-primary' disabled={saving || selectedCount === 0} onClick={handleBulkSave}>Save Selected</button>
									<button type='button' className='btn btn-sm btn-outline-primary' disabled={saving || selectedCount === 0} onClick={() => runBulkAction('approve')}>Bulk Approve</button>
									<button type='button' className='btn btn-sm btn-success' disabled={saving || selectedCount === 0} onClick={() => runBulkAction('publish')}>Bulk Publish</button>
									<button type='button' className='btn btn-sm btn-outline-danger' disabled={saving || selectedCount === 0} onClick={() => runBulkAction('unpublish')}>Bulk Unpublish</button>
									<button type='button' className='btn btn-sm btn-outline-secondary' disabled={saving || selectedCount === 0} onClick={() => runBulkAction('recompute')}>Bulk Recompute</button>
									<button type='button' className='btn btn-sm btn-danger' disabled={saving || selectedCount === 0} onClick={() => { setBulkDeleteMode(true); setShowDeleteModal(true); }}>Bulk Delete</button>
									<button type='button' className='btn btn-sm btn-outline-secondary' disabled={selectedCount === 0} onClick={clearSelection}>Clear</button>
								</div>
								<div className='flex-grow-1 overflow-auto pe-1'>
									{loadingList ? (
										<div className='text-muted'>Loading products…</div>
									) : rows.length === 0 ? (
										<div className='text-muted'>
											No products match the current filters.
										</div>
									) : (
										<div className='list-group gap-2'>
											{rows.map((item) => {
												const rowId = String(item.productId);
												const isActive = String(selectedId) === rowId;
												const isChecked = selectedIds.has(rowId);

												return (
													<div key={rowId} className={`theme-sub-card-container rounded-4 list-group-item ${isActive ? "active theme-sub-card-container-active" : ""}`}>
														<div className='d-flex gap-2 align-items-start'>
															<div className='form-check mt-1'>
																<input className='form-check-input' type='checkbox' checked={isChecked} onChange={() => toggleSelectedId(rowId)} />
															</div>
															<button type='button' className='btn btn-link text-start text-decoration-none p-0 flex-grow-1' onClick={() => setSelectedId(rowId)}>
																<div className='fw-semibold text-main'>{item?.title || item?.partNumber || item?.sku || 'Untitled Product'}</div>
																<div className={`small ${isActive ? 'text-dark' : 'text-muted'}`}>{item?.partNumber || item?.sku || 'No part number'}</div>
																<div className={`small ${isActive ? 'text-dark' : 'text-muted'}`}>{item?.category || '—'} / {item?.subcategory || '—'}</div>
																<div className={`small ${isActive ? 'text-dark' : 'text-muted'}`}>Family: {item?.familyType || '—'}</div>
																<div className={`small ${isActive ? 'text-dark' : 'text-muted'}`}>Status: {item?.reviewStatus || 'needs-review'} · Score: {Number(item?.qualityScore || 0).toFixed(0)}</div>
															</button>
														</div>
													</div>
												);
											})}

										</div>
									)}
								</div>

								<div className='pt-3 border-top mt-3'>
									<div className='d-flex justify-content-between align-items-center'>
										<button
											type='button'
											className='btn btn-outline-secondary btn-sm'
											disabled={currentPage <= 1 || loadingList}
											onClick={() => updateFilter("page", currentPage - 1)}>
											Previous
										</button>

										<div className='small text-muted'>
											Page {currentPage} of {Math.max(1, totalPages)}
										</div>

										<button
											type='button'
											className='btn btn-outline-secondary btn-sm'
											disabled={
												currentPage >= totalPages ||
												loadingList ||
												totalPages === 0
											}
											onClick={() => updateFilter("page", currentPage + 1)}>
											Next
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className='col-12 col-xl-8'>
						<div
							className='theme-card-container card rounded-4 border-0'
							style={{ position: "sticky", top: "1rem" }}>
							<div
								className='card-body'
								style={{ maxHeight: "78vh", overflow: "auto" }}>
								{loadingDetail ? (
									<div className='text-muted'>Loading product detail…</div>
								) : !selectedId || !selectedItem ? (
									<div className='text-muted'>Select a product to review.</div>
								) : (
									<>
										<div className='d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4'>
											<div>
												<div className='fs-5 fw-semibold'>
													{selectedEnrichment?.title ||
														selectedProduct?.fishbowl?.description ||
														selectedProduct?.fishbowl?.partNum ||
														selectedProduct?.sku ||
														"Untitled Product"}
												</div>
												<div className='text-muted'>
													{selectedProduct?.fishbowl?.partNum ||
														selectedProduct?.sku ||
														"No part number"}
												</div>
											</div>

											<div className='d-flex flex-wrap gap-2'>
												<button
													type='button'
													className='btn btn-outline-secondary'
													disabled={saving}
													onClick={() => handleAction("recompute")}>
													Recompute
												</button>

												<button
													type='button'
													className='btn btn-outline-primary'
													disabled={saving}
													onClick={() => handleAction("approve")}>
													Approve
												</button>

												<button
													type='button'
													className='btn btn-success'
													disabled={saving}
													onClick={() => handleAction("publish")}>
													Publish
												</button>

												<button
													type='button'
													className='btn btn-outline-danger'
													disabled={saving}
													onClick={() => handleAction("unpublish")}>
													Unpublish
												</button>

												<button
													type='button'
													className='btn btn-danger'
													disabled={saving || deleting}
													onClick={() => setShowDeleteModal(true)}>
													Delete Product
												</button>
											</div>
										</div>

										<div className='row g-3 mb-4'>
											<div className='col-md-3'>
												<SummaryCard
													label='Review Status'
													value={review?.status || "needs-review"}
												/>
											</div>
											<div className='col-md-3'>
												<SummaryCard
													label='Renderable'
													value={selectedReadiness?.renderable ? "Yes" : "No"}
												/>
											</div>
											<div className='col-md-3'>
												<SummaryCard
													label='Publish Ready'
													value={selectedReadiness?.publishReady ? "Yes" : "No"}
												/>
											</div>
											<div className='col-md-3'>
												<SummaryCard
													label='Quality Score'
													value={Number(
														selectedReadiness?.qualityScore || 0,
													).toFixed(0)}
												/>
											</div>
										</div>

										<div className='row g-4 mb-4'>
											<div className='col-lg-6'>
												<div className='theme-sub-card-container border rounded-4 p-3 h-100'>
													<div className='fw-semibold mb-2'>Issues</div>
													{issues.length ? (
														<ul className='mb-0'>
															{issues.map((issue, idx) => (
																<li key={`${issue?.code || issue}-${idx}`}>
																	<span className='fw-semibold text-capitalize'>
																		{getIssueSeverity(issue)}:
																	</span>{" "}
																	{getIssueMessage(issue)}
																</li>
															))}
														</ul>
													) : (
														<div className='text-muted'>
															No issues detected.
														</div>
													)}
												</div>
											</div>

											<div className='col-lg-6'>
												<div className='theme-sub-card-container border rounded-4 p-3 h-100'>
													<div className='fw-semibold mb-2'>
														Missing Attributes
													</div>

													<div className='mb-2'>
														<div className='small text-muted'>Required</div>
														{missingRequired.length
															? missingRequired.join(", ")
															: "None"}
													</div>

													<div>
														<div className='small text-muted'>Recommended</div>
														{missingRecommended.length
															? missingRecommended.join(", ")
															: "None"}
													</div>
												</div>
											</div>
										</div>

										<div className='theme-sub-card-container border rounded-4 p-3 mb-4'>
											<div className='fw-semibold mb-2'>
												Similar Family Candidates
											</div>

											{similarCandidates.length ? (
												<div className='table-responsive'>
													<table className='table align-middle mb-0'>
														<thead>
															<tr>
																<th>Family Key</th>
																<th>Family Title</th>
																<th>Match Score</th>
																<th>Confidence</th>
																<th>Reason</th>
															</tr>
														</thead>
														<tbody>
															{similarCandidates.map((candidate, idx) => (
																<tr
																	key={`${candidate?.familyKey || "candidate"}-${idx}`}>
																	<td>{candidate?.familyKey || "—"}</td>
																	<td>{candidate?.familyTitle || "—"}</td>
																	<td>
																		{Number(candidate?.score || 0).toFixed(0)}
																	</td>
																	<td>
																		{Number(candidate?.confidence || 0).toFixed(
																			2,
																		)}
																	</td>
																	<td>
																		{getCandidateReason(candidate) || "—"}
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											) : (
												<div className='text-muted'>
													No similar family suggestions.
												</div>
											)}
										</div>

										<div className='theme-sub-card-container border rounded-4 p-3 mb-4'>
											<div className='fw-semibold mb-3'>Edit Product</div>

											<div className='row g-3'>
												<div className='col-md-6'>
													<label className='form-label'>Title</label>
													<input
														className='form-control'
														value={form.title}
														onChange={(e) =>
															updateForm("title", e.target.value)
														}
													/>
												</div>

												<div className='col-md-6'>
													<label className='form-label'>Short Title</label>
													<input
														className='form-control'
														value={form.shortTitle}
														onChange={(e) =>
															updateForm("shortTitle", e.target.value)
														}
													/>
												</div>

												<div className='col-md-6'>
													<label className='form-label'>Category</label>
													<input
														className='form-control'
														value={form.category}
														onChange={(e) =>
															updateForm("category", e.target.value)
														}
													/>
												</div>

												<div className='col-md-6'>
													<label className='form-label'>Subcategory</label>
													<input
														className='form-control'
														value={form.subcategory}
														onChange={(e) =>
															updateForm("subcategory", e.target.value)
														}
													/>
												</div>

												<div className='col-md-6'>
													<label className='form-label'>Slug</label>
													<input
														className='form-control'
														value={form.slug}
														onChange={(e) => updateForm("slug", e.target.value)}
													/>
												</div>

												<div className='col-md-3'>
													<label className='form-label'>Brand</label>
													<input
														className='form-control'
														value={form.websiteBrand}
														onChange={(e) =>
															updateForm("websiteBrand", e.target.value)
														}
													/>
												</div>

												<div className='col-md-3'>
													<label className='form-label'>Vendor</label>
													<input
														className='form-control'
														value={form.websiteVendor}
														onChange={(e) =>
															updateForm("websiteVendor", e.target.value)
														}
													/>
												</div>

												<div className='col-md-6'>
													<label className='form-label'>Base Price</label>
													<input
														type='number'
														step='0.01'
														className='form-control'
														value={form.pricingBasePrice}
														onChange={(e) =>
															updateForm("pricingBasePrice", e.target.value)
														}
													/>
												</div>

												<div className='col-md-6'>
													<label className='form-label'>Sale Price</label>
													<input
														type='number'
														step='0.01'
														className='form-control'
														value={form.pricingSalePrice}
														onChange={(e) =>
															updateForm("pricingSalePrice", e.target.value)
														}
													/>
												</div>

												<div className='col-12'>
													<label className='form-label'>
														Short Description
													</label>
													<textarea
														rows='2'
														className='form-control'
														value={form.shortDescription}
														onChange={(e) =>
															updateForm("shortDescription", e.target.value)
														}
													/>
												</div>

												<div className='col-12'>
													<label className='form-label'>Description</label>
													<textarea
														rows='5'
														className='form-control'
														value={form.description}
														onChange={(e) =>
															updateForm("description", e.target.value)
														}
													/>
												</div>

												<div className='col-12'>
													<label className='form-label'>
														Tags (comma separated)
													</label>
													<input
														className='form-control'
														value={form.tagsText}
														onChange={(e) =>
															updateForm("tagsText", e.target.value)
														}
													/>
												</div>

												<div className='col-12'>
													<label className='form-label'>Attributes JSON</label>
													<textarea
														rows='14'
														className='form-control font-monospace'
														value={attributesText}
														onChange={(e) => setAttributesText(e.target.value)}
													/>
												</div>

												<div className='col-12'>
													<label className='form-label'>Notes</label>
													<textarea
														rows='3'
														className='form-control'
														value={form.notes}
														onChange={(e) =>
															updateForm("notes", e.target.value)
														}
													/>
												</div>

												<div className='col-12'>
													<div className='form-check'>
														<input
															id='isActive'
															type='checkbox'
															className='form-check-input'
															checked={Boolean(form.isActive)}
															onChange={(e) =>
																updateForm("isActive", e.target.checked)
															}
														/>
														<label
															htmlFor='isActive'
															className='form-check-label'>
															Product is active
														</label>
													</div>
												</div>
											</div>

											<div className='d-flex flex-wrap gap-2 mt-4'>
												<button
													type='button'
													className='btn btn-primary'
													disabled={saving}
													onClick={handleSave}>
													Save Changes
												</button>
											</div>
										</div>

										<div className='theme-sub-card-container border rounded-4 p-3'>
											<div className='fw-semibold mb-2'>Metadata</div>
											<div className='small text-muted'>
												Created: {formatDate(selectedProduct?.createdAt)} ·
												Updated: {formatDate(selectedProduct?.updatedAt)}
											</div>
											<div className='small text-muted'>
												Enrichment Updated:{" "}
												{formatDate(selectedEnrichment?.updatedAt)}
											</div>
											<div className='small text-muted'>
												Current Catalog Status:{" "}
												{selectedProduct?.catalogStatus || "draft"}
											</div>
											<div className='small text-muted'>
												Published: {selectedProduct?.isPublished ? "Yes" : "No"}
											</div>
											<div className='small text-muted'>
												Family Type:{" "}
												{selectedEnrichment?.attributes?.familyType || "—"}
											</div>
											<div className='small text-muted'>
												Family Key:{" "}
												{selectedEnrichment?.attributes?.familyKey || "—"}
											</div>
										</div>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
			{showDeleteModal ? (
				<div
					className='modal fade show'
					tabIndex='-1'
					role='dialog'
					style={{ display: "block", background: "rgba(0,0,0,0.45)" }}>
					<div className='modal-dialog modal-dialog-centered' role='document'>
            <div className="bg-white rounded-4 border-0">
						<div className='modal-content rounded-4 border-0 shadow'>
							<div className='modal-header'>
								<h5 className='modal-title'>{bulkDeleteMode ? `Delete ${selectedCount} Products` : 'Delete Product'}</h5>
								<button
									type='button'
									className='btn-close'
									aria-label='Close'
									onClick={() => {
										if (!deleting && !saving) { setShowDeleteModal(false); setBulkDeleteMode(false); }
									}}
								/>
							</div>

							<div className='modal-body'>
								{bulkDeleteMode ? (
									<>
										<p className='mb-2'>Are you sure you want to delete the selected products?</p>
										<div className='small text-muted'>Selected: {selectedCount} product{selectedCount === 1 ? "" : "s"}</div>
									</>
								) : (
									<>
										<p className='mb-2'>Are you sure you want to delete this product?</p>
										<div className='small text-muted'>
											<div><strong>Title:</strong> {selectedEnrichment?.title || selectedProduct?.fishbowl?.description || selectedProduct?.fishbowl?.partNum || selectedProduct?.sku || "Untitled Product"}</div>
											<div><strong>Part Number:</strong> {selectedProduct?.fishbowl?.partNum || selectedProduct?.sku || "No part number"}</div>
										</div>
									</>
								)}

								<div className='alert alert-warning mt-3 mb-0' role='alert'>
									This will permanently delete {bulkDeleteMode ? 'the selected products and their enrichment records.' : 'the product and its enrichment record.'}
								</div>
							</div>

							<div className='modal-footer'>
								<button
									type='button'
									className='btn btn-outline-secondary'
									disabled={deleting}
									onClick={() => { setShowDeleteModal(false); setBulkDeleteMode(false); }}>
									Cancel
								</button>

								<button
									type='button'
									className='btn btn-danger'
									disabled={deleting}
									onClick={() => bulkDeleteMode ? runBulkAction('delete') : handleDeleteProduct()}>
									{deleting || saving ? "Deleting..." : bulkDeleteMode ? "Yes, Delete Selected" : "Yes, Delete Product"}
								</button>
							</div>
						</div>
            </div>

					</div>
				</div>
			) : null}
		</div>
	);
}

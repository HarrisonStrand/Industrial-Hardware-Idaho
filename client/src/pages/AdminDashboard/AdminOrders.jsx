import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import "./AdminOrders.css";

const ADMIN_STATUS = [
	{ value: "", label: "All Admin Statuses" },
	{ value: "PENDING", label: "Pending Review" },
	{ value: "APPROVED_IN_PROGRESS", label: "Processing" },
	{ value: "APPROVED_COMPLETED", label: "Completed" },
	{ value: "DENIED", label: "Denied" },
];

const PAYMENT_STATUS = [
	{ value: "", label: "All Payment Statuses" },
	{ value: "PENDING", label: "Pending" },
	{ value: "SUCCEEDED", label: "Paid" },
	{ value: "FAILED", label: "Failed" },
	{ value: "INVOICED", label: "Pay Later / Invoice" },
];

const FISHBOWL_STATUS = [
	{ value: "", label: "All Fishbowl Statuses" },
	{ value: "NOT_SENT", label: "Not Sent" },
	{ value: "PUSHED", label: "Pushed" },
	{ value: "FAILED", label: "Failed" },
];

function formatMoneyFromCents(value) {
	const cents = Number(value || 0);
	return `$${(cents / 100).toFixed(2)}`;
}

function formatMoney(value) {
	return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
	if (!value) return "-";
	return new Date(value).toLocaleString();
}

function customerName(order = {}) {
	return [order?.customer?.firstName, order?.customer?.lastName].filter(Boolean).join(" ") || "-";
}

function adminStatusClass(status) {
	switch (status) {
		case "APPROVED_IN_PROGRESS":
			return "in-progress";
		case "APPROVED_COMPLETED":
			return "completed";
		case "DENIED":
			return "denied";
		default:
			return "pending";
	}
}

function adminStatusLabel(status) {
	switch (status) {
		case "APPROVED_IN_PROGRESS":
			return "Processing";
		case "APPROVED_COMPLETED":
			return "Completed";
		case "DENIED":
			return "Denied";
		default:
			return "Pending Review";
	}
}

function paymentStatusClass(status) {
	switch (status) {
		case "SUCCEEDED":
			return "completed";
		case "INVOICED":
			return "invoiced";
		case "FAILED":
			return "denied";
		default:
			return "pending";
	}
}

function paymentStatusLabel(status, mode = "") {
	if (status === "SUCCEEDED") return "Paid";
	if (status === "INVOICED") return mode === "PAY_LATER" ? "Pay Later / Invoice" : "Invoiced";
	if (status === "FAILED") return "Payment Failed";
	return "Payment Pending";
}

function fishbowlStatusClass(status) {
	if (status === "PUSHED") return "completed";
	if (status === "FAILED") return "denied";
	return "pending";
}

function fishbowlStatusLabel(status) {
	if (status === "PUSHED") return "Pushed";
	if (status === "FAILED") return "Push Failed";
	return "Not Sent";
}

function getSummaryCount(summary, type, key) {
	if (!summary) return 0;
	if (type === "total") return Number(summary.total || 0);
	return Number(summary?.[type]?.[key] || 0);
}

function canApprove(order = {}) {
	return order?.payment?.status !== "FAILED";
}

function canComplete(order = {}) {
	const adminStatus = order?.adminReview?.status || "PENDING";
	return canApprove(order) && adminStatus !== "DENIED";
}

function canPushFishbowl(order = {}) {
	const adminStatus = order?.adminReview?.status || "PENDING";
	const paymentStatus = order?.payment?.status || "PENDING";
	return (
		paymentStatus !== "FAILED" &&
		adminStatus !== "PENDING" &&
		adminStatus !== "DENIED" &&
		order?.fishbowlStatus !== "PUSHED"
	);
}

function StatusPill({ type = "admin", status, mode }) {
	const config =
		type === "payment"
			? { className: paymentStatusClass(status), label: paymentStatusLabel(status, mode) }
			: type === "fishbowl"
			? { className: fishbowlStatusClass(status), label: fishbowlStatusLabel(status) }
			: { className: adminStatusClass(status), label: adminStatusLabel(status) };

	return <span className={`status-pill ${config.className}`}>{config.label}</span>;
}

function InfoRow({ label, value }) {
	return (
		<div className='admin-order-info-row'>
			<div className='admin-order-info-label'>{label}</div>
			<div className='admin-order-info-value'>{value || "-"}</div>
		</div>
	);
}


function formatErrorMessage(error, fallback = "Something went wrong") {
	const message = error?.message || error?.error || error;
	if (!message) return fallback;

	if (typeof message === "string") {
		if (message === "[object Object]") return fallback;
		try {
			const parsed = JSON.parse(message);
			return parsed?.message || parsed?.error || message;
		} catch {
			return message;
		}
	}

	if (message?.message) return message.message;
	try {
		return JSON.stringify(message);
	} catch {
		return fallback;
	}
}

function formatFishbowlError(value) {
	if (!value) return "";
	if (typeof value !== "string") return formatErrorMessage(value, "Fishbowl push failed.");

	try {
		const parsed = JSON.parse(value);
		return parsed?.message || parsed?.error || value;
	} catch {
		return value;
	}
}

function AddressBlock({ title, address, sameAsBilling = false }) {
	return (
		<div className='admin-order-detail-card'>
			<div className='admin-order-detail-title'>{title}</div>
			{sameAsBilling ? (
				<div className='text-muted'>Same as billing</div>
			) : (
				<div className='text-main small lh-lg'>
					<div>{address?.address1 || "-"}</div>
					{address?.address2 ? <div>{address.address2}</div> : null}
					<div>
						{[address?.city, address?.state].filter(Boolean).join(", ")} {address?.zip || ""}
					</div>
				</div>
			)}
		</div>
	);
}

export default function AdminOrders() {
	const [q, setQ] = useState("");
	const [adminStatus, setAdminStatus] = useState("");
	const [paymentStatus, setPaymentStatus] = useState("");
	const [fishbowlStatus, setFishbowlStatus] = useState("");
	const [page, setPage] = useState(1);
	const limit = 25;

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [data, setData] = useState({ items: [], total: 0, totalPages: 1, summary: null });

	const [denyOpen, setDenyOpen] = useState(false);
	const [denyReason, setDenyReason] = useState("");
	const [denyOrderId, setDenyOrderId] = useState(null);

	const [detailOpen, setDetailOpen] = useState(false);
	const [detailLoading, setDetailLoading] = useState(false);
	const [selectedOrder, setSelectedOrder] = useState(null);

	const qs = useMemo(() => {
		const params = new URLSearchParams();
		if (q) params.set("q", q);
		if (adminStatus) params.set("adminStatus", adminStatus);
		if (paymentStatus) params.set("paymentStatus", paymentStatus);
		if (fishbowlStatus) params.set("fishbowlStatus", fishbowlStatus);
		params.set("page", String(page));
		params.set("limit", String(limit));
		return params.toString();
	}, [q, adminStatus, paymentStatus, fishbowlStatus, page]);

	async function load() {
		setLoading(true);
		try {
			const res = await apiFetch(`/api/admin/orders?${qs}`);
			setData(res);
		} catch (e) {
			console.error(e);
			setData({ items: [], total: 0, totalPages: 1, summary: null });
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, [qs]);

	function onSearchSubmit(e) {
		e.preventDefault();
		setPage(1);
	}

	function resetFilters() {
		setQ("");
		setAdminStatus("");
		setPaymentStatus("");
		setFishbowlStatus("");
		setPage(1);
	}

	async function refreshSelectedOrder(orderId) {
		if (!orderId) return;
		try {
			const order = await apiFetch(`/api/admin/orders/${orderId}`);
			setSelectedOrder(order);
		} catch (e) {
			console.error(e);
		}
	}

	async function openDetail(orderId) {
		setDetailOpen(true);
		setDetailLoading(true);
		setSelectedOrder(null);
		try {
			const order = await apiFetch(`/api/admin/orders/${orderId}`);
			setSelectedOrder(order);
		} catch (e) {
			console.error(e);
			alert(formatErrorMessage(e, "Failed to load order"));
			setDetailOpen(false);
		} finally {
			setDetailLoading(false);
		}
	}

	async function setReview(orderId, status, deniedReason = "") {
		setSaving(true);
		try {
			await apiFetch(`/api/admin/orders/${orderId}/review`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status, deniedReason }),
			});
			await load();
			await refreshSelectedOrder(orderId);
		} catch (e) {
			console.error(e);
			alert(formatErrorMessage(e, "Failed to update order"));
		} finally {
			setSaving(false);
		}
	}

	async function pushFishbowl(orderId) {
		if (!orderId) return;
		setSaving(true);
		try {
			await apiFetch(`/api/admin/orders/${orderId}/push-fishbowl`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			await load();
			await refreshSelectedOrder(orderId);
		} catch (e) {
			console.error(e);
			alert(formatErrorMessage(e, "Failed to push order to Fishbowl"));
		} finally {
			setSaving(false);
		}
	}

	function openDeny(orderId) {
		setDenyOrderId(orderId);
		setDenyReason("");
		setDenyOpen(true);
	}

	async function submitDeny() {
		if (!denyOrderId) return;
		await setReview(denyOrderId, "DENIED", denyReason);
		setDenyOpen(false);
	}

	function applyQuickFilter(next = {}) {
		setAdminStatus(next.adminStatus || "");
		setPaymentStatus(next.paymentStatus || "");
		setFishbowlStatus(next.fishbowlStatus || "");
		setPage(1);
	}

	return (
		<div className='admin-orders-page'>
			<div className='d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-end mb-3'>
				<div>
					<div className='text-main text-uppercase mb-1 fs-4'>Orders</div>
					<div className='text-muted small'>Review orders, confirm payment, approve processing, and push to Fishbowl when ready.</div>
				</div>
				<button className='btn btn-outline-dark rounded-3' onClick={resetFilters} disabled={saving || loading}>
					Reset Filters
				</button>
			</div>

			<div className='admin-orders-summary-grid mb-3'>
				<button className='admin-orders-summary-card' onClick={() => applyQuickFilter({})} type='button'>
					<span>All Orders</span>
					<strong>{getSummaryCount(data.summary, "total")}</strong>
				</button>
				<button className='admin-orders-summary-card' onClick={() => applyQuickFilter({ adminStatus: "PENDING" })} type='button'>
					<span>Pending Review</span>
					<strong>{getSummaryCount(data.summary, "admin", "PENDING")}</strong>
				</button>
				<button className='admin-orders-summary-card' onClick={() => applyQuickFilter({ adminStatus: "APPROVED_IN_PROGRESS" })} type='button'>
					<span>Processing</span>
					<strong>{getSummaryCount(data.summary, "admin", "APPROVED_IN_PROGRESS")}</strong>
				</button>
				<button className='admin-orders-summary-card' onClick={() => applyQuickFilter({ paymentStatus: "FAILED" })} type='button'>
					<span>Payment Failed</span>
					<strong>{getSummaryCount(data.summary, "payment", "FAILED")}</strong>
				</button>
				<button className='admin-orders-summary-card' onClick={() => applyQuickFilter({ fishbowlStatus: "NOT_SENT" })} type='button'>
					<span>Not Sent to Fishbowl</span>
					<strong>{getSummaryCount(data.summary, "fishbowl", "NOT_SENT")}</strong>
				</button>
			</div>

			<form onSubmit={onSearchSubmit} className='admin-orders-filter-grid mb-3'>
				<div className='admin-orders-filter-field admin-orders-search-field'>
					<label className='form-label text-main fw-semibold small mb-1'>Search</label>
					<input
						className='form-control form-input rounded-3'
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder='Order #, email, company, Stripe PI, part #…'
					/>
				</div>

				<div className='admin-orders-filter-field'>
					<label className='form-label text-main fw-semibold small mb-1'>Admin Status</label>
					<select
						className='form-select form-input rounded-3'
						value={adminStatus}
						onChange={(e) => {
							setAdminStatus(e.target.value);
							setPage(1);
						}}>
						{ADMIN_STATUS.map((s) => (
							<option key={s.value} value={s.value}>{s.label}</option>
						))}
					</select>
				</div>

				<div className='admin-orders-filter-field'>
					<label className='form-label text-main fw-semibold small mb-1'>Payment</label>
					<select
						className='form-select form-input rounded-3'
						value={paymentStatus}
						onChange={(e) => {
							setPaymentStatus(e.target.value);
							setPage(1);
						}}>
						{PAYMENT_STATUS.map((s) => (
							<option key={s.value} value={s.value}>{s.label}</option>
						))}
					</select>
				</div>

				<div className='admin-orders-filter-field'>
					<label className='form-label text-main fw-semibold small mb-1'>Fishbowl</label>
					<select
						className='form-select form-input rounded-3'
						value={fishbowlStatus}
						onChange={(e) => {
							setFishbowlStatus(e.target.value);
							setPage(1);
						}}>
						{FISHBOWL_STATUS.map((s) => (
							<option key={s.value} value={s.value}>{s.label}</option>
						))}
					</select>
				</div>

				<button className='btn-main-cta py-2 px-4 rounded-3 text-main-light text-uppercase admin-orders-search-btn' disabled={saving}>
					Search
				</button>
			</form>

			<div className='table-responsive admin-orders-table-wrap'>
				<table className='table align-middle admin-orders-table'>
					<thead>
						<tr>
							<th>Created</th>
							<th>Order #</th>
							<th>Customer</th>
							<th>Total</th>
							<th>Payment</th>
							<th>Admin</th>
							<th>Fishbowl</th>
							<th className='text-end'>Actions</th>
						</tr>
					</thead>

					<tbody>
						{loading ? (
							<tr><td colSpan='8' className='text-muted py-4'>Loading…</td></tr>
						) : data.items.length === 0 ? (
							<tr><td colSpan='8' className='text-muted py-4'>No orders found.</td></tr>
						) : (
							data.items.map((o) => {
								const adminS = o?.adminReview?.status || "PENDING";
								const payStatus = o?.payment?.status || "PENDING";
								const fishStatus = o?.fishbowlStatus || "";
								const companyName = o?.customer?.companyName || "-";

								return (
									<tr key={o._id} className={payStatus === "FAILED" ? "admin-order-row-warning" : ""}>
										<td>{formatDate(o.createdAt)}</td>
										<td>
											<div className='fw-semibold text-main'>{o.orderNumber}</div>
											<div className='text-muted small'>{(o.items || []).length} item{(o.items || []).length === 1 ? "" : "s"}</div>
										</td>
										<td>
											<div>{customerName(o)}</div>
											<div className='text-muted small'>{o?.customer?.email || "-"}</div>
											<div className='text-muted small'>{companyName}</div>
										</td>
										<td className='fw-semibold'>{formatMoneyFromCents(o.amountTotalCents)}</td>
										<td>
											<StatusPill type='payment' status={payStatus} mode={o?.payment?.mode} />
											{o?.payment?.stripePaymentIntentId ? <div className='text-muted small mt-1 admin-order-pi'>{o.payment.stripePaymentIntentId}</div> : null}
										</td>
										<td>
											<StatusPill status={adminS} />
											{adminS === "DENIED" && o?.adminReview?.deniedReason ? <div className='text-muted small mt-1'>Reason: {o.adminReview.deniedReason}</div> : null}
										</td>
										<td>
											<StatusPill type='fishbowl' status={fishStatus} />
											{o?.fishbowlNumber ? <div className='text-muted small mt-1'>{o.fishbowlNumber}</div> : null}
										</td>

										<td className='text-end'>
											<OrderActionGrid
												order={o}
												saving={saving}
												onView={() => openDetail(o._id)}
												onProcess={() => setReview(o._id, "APPROVED_IN_PROGRESS")}
												onComplete={() => setReview(o._id, "APPROVED_COMPLETED")}
												onDeny={() => openDeny(o._id)}
												onFishbowl={() => pushFishbowl(o._id)}
											/>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			<div className='d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2'>
				<button className='btn btn-outline-dark' disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Prev</button>
				<div className='text-muted'>Page {page} of {data.totalPages} • {data.total} total</div>
				<button className='btn btn-outline-dark' disabled={page >= data.totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
			</div>

			{detailOpen ? (
				<OrderDetailModal
					order={selectedOrder}
					loading={detailLoading}
					saving={saving}
					onClose={() => setDetailOpen(false)}
					onProcess={() => selectedOrder && setReview(selectedOrder._id, "APPROVED_IN_PROGRESS")}
					onComplete={() => selectedOrder && setReview(selectedOrder._id, "APPROVED_COMPLETED")}
					onDeny={() => selectedOrder && openDeny(selectedOrder._id)}
					onFishbowl={() => selectedOrder && pushFishbowl(selectedOrder._id)}
				/>
			) : null}

			{denyOpen ? (
				<div className='admin-order-modal-backdrop' onClick={() => !saving && setDenyOpen(false)}>
					<div className='admin-order-deny-modal bg-white rounded-4 p-3 p-sm-4' onClick={(e) => e.stopPropagation()}>
						<div className='d-flex justify-content-between align-items-center mb-2'>
							<div className='fw-semibold fs-5'>Deny Order</div>
							<button className='btn btn-sm btn-outline-dark' disabled={saving} onClick={() => setDenyOpen(false)}>Close</button>
						</div>

						<div className='text-muted mb-2'>Add a reason. This will be saved on the order.</div>

						<textarea className='form-control mb-3' rows={4} value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder='Reason for denial…' />

						<div className='d-flex justify-content-end gap-2'>
							<button className='btn btn-outline-dark' disabled={saving} onClick={() => setDenyOpen(false)}>Cancel</button>
							<button className='btn btn-danger' disabled={saving || !denyReason.trim()} onClick={submitDeny}>Deny Order</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}

function OrderActionGrid({ order, saving, onView, onProcess, onComplete, onDeny, onFishbowl, showView = true }) {
	return (
		<div className='admin-order-action-grid'>
			{showView ? <button className='btn btn-outline-dark btn-sm admin-order-action-btn' disabled={saving} onClick={onView}>View Details</button> : null}
			<button className='btn btn-outline-dark btn-sm admin-order-action-btn' disabled={saving || !canApprove(order)} onClick={onProcess}>Start Processing</button>
			<button className='btn btn-outline-dark btn-sm admin-order-action-btn' disabled={saving || !canComplete(order)} onClick={onComplete}>Mark Completed</button>
			<button className='btn btn-outline-danger btn-sm admin-order-action-btn' disabled={saving} onClick={onDeny}>Deny</button>
			<button className='btn btn-outline-dark btn-sm admin-order-action-btn' disabled={saving || !canPushFishbowl(order)} onClick={onFishbowl}>Push Fishbowl</button>
		</div>
	);
}

function OrderDetailModal({ order, loading, saving, onClose, onProcess, onComplete, onDeny, onFishbowl }) {
	const adminStatus = order?.adminReview?.status || "PENDING";
	const paymentStatus = order?.payment?.status || "PENDING";
	const fishbowlStatus = order?.fishbowlStatus || "";
	const total = formatMoneyFromCents(order?.amountTotalCents);

	return (
		<div className='admin-order-modal-backdrop' onClick={() => !saving && onClose()}>
			<div className='admin-order-detail-modal bg-white rounded-4' onClick={(e) => e.stopPropagation()}>
				<div className='admin-order-detail-header'>
					<div>
						<div className='text-main text-uppercase fs-5 fw-semibold'>Order Details</div>
						<div className='text-muted small'>{order?.orderNumber || "Loading…"}</div>
					</div>
					<button className='btn btn-sm btn-outline-dark' disabled={saving} onClick={onClose}>Close</button>
				</div>

				{loading ? (
					<div className='p-4 text-muted'>Loading…</div>
				) : !order ? (
					<div className='p-4 text-danger'>Order not found.</div>
				) : (
					<div className='admin-order-detail-body'>
						{paymentStatus === "FAILED" ? (
							<div className='alert alert-danger'>Do not process this order until payment is resolved.</div>
						) : null}

						<div className='admin-order-status-strip'>
							<div><div className='admin-order-status-label'>Payment</div><StatusPill type='payment' status={paymentStatus} mode={order?.payment?.mode} /></div>
							<div><div className='admin-order-status-label'>Admin</div><StatusPill status={adminStatus} /></div>
							<div><div className='admin-order-status-label'>Fishbowl</div><StatusPill type='fishbowl' status={fishbowlStatus} /></div>
						</div>

						<div className='admin-order-detail-grid'>
							<div className='admin-order-detail-card'>
								<div className='admin-order-detail-title'>Customer</div>
								<InfoRow label='Name' value={customerName(order)} />
								<InfoRow label='Company' value={order?.customer?.companyName} />
								<InfoRow label='Email' value={order?.customer?.email} />
								<InfoRow label='Phone' value={order?.customer?.phone} />
							</div>

							<div className='admin-order-detail-card'>
								<div className='admin-order-detail-title'>Order</div>
								<InfoRow label='Created' value={formatDate(order.createdAt)} />
								<InfoRow label='Total' value={total} />
								<InfoRow label='Payment Mode' value={order?.payment?.mode === "PAY_LATER" ? "Pay Later" : "Pay Now"} />
								<InfoRow label='Stripe PI' value={order?.payment?.stripePaymentIntentId} />
								<InfoRow label='Confirmation Email' value={order?.confirmationEmail?.sentAt ? `Sent ${formatDate(order.confirmationEmail.sentAt)}` : order?.confirmationEmail?.lastError ? `Failed: ${order.confirmationEmail.lastError}` : "Not sent yet"} />
							</div>

							<AddressBlock title='Billing Address' address={order.billingAddress} />
							<AddressBlock title='Shipping Address' address={order.shippingAddress} sameAsBilling={order.shippingSameAsBilling} />
						</div>

						<div className='admin-order-detail-card mt-3'>
							<div className='d-flex justify-content-between flex-wrap gap-2 align-items-center mb-2'>
								<div className='admin-order-detail-title mb-0'>Line Items</div>
								<div className='text-main fw-semibold'>{total}</div>
							</div>

							<div className='table-responsive'>
								<table className='table table-sm align-middle admin-order-items-table'>
									<thead>
										<tr>
											<th>Part #</th>
											<th>Description</th>
											<th className='text-end'>Qty</th>
											<th className='text-end'>Unit</th>
											<th className='text-end'>Line</th>
										</tr>
									</thead>
									<tbody>
										{(order.items || []).map((item, index) => (
											<tr key={`${item.partNumber}-${index}`}>
												<td className='fw-semibold'>{item.partNumber || "-"}</td>
												<td><div>{item.name || "-"}</div>{item.detail ? <div className='text-muted small'>{item.detail}</div> : null}</td>
												<td className='text-end'>{item.qty}</td>
												<td className='text-end'>{formatMoney(item.unitPrice)}</td>
												<td className='text-end fw-semibold'>{formatMoney(item.lineTotal)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						{order?.fishbowlError ? <div className='alert alert-warning mt-3 mb-0'><strong>Fishbowl error:</strong> <span className='admin-order-fishbowl-error'>{formatFishbowlError(order.fishbowlError)}</span></div> : null}
						{adminStatus === "DENIED" && order?.adminReview?.deniedReason ? <div className='alert alert-danger mt-3 mb-0'><strong>Denied reason:</strong> {order.adminReview.deniedReason}</div> : null}
					</div>
				)}

				{order ? (
					<div className='admin-order-detail-footer'>
						<OrderActionGrid order={order} saving={saving} showView={false} onProcess={onProcess} onComplete={onComplete} onDeny={onDeny} onFishbowl={onFishbowl} />
					</div>
				) : null}
			</div>
		</div>
	);
}

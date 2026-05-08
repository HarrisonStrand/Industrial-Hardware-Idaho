import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import "./AdminOrders.css";

const ADMIN_STATUS = [
	{ value: "", label: "All Admin Statuses" },
	{ value: "PENDING", label: "Pending" },
	{ value: "APPROVED_IN_PROGRESS", label: "Approved — In Progress" },
	{ value: "APPROVED_COMPLETED", label: "Approved — Completed" },
	{ value: "DENIED", label: "Denied" },
];

const PAYMENT_STATUS = [
	{ value: "", label: "All Payment Statuses" },
	{ value: "PENDING", label: "Pending" },
	{ value: "SUCCEEDED", label: "Succeeded" },
	{ value: "FAILED", label: "Failed" },
	{ value: "INVOICED", label: "Invoiced" },
];

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
			return "Approved — In Progress";
		case "APPROVED_COMPLETED":
			return "Approved — Completed";
		case "DENIED":
			return "Denied";
		default:
			return "Pending";
	}
}

export default function AdminOrders() {
	const [q, setQ] = useState("");
	const [adminStatus, setAdminStatus] = useState("");
	const [paymentStatus, setPaymentStatus] = useState("");
	const [page, setPage] = useState(1);
	const limit = 25;

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });

	const [denyOpen, setDenyOpen] = useState(false);
	const [denyReason, setDenyReason] = useState("");
	const [denyOrderId, setDenyOrderId] = useState(null);

	const qs = useMemo(() => {
		const params = new URLSearchParams();
		if (q) params.set("q", q);
		if (adminStatus) params.set("adminStatus", adminStatus);
		if (paymentStatus) params.set("paymentStatus", paymentStatus);
		params.set("page", String(page));
		params.set("limit", String(limit));
		return params.toString();
	}, [q, adminStatus, paymentStatus, page]);

	async function load() {
		setLoading(true);
		try {
			const res = await apiFetch(`/api/admin/orders?${qs}`);
			setData(res);
		} catch (e) {
			console.error(e);
			setData({ items: [], total: 0, totalPages: 1 });
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

	async function setReview(orderId, status, deniedReason = "") {
		setSaving(true);
		try {
			await apiFetch(`/api/admin/orders/${orderId}/review`, {
				method: "PATCH",
				body: { status, deniedReason },
			});
			await load();
		} catch (e) {
			console.error(e);
			alert(e?.message || "Failed to update order");
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

	return (
		<div>
			<div className='text-main text-uppercase mb-2 fs-4'>Orders</div>

			<form
				onSubmit={onSearchSubmit}
				className='d-flex gap-2 flex-wrap align-items-center mb-3'>
				<input
					className='form-control'
					style={{ maxWidth: 420 }}
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder='Search: order #, email, company, Stripe PI…'
				/>

				<select
					className='form-select'
					style={{ maxWidth: 280 }}
					value={adminStatus}
					onChange={(e) => {
						setAdminStatus(e.target.value);
						setPage(1);
					}}>
					{ADMIN_STATUS.map((s) => (
						<option key={s.value} value={s.value}>
							{s.label}
						</option>
					))}
				</select>

				<select
					className='form-select'
					style={{ maxWidth: 240 }}
					value={paymentStatus}
					onChange={(e) => {
						setPaymentStatus(e.target.value);
						setPage(1);
					}}>
					{PAYMENT_STATUS.map((s) => (
						<option key={s.value} value={s.value}>
							{s.label}
						</option>
					))}
				</select>

				<button className='btn btn-dark' disabled={saving}>
					Search
				</button>
			</form>

			<div className='table-responsive'>
				<table className='table align-middle'>
					<thead>
						<tr>
							<th>Created</th>
							<th>Order #</th>
							<th>Customer</th>
							<th>Company</th>
							<th>Total</th>
							<th>Payment</th>
							<th>Admin Status</th>
							<th className='text-end'>Actions</th>
						</tr>
					</thead>

					<tbody>
						{loading ? (
							<tr>
								<td colSpan='8' className='text-muted py-4'>
									Loading…
								</td>
							</tr>
						) : data.items.length === 0 ? (
							<tr>
								<td colSpan='8' className='text-muted py-4'>
									No orders found.
								</td>
							</tr>
						) : (
							data.items.map((o) => {
								const admin = o?.adminReview || {};
								const adminS = o?.adminReview?.status || "PENDING";
								const deniedReason = admin?.deniedReason || "";

								const customerName = [
									o?.customer?.firstName,
									o?.customer?.lastName,
								]
									.filter(Boolean)
									.join(" ");
								const customerEmail = o?.customer?.email || "-";
								const companyName = o?.customer?.companyName || "-";

								const total =
									typeof o.amountTotalCents === "number"
										? `$${(o.amountTotalCents / 100).toFixed(2)}`
										: "-";

								const payStatus = o?.payment?.status || "PENDING";

								return (
									<tr key={o._id}>
										<td>
											{o.createdAt
												? new Date(o.createdAt).toLocaleString()
												: "-"}
										</td>
										<td className='fw-semibold'>{o.orderNumber}</td>
										<td>
											<div>{customerName || "-"}</div>
											<div className='text-muted small'>{customerEmail}</div>
										</td>
										<td>{companyName}</td>
										<td>{total}</td>
										<td>
											<div className='fw-semibold'>{payStatus}</div>
											{o?.payment?.stripePaymentIntentId ? (
												<div className='text-muted small'>
													{o.payment.stripePaymentIntentId}
												</div>
											) : null}
										</td>
										<td>
											<span
												className={`status-pill ${adminStatusClass(adminS)}`}>
												{adminStatusLabel(adminS)}
											</span>

											{adminS === "DENIED" && o?.adminReview?.deniedReason ? (
												<div className='text-muted small mt-1'>
													Reason: {o.adminReview.deniedReason}
												</div>
											) : null}
										</td>

										<td className='text-end'>
											<div className='d-flex gap-2 justify-content-end flex-wrap'>
												<button
													className='btn btn-outline-dark btn-sm'
													disabled={saving}
													onClick={() =>
														setReview(o._id, "APPROVED_IN_PROGRESS")
													}>
													Approve → In Progress
												</button>

												<button
													className='btn btn-outline-dark btn-sm'
													disabled={saving}
													onClick={() =>
														setReview(o._id, "APPROVED_COMPLETED")
													}>
													Approve → Completed
												</button>

												<button
													className='btn btn-outline-danger btn-sm'
													disabled={saving}
													onClick={() => openDeny(o._id)}>
													Deny
												</button>
											</div>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			<div className='d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2'>
				<button
					className='btn btn-outline-dark'
					disabled={page <= 1 || loading}
					onClick={() => setPage((p) => p - 1)}>
					Prev
				</button>

				<div className='text-muted'>
					Page {page} of {data.totalPages} • {data.total} total
				</div>

				<button
					className='btn btn-outline-dark'
					disabled={page >= data.totalPages || loading}
					onClick={() => setPage((p) => p + 1)}>
					Next
				</button>
			</div>

			{/* Deny Modal */}
			{denyOpen ? (
				<div
					className='position-fixed top-0 start-0 w-100 h-100'
					style={{ background: "rgba(0,0,0,.55)", zIndex: 1050 }}
					onClick={() => !saving && setDenyOpen(false)}>
					<div
						className='bg-white rounded-4 p-3 p-sm-4'
						style={{ maxWidth: 520, margin: "12vh auto" }}
						onClick={(e) => e.stopPropagation()}>
						<div className='d-flex justify-content-between align-items-center mb-2'>
							<div className='fw-semibold fs-5'>Deny Order</div>
							<button
								className='btn btn-sm btn-outline-dark'
								disabled={saving}
								onClick={() => setDenyOpen(false)}>
								Close
							</button>
						</div>

						<div className='text-muted mb-2'>
							Add a reason. This will be saved on the order.
						</div>

						<textarea
							className='form-control mb-3'
							rows={4}
							value={denyReason}
							onChange={(e) => setDenyReason(e.target.value)}
							placeholder='Reason for denial…'
						/>

						<div className='d-flex justify-content-end gap-2'>
							<button
								className='btn btn-outline-dark'
								disabled={saving}
								onClick={() => setDenyOpen(false)}>
								Cancel
							</button>
							<button
								className='btn btn-danger'
								disabled={saving || !denyReason.trim()}
								onClick={submitDeny}>
								Deny Order
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}

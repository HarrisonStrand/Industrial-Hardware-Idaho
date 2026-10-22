import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";
import "./OrderConfirmation.css";

function formatMoneyFromCents(value) {
	return `$${(Number(value || 0) / 100).toFixed(2)}`;
}

function getConfirmationMessage(order = {}) {
	const paymentMode = order?.payment?.mode || "PAY_NOW";
	const paymentStatus = order?.payment?.status || "PENDING";

	if (paymentStatus === "SUCCEEDED") {
		return {
			title: "Payment received. Your order has been submitted.",
			body: "IHI will review the order details and begin processing it shortly.",
			className: "text-success",
		};
	}

	if (paymentStatus === "INVOICED" || paymentMode === "PAY_LATER") {
		return {
			title: "Your order has been submitted for review.",
			body: "This order was placed using pay later / invoice terms. IHI will review and process it from the admin order queue.",
			className: "text-main",
		};
	}

	if (paymentStatus === "FAILED") {
		return {
			title: "Payment failed. This order cannot be processed yet.",
			body: "Please contact IHI or try checking out again with a different payment method.",
			className: "text-danger",
		};
	}

	return {
		title: "Confirming your payment…",
		body:
			"Your payment is being verified securely. " +
			"This page will update automatically once payment is confirmed. " +
			"Please do not submit another payment for this order.",
		className: "text-warning",
	};
}

export default function OrderConfirmation() {
	const { orderId } = useParams();
	const [loading, setLoading] = useState(true);
	const [order, setOrder] = useState(null);
	const [err, setErr] = useState("");

	useEffect(() => {
		let active = true;
		let timer = null;
		let attempts = 0;

		const MAX_ATTEMPTS = 12;
		const POLL_INTERVAL_MS = 3000;

		setLoading(true);
		setErr("");
		setOrder(null);

		async function loadOrder() {
			try {
				const data = await apiFetch(`/api/orders/${orderId}`);

				if (!active) return;

				const nextOrder = data?.order;

				if (!nextOrder) {
					throw new Error("Order not found");
				}

				setOrder(nextOrder);
				setErr("");

				const paymentMode = nextOrder.payment?.mode;
				const paymentStatus = nextOrder.payment?.status;

				const stillPending =
					paymentMode === "PAY_NOW" && paymentStatus === "PENDING";

				if (stillPending && attempts < MAX_ATTEMPTS) {
					attempts += 1;

					timer = setTimeout(loadOrder, POLL_INTERVAL_MS);
				}
			} catch (error) {
				if (!active) return;

				if (attempts === 0) {
					setErr(error.message);
				} else if (attempts < MAX_ATTEMPTS) {
					attempts += 1;
					timer = setTimeout(loadOrder, POLL_INTERVAL_MS);
				}
			} finally {
				if (active) setLoading(false);
			}
		}

		loadOrder();

		return () => {
			active = false;
			if (timer) clearTimeout(timer);
		};
	}, [orderId]);

	if (loading) {
		return (
			<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2'>
						Order Confirmation
					</div>
					<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-5'>
						<div className='text-muted'>Loading…</div>
					</div>
				</div>
			</div>
		);
	}

	if (err || !order) {
		return (
			<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2'>
						Order Confirmation
					</div>
					<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-5'>
						<div className='text-danger'>{err || "Order not found"}</div>
						<Link
							className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light mt-3 d-inline-block px-4 text-decoration-none text-center'
							to='/products'>
							Continue Shopping
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const message = getConfirmationMessage(order);
	const total = formatMoneyFromCents(order.amountTotalCents);

	return (
		<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
			<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
				<div className='text-main text-uppercase mb-1 fs-2'>
					Order Confirmation
				</div>

				<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-5'>
					<div className={`fw-semibold fs-5 ${message.className}`}>
						{message.title}
					</div>
					<div className='text-muted mt-1'>{message.body}</div>

					<div className='row g-3 mt-3'>
						<div className='col-12 col-md-4'>
							<div className='border rounded-4 p-3 h-100 bg-main-light shadow-sm'>
								<div className='text-muted small text-uppercase'>Order #</div>
								<div className='text-main fw-semibold'>{order.orderNumber}</div>
							</div>
						</div>
						<div className='col-12 col-md-4'>
							<div className='border rounded-4 p-3 h-100 bg-main-light shadow-sm'>
								<div className='text-muted small text-uppercase'>Payment</div>
								<div className='text-main fw-semibold'>
									{order?.payment?.status || "PENDING"}
								</div>
							</div>
						</div>
						<div className='col-12 col-md-4'>
							<div className='border rounded-4 p-3 h-100 bg-main-light shadow-sm'>
								<div className='text-muted small text-uppercase'>Total</div>
								<div className='text-main fw-semibold'>{total}</div>
							</div>
						</div>
					</div>

					<div className='mt-4'>
						{(order.items || []).map((it, idx) => (
							<div
								key={idx}
								className='d-flex justify-content-between py-2 border-bottom gap-3'>
								<div className='text-main'>
									<div className='fw-semibold'>{it.name || it.partNumber}</div>
									<div className='text-muted small'>
										{it.partNumber ? `${it.partNumber} • ` : ""}
										{it.detail ? `${it.detail} • ` : ""}Qty {it.qty}
									</div>
									{Number(it.qtyBackordered || 0) > 0 ? (
										<div
											className='small fw-semibold'
											style={{ color: "#8a5a00" }}>
											{Number(it.qtyInStock || 0) > 0
												? `${Number(it.qtyInStock).toLocaleString()} ship now · ${Number(it.qtyBackordered).toLocaleString()} backordered`
												: `Backordered (${Number(it.qtyBackordered).toLocaleString()}) · ships when restocked`}
										</div>
									) : null}
								</div>
								<div className='text-main fw-semibold text-nowrap'>
									${Number(it.lineTotal || 0).toFixed(2)}
								</div>
							</div>
						))}

						<div className='d-flex justify-content-between pt-3'>
							<div className='text-main text-uppercase'>Total</div>
							<div className='text-main fw-semibold fs-4'>{total}</div>
						</div>
					</div>

					<div className='text-muted small mt-3'>
						Confirmation email:{" "}
						{order?.confirmationEmail?.sentAt
							? "sent"
							: "will be sent shortly if email is configured"}{" "}
						to{" "}
						<span className='text-main fw-semibold'>
							{order.customer?.email}
						</span>
					</div>

					<div className='mt-4 d-flex flex-wrap gap-2'>
						<Link
							className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light px-4 text-decoration-none text-center'
							to='/products'>
							Continue Shopping
						</Link>
						<Link
							className='btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 text-main px-4 text-decoration-none text-center'
							to='/profile'>
							Account
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}

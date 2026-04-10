import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { apiFetch } from "../../utils/apiFetch";

import {
	Elements,
	CardNumberElement,
	CardExpiryElement,
	CardCvcElement,
	useElements,
	useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import "./Checkout.css";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const US_STATES = [
	"AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
	"KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
	"NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
	"VA","WA","WV","WI","WY",
];

function normalizeAddress(a) {
	return {
		address1: a?.address1 || "",
		address2: a?.address2 || "",
		city: a?.city || "",
		state: a?.state || "",
		zip: a?.zip || "",
	};
}

function formatAccountType(type) {
	if (type === "NET30") return "Net 30";
	if (type === "HOUSE") return "House Account";
	return "Retail";
}

export default function Checkout() {
	const navigate = useNavigate();
	const { user, setUser } = useAuth();
	const { showToast } = useToast();
	const { items, cartTotal, clearCart } = useCart();

	const [loading, setLoading] = useState(true);
	const [caps, setCaps] = useState(null);

	const [payMode, setPayMode] = useState("PAY_NOW");
	const [payLaterType, setPayLaterType] = useState("NET30");

	const hasCardOnFile = Boolean(user?.payment?.hasCardOnFile);
	const [cardSummary, setCardSummary] = useState(null);

	const [useDifferentCard, setUseDifferentCard] = useState(!hasCardOnFile);
	const [saveThisCard, setSaveThisCard] = useState(true);

	const [placing, setPlacing] = useState(false);
	const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);

	const [billing, setBilling] = useState({
		firstName: "",
		lastName: "",
		email: "",
		phone: "",
		address: normalizeAddress({}),
	});

	const [shipping, setShipping] = useState({
		firstName: "",
		lastName: "",
		phone: "",
		address: normalizeAddress({}),
	});

	const canUseNet30 = Boolean(caps?.canUseNet30);
	const canUseHouse = Boolean(caps?.canUseHouse);

	const payLaterAllowed =
		(payLaterType === "NET30" && canUseNet30) ||
		(payLaterType === "HOUSE" && canUseHouse);

	const manualCardActive =
		payMode === "PAY_NOW" && (!hasCardOnFile || useDifferentCard);

	const amountCents = useMemo(() => {
		return Math.max(0, Math.round(Number(cartTotal || 0) * 100));
	}, [cartTotal]);

	const orderItemsPayload = useMemo(() => {
		return items.map((it) => ({
			productId: it.productId || null,
			partNumber: it.partNumber || it.sku || "",
			sku: it.sku || "",
			name: it.name || it.partNumber || "Product",
			qty: Math.max(1, Number(it.quantity || 1)),
			unitPrice: Number(it.price || 0),
			attributes: it.attributes || {},
			category: it.metadata?.category || "",
			subcategory: it.metadata?.subcategory || "",
			shortDescription: it.metadata?.shortDescription || "",
			groupedPartNumbers: Array.isArray(it.metadata?.groupedPartNumbers)
				? it.metadata.groupedPartNumbers
				: [],
			duplicateCount: Number(it.metadata?.duplicateCount || 1),
		}));
	}, [items]);

	useEffect(() => {
		if (!user) return;

		setBilling({
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			email: user.email || "",
			phone: user.phone || "",
			address: normalizeAddress(user.billingAddress),
		});

		setShipping({
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			phone: user.phone || "",
			address: normalizeAddress(user.deliveryAddress),
		});

		const hasSaved = Boolean(user?.payment?.hasCardOnFile);
		setUseDifferentCard(!hasSaved);
	}, [user]);

	useEffect(() => {
		if (!shippingSameAsBilling) return;
		setShipping((prev) => ({
			...prev,
			firstName: billing.firstName,
			lastName: billing.lastName,
			phone: billing.phone,
			address: { ...billing.address },
		}));
	}, [
		shippingSameAsBilling,
		billing.firstName,
		billing.lastName,
		billing.phone,
		billing.address,
	]);

	useEffect(() => {
		let alive = true;

		async function load() {
			try {
				setLoading(true);

				const cap = await apiFetch("/api/checkout/capabilities");
				if (!alive) return;
				setCaps(cap);

				if (hasCardOnFile) {
					const cs = await apiFetch("/api/billing/card-summary").catch(() => null);
					if (!alive) return;
					setCardSummary(cs?.card || null);
				} else {
					setCardSummary(null);
				}

				setUseDifferentCard(!hasCardOnFile);
			} catch {
				// global 401 handling should redirect
			} finally {
				if (alive) setLoading(false);
			}
		}

		load();
		return () => {
			alive = false;
		};
	}, [hasCardOnFile]);

	async function refreshMe() {
		const me = await apiFetch("/api/auth/me");
		setUser(me.user);
	}

	function setBillingField(key, value) {
		setBilling((p) => ({ ...p, [key]: value }));
	}
	function setShippingField(key, value) {
		setShipping((p) => ({ ...p, [key]: value }));
	}
	function setBillingAddressField(key, value) {
		setBilling((p) => ({ ...p, address: { ...p.address, [key]: value } }));
	}
	function setShippingAddressField(key, value) {
		setShipping((p) => ({ ...p, address: { ...p.address, [key]: value } }));
	}

	function validateAddresses() {
		const req = (v) => String(v || "").trim().length > 0;

		if (!req(billing.firstName)) return "Billing first name is required";
		if (!req(billing.lastName)) return "Billing last name is required";
		if (!req(billing.email)) return "Email is required";
		if (!req(billing.phone)) return "Billing phone is required";
		if (!req(billing.address.address1)) return "Billing address is required";
		if (!req(billing.address.city)) return "Billing city is required";
		if (!req(billing.address.state)) return "Billing state is required";
		if (!req(billing.address.zip)) return "Billing ZIP is required";

		if (!shippingSameAsBilling) {
			if (!req(shipping.firstName)) return "Shipping first name is required";
			if (!req(shipping.lastName)) return "Shipping last name is required";
			if (!req(shipping.phone)) return "Shipping phone is required";
			if (!req(shipping.address.address1)) return "Shipping address is required";
			if (!req(shipping.address.city)) return "Shipping city is required";
			if (!req(shipping.address.state)) return "Shipping state is required";
			if (!req(shipping.address.zip)) return "Shipping ZIP is required";
		}

		return "";
	}

	async function persistCheckoutInfoToProfile() {
		const payload = {
			firstName: billing.firstName,
			lastName: billing.lastName,
			email: billing.email,
			phone: billing.phone,
			billingAddress: { ...billing.address },
			deliveryAddress: shippingSameAsBilling
				? { ...billing.address }
				: { ...shipping.address },
		};

		const data = await apiFetch("/api/users/me", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (data?.user) setUser(data.user);
	}

	async function requestAccount(type) {
		setPlacing(true);
		try {
			await apiFetch("/api/checkout/request-account-type", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ requestedType: type }),
			});

			await refreshMe();
			const cap = await apiFetch("/api/checkout/capabilities");
			setCaps(cap);

			showToast({
				variant: "success",
				message: "Request submitted. Awaiting admin approval.",
			});
		} catch (e) {
			showToast({ variant: "danger", message: e.message });
		} finally {
			setPlacing(false);
		}
	}

	async function placePayLaterOrder() {
		if (!payLaterAllowed) {
			showToast({
				variant: "danger",
				message: "Pay later requires admin approval. You can still pay now.",
			});
			return;
		}

		const addrErr = validateAddresses();
		if (addrErr) {
			showToast({ variant: "danger", message: addrErr });
			return;
		}

		setPlacing(true);
		try {
			await persistCheckoutInfoToProfile();

			const data = await apiFetch("/api/checkout/pay-later/order", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					payLaterType,
					items: orderItemsPayload,
				}),
			});

			clearCart();
			showToast({
				variant: "success",
				message: "Order submitted for invoicing",
			});
			navigate(`/order-confirmation/${data.orderId}`);
		} catch (e) {
			showToast({ variant: "danger", message: e.message });
		} finally {
			setPlacing(false);
		}
	}

	async function placePayNowSavedCard() {
		const addrErr = validateAddresses();
		if (addrErr) {
			showToast({ variant: "danger", message: addrErr });
			return;
		}

		if (!hasCardOnFile) {
			showToast({
				variant: "danger",
				message: "No saved card found. Enter a card manually instead.",
			});
			return;
		}

		setPlacing(true);
		try {
			await persistCheckoutInfoToProfile();

			const data = await apiFetch("/api/checkout/pay-now/saved-card", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					amountCents,
					currency: "usd",
					items: orderItemsPayload,
					billingAddress: billing?.address,
					shippingAddress: shippingSameAsBilling
						? billing?.address
						: shipping?.address,
					shippingSameAsBilling: Boolean(shippingSameAsBilling),
				}),
			});

			clearCart();
			showToast({ variant: "success", message: "Payment successful" });

			if (data?.orderId) {
				navigate(`/order-confirmation/${data.orderId}`);
			} else {
				navigate(`/order-status?paymentIntentId=${data.paymentIntentId || ""}`);
			}
		} catch (e) {
			showToast({ variant: "danger", message: e.message });
		} finally {
			setPlacing(false);
		}
	}

	if (items.length === 0) {
		return (
			<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2'>Checkout</div>
					<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-5'>
						<div className='text-main'>Your cart is empty.</div>
						<Link
							className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light mt-3 d-inline-block px-4 text-center text-decoration-none'
							to='/products'>
							Browse Products
						</Link>
					</div>
				</div>
			</div>
		);
	}

	if (loading || !caps) {
		return (
			<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2'>Checkout</div>
					<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-5'>
						<div className='text-muted'>Loading…</div>
					</div>
				</div>
			</div>
		);
	}

	const account = caps.account || {};
	const approvalStatus = account.approvalStatus || "NONE";
	const approvedType = account.approvedType || "RETAIL";

	return (
		<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
			<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
				<div className='text-main text-uppercase mb-1 fs-2'>Checkout</div>

				<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-5'>
					<div className='fs-4 contact-form-title text-main text-uppercase text-start'>
						Order Summary
					</div>
					<div className='main-linebreak w-100 border-0 border-top border-main py-2 d-none d-sm-block' />

					<div className='mt-2'>
						{items.map((it) => (
							<div
								key={it.lineId}
								className='d-flex justify-content-between py-2 border-bottom'>
								<div className='text-main'>
									<div className='fw-semibold'>{it.name}</div>
									<div className='text-muted small'>
										Qty {it.quantity} • ${Number(it.price || 0).toFixed(2)} ea
									</div>
								</div>
								<div className='text-main fw-semibold'>
									${Number(it.lineTotal || 0).toFixed(2)}
								</div>
							</div>
						))}

						<div className='d-flex justify-content-between pt-3'>
							<div className='text-main text-uppercase'>Total</div>
							<div className='text-main fw-semibold fs-4'>
								${cartTotal.toFixed(2)}
							</div>
						</div>
					</div>

					<div className='mt-3 text-muted small'>
						Account:{" "}
						<span className='text-main fw-semibold text-uppercase'>
							{formatAccountType(approvedType)}
						</span>{" "}
						•{" "}
						<span
							className={
								approvalStatus === "APPROVED"
									? "text-success fw-semibold"
									: approvalStatus === "PENDING"
									? "text-warning fw-semibold"
									: approvalStatus === "REJECTED"
									? "text-danger fw-semibold"
									: "text-muted fw-semibold"
							}>
							{approvalStatus === "NONE" ? "RETAIL" : approvalStatus}
						</span>
					</div>

					<div className='profile-link-box row align-items-center justify-content-center rounded-4 border border-3 border-main py-3 py-sm-2 py-xl-4 px-3 px-xl-5 fw-semibold g-0 mt-4'>
						<div className='fs-4 contact-form-title text-main text-uppercase text-start'>
							Billing
						</div>
						<div className='main-linebreak w-100 border-0 border-top border-main py-2 d-none d-sm-block'></div>

						<div className='row g-3 py-3'>
							<div className='col-12 col-md-6'>
								<label className='form-input-label text-uppercase form-label text-main mb-0'>First name</label>
								<input className='form-input form-control rounded-3 text-dark' value={billing.firstName} onChange={(e) => setBillingField("firstName", e.target.value)} />
							</div>

							<div className='col-12 col-md-6'>
								<label className='form-input-label text-uppercase form-label text-main mb-0'>Last name</label>
								<input className='form-input form-control rounded-3 text-dark' value={billing.lastName} onChange={(e) => setBillingField("lastName", e.target.value)} />
							</div>

							<div className='col-12 col-md-6'>
								<label className='form-input-label text-uppercase form-label text-main mb-0'>Email</label>
								<input className='form-input form-control rounded-3 text-dark' value={billing.email} onChange={(e) => setBillingField("email", e.target.value)} />
							</div>

							<div className='col-12 col-md-6'>
								<label className='form-input-label text-uppercase form-label text-main mb-0'>Phone</label>
								<input className='form-input form-control rounded-3 text-dark' value={billing.phone} onChange={(e) => setBillingField("phone", e.target.value)} />
							</div>

							<div className='col-12'>
								<label className='form-input-label text-uppercase form-label text-main mb-0'>Address</label>
								<input className='form-input form-control rounded-3 text-dark' value={billing.address.address1} onChange={(e) => setBillingAddressField("address1", e.target.value)} />
							</div>

							<div className='col-12'>
								<label className='form-input-label text-uppercase form-label text-main mb-0'>Address line 2</label>
								<input className='form-input form-control rounded-3 text-dark' value={billing.address.address2} onChange={(e) => setBillingAddressField("address2", e.target.value)} />
							</div>

							<div className='col-12 col-md-4'>
								<label className='form-input-label text-uppercase form-label text-main mb-0'>City</label>
								<input className='form-input form-control rounded-3 text-dark' value={billing.address.city} onChange={(e) => setBillingAddressField("city", e.target.value)} />
							</div>

							<div className='col-12 col-md-4'>
								<label className='form-input-label text-uppercase form-label text-main mb-0'>State</label>
								<select className='form-input form-control rounded-3 text-dark' value={billing.address.state} onChange={(e) => setBillingAddressField("state", e.target.value)}>
									<option value=''>Select</option>
									{US_STATES.map((s) => (
										<option key={s} value={s}>{s}</option>
									))}
								</select>
							</div>

							<div className='col-12 col-md-4'>
								<label className='form-input-label text-uppercase form-label text-main mb-0'>ZIP</label>
								<input className='form-input form-control rounded-3 text-dark' value={billing.address.zip} onChange={(e) => setBillingAddressField("zip", e.target.value)} />
							</div>
						</div>
					</div>

					<div className='mt-4'>
						<div className='form-check'>
							<input
								className='form-check-input'
								type='checkbox'
								id='shippingSame'
								checked={shippingSameAsBilling}
								onChange={(e) => setShippingSameAsBilling(e.target.checked)}
							/>
							<label className='form-check-label text-main fw-semibold' htmlFor='shippingSame'>
								Shipping is the same as billing
							</label>
						</div>

						{!shippingSameAsBilling && (
							<div className='profile-link-box row align-items-center justify-content-center rounded-4 border border-3 border-main py-3 py-sm-2 py-xl-4 px-3 px-xl-5 fw-semibold g-0 mt-3'>
								<div className='fs-4 contact-form-title text-main text-uppercase text-start'>
									Shipping
								</div>
								<div className='main-linebreak w-100 border-0 border-top border-main py-2 d-none d-sm-block'></div>

								<div className='row g-3 py-3'>
									<div className='col-12 col-md-6'>
										<label className='form-input-label text-uppercase form-label text-main mb-0'>First name</label>
										<input className='form-input form-control rounded-3 text-dark' value={shipping.firstName} onChange={(e) => setShippingField("firstName", e.target.value)} />
									</div>

									<div className='col-12 col-md-6'>
										<label className='form-input-label text-uppercase form-label text-main mb-0'>Last name</label>
										<input className='form-input form-control rounded-3 text-dark' value={shipping.lastName} onChange={(e) => setShippingField("lastName", e.target.value)} />
									</div>

									<div className='col-12 col-md-6'>
										<label className='form-input-label text-uppercase form-label text-main mb-0'>Phone</label>
										<input className='form-input form-control rounded-3 text-dark' value={shipping.phone} onChange={(e) => setShippingField("phone", e.target.value)} />
									</div>

									<div className='col-12'>
										<label className='form-input-label text-uppercase form-label text-main mb-0'>Address</label>
										<input className='form-input form-control rounded-3 text-dark' value={shipping.address.address1} onChange={(e) => setShippingAddressField("address1", e.target.value)} />
									</div>

									<div className='col-12'>
										<label className='form-input-label text-uppercase form-label text-main mb-0'>Address line 2</label>
										<input className='form-input form-control rounded-3 text-dark' value={shipping.address.address2} onChange={(e) => setShippingAddressField("address2", e.target.value)} />
									</div>

									<div className='col-12 col-md-4'>
										<label className='form-input-label text-uppercase form-label text-main mb-0'>City</label>
										<input className='form-input form-control rounded-3 text-dark' value={shipping.address.city} onChange={(e) => setShippingAddressField("city", e.target.value)} />
									</div>

									<div className='col-12 col-md-4'>
										<label className='form-input-label text-uppercase form-label text-main mb-0'>State</label>
										<select className='form-input form-control rounded-3 text-dark' value={shipping.address.state} onChange={(e) => setShippingAddressField("state", e.target.value)}>
											<option value=''>Select</option>
											{US_STATES.map((s) => (
												<option key={s} value={s}>{s}</option>
											))}
										</select>
									</div>

									<div className='col-12 col-md-4'>
										<label className='form-input-label text-uppercase form-label text-main mb-0'>ZIP</label>
										<input className='form-input form-control rounded-3 text-dark' value={shipping.address.zip} onChange={(e) => setShippingAddressField("zip", e.target.value)} />
									</div>
								</div>
							</div>
						)}
					</div>

					<div className='mt-4'>
						<div className='form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-2'>
							Payment
						</div>

						<div className='d-flex flex-column gap-2'>
							<label className='d-flex align-items-center gap-2'>
								<input type='radio' name='payMode' checked={payMode === "PAY_NOW"} onChange={() => setPayMode("PAY_NOW")} />
								<span className='text-main'>Pay now (Retail)</span>
							</label>

							<label className='d-flex align-items-center gap-2'>
								<input type='radio' name='payMode' checked={payMode === "PAY_LATER"} onChange={() => setPayMode("PAY_LATER")} />
								<span className='text-main'>Pay later (Invoice)</span>
							</label>
						</div>

						{payMode === "PAY_LATER" && (
							<div className='mt-3 p-3 rounded-3 border'>
								<div className='text-muted small mb-2'>
									Pay later requires admin approval for NET30 or HOUSE accounts.
								</div>

								<div className='d-flex flex-column flex-sm-row gap-2 align-items-sm-center'>
									<select
										className='form-input form-control rounded-3 text-dark'
										value={payLaterType}
										onChange={(e) => setPayLaterType(e.target.value)}
										disabled={placing}>
										<option value='NET30'>Net 30</option>
										<option value='HOUSE'>House Account</option>
									</select>

									{!payLaterAllowed && (
										<button
											className='btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 text-main px-4'
											onClick={() => requestAccount(payLaterType)}
											disabled={placing}>
											Request Approval
										</button>
									)}
								</div>

								{!payLaterAllowed && (
									<div className='text-danger small mt-2'>
										This pay later option is not available until approved. You can still select Pay now.
									</div>
								)}

								<button
									className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light mt-3 w-100'
									onClick={placePayLaterOrder}
									disabled={placing || !payLaterAllowed}>
									Place Order (Invoice)
								</button>
							</div>
						)}

						{payMode === "PAY_NOW" && (
							<div className='mt-3 p-3 rounded-3 border'>
								<div className='form-input-label text-uppercase text-main mb-2'>
									Card
								</div>

								{hasCardOnFile && (
									<div className='form-check mb-2'>
										<input
											className='form-check-input'
											type='checkbox'
											id='useSavedCard'
											checked={!useDifferentCard}
											onChange={(e) => setUseDifferentCard(!e.target.checked)}
										/>
										<label className='form-check-label text-main fw-semibold' htmlFor='useSavedCard'>
											Use saved card {cardSummary?.last4 ? `(•••• ${cardSummary.last4})` : ""}
										</label>
									</div>
								)}

								{!hasCardOnFile && (
									<div className='text-muted small'>
										No card on file. Please enter your card information below to complete checkout.
									</div>
								)}

								{manualCardActive && (
									<>
										<div className='form-check mt-2'>
											<input
												className='form-check-input'
												type='checkbox'
												id='saveThisCard'
												checked={saveThisCard}
												onChange={(e) => setSaveThisCard(e.target.checked)}
												disabled={placing}
											/>
											<label className='form-check-label text-main fw-semibold' htmlFor='saveThisCard'>
												Save this card for future purchases
											</label>
										</div>

										<div className='mt-3'>
											<PayNowManualCard
												amountCents={amountCents}
												saveThisCard={saveThisCard}
												placing={placing}
												setPlacing={setPlacing}
												validateAddresses={validateAddresses}
												persistCheckoutInfoToProfile={persistCheckoutInfoToProfile}
												billing={billing}
												shipping={shippingSameAsBilling ? billing : shipping}
												shippingSameAsBilling={shippingSameAsBilling}
												items={orderItemsPayload}
												clearCart={clearCart}
												navigate={navigate}
												showToast={showToast}
											/>
										</div>
									</>
								)}

								{!manualCardActive && (
									<button
										className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light mt-3 w-100'
										onClick={placePayNowSavedCard}
										disabled={placing}>
										{placing ? "Processing…" : "Pay & Place Order"}
									</button>
								)}

								<div className='text-muted small mt-2'>
									Tip: You can add/update your saved card in <Link to='/profile'>Account</Link>.
								</div>
							</div>
						)}
					</div>

					<div className='mt-4 d-flex justify-content-between ms-3'>
						<Link
							className='btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 text-main px-4 text-center text-decoration-none'
							to='/cart'>
							Back to Cart
						</Link>
					</div>

					<div className='text-muted small mt-3'>
						Orders are fulfilled through Fishbowl. This checkout captures payment + order details; Fishbowl is the operational source of truth for fulfillment.
					</div>
				</div>
			</div>
		</div>
	);
}

function PayNowManualCard({
	amountCents,
	saveThisCard,
	placing,
	setPlacing,
	validateAddresses,
	persistCheckoutInfoToProfile,
	billing,
	shipping,
	items,
	clearCart,
	navigate,
	showToast,
	shippingSameAsBilling,
}) {
	const [clientSecret, setClientSecret] = useState("");
	const [orderId, setOrderId] = useState("");
	const [loadingIntent, setLoadingIntent] = useState(false);

	useEffect(() => {
		let alive = true;

		async function createIntent() {
			setLoadingIntent(true);
			try {
				const data = await apiFetch("/api/checkout/pay-now/intent", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						amountCents,
						currency: "usd",
						saveThisCard,
						items,
						billingAddress: billing?.address,
						shippingAddress: shipping?.address,
						shippingSameAsBilling: Boolean(shippingSameAsBilling),
					}),
				});

				if (!alive) return;
				setClientSecret(data.clientSecret || "");
				setOrderId(data.orderId || "");
			} catch (e) {
				showToast({ variant: "danger", message: e.message });
			} finally {
				if (alive) setLoadingIntent(false);
			}
		}

		if (amountCents > 0) createIntent();

		return () => {
			alive = false;
		};
	}, [
		amountCents,
		saveThisCard,
		shippingSameAsBilling,
		items,
		billing,
		shipping,
		showToast,
	]);

	if (loadingIntent) {
		return <div className='text-muted small'>Preparing secure payment…</div>;
	}

	if (!clientSecret || !orderId) {
		return (
			<div className='text-muted small'>
				Unable to prepare payment. Check server logs.
			</div>
		);
	}

	return (
		<Elements stripe={stripePromise} options={{ clientSecret }}>
			<ManualCardInner
				placing={placing}
				setPlacing={setPlacing}
				validateAddresses={validateAddresses}
				persistCheckoutInfoToProfile={persistCheckoutInfoToProfile}
				clearCart={clearCart}
				navigate={navigate}
				showToast={showToast}
				clientSecret={clientSecret}
				orderId={orderId}
			/>
		</Elements>
	);
}

function ManualCardInner({
	placing,
	setPlacing,
	validateAddresses,
	persistCheckoutInfoToProfile,
	clearCart,
	navigate,
	showToast,
	clientSecret,
	orderId,
}) {
	const stripe = useStripe();
	const elements = useElements();

	const elementOptions = {
		style: {
			base: {
				fontSize: "16px",
				color: "#111111",
				fontFamily: "inherit",
				"::placeholder": { color: "#6c757d" },
			},
			invalid: { color: "#dc3545" },
		},
	};

	async function payAndPlace() {
		const addrErr = validateAddresses();
		if (addrErr) {
			showToast({ variant: "danger", message: addrErr });
			return;
		}

		if (!stripe || !elements) {
			showToast({
				variant: "danger",
				message: "Payment form is still loading.",
			});
			return;
		}

		if (!clientSecret || !orderId) {
			showToast({
				variant: "danger",
				message: "Payment is not ready yet. Please try again.",
			});
			return;
		}

		setPlacing(true);
		try {
			await persistCheckoutInfoToProfile();

			const cardEl = elements.getElement(CardNumberElement);
			if (!cardEl) {
				showToast({
					variant: "danger",
					message: "Card field is not ready yet.",
				});
				return;
			}

			const result = await stripe.confirmCardPayment(clientSecret, {
				payment_method: { card: cardEl },
			});

			if (result.error) {
				showToast({
					variant: "danger",
					message: result.error.message || "Payment failed",
				});
				return;
			}

			const pi = result.paymentIntent;
			if (pi?.status !== "succeeded") {
				showToast({
					variant: "danger",
					message: `Payment status: ${pi?.status || "unknown"}`,
				});
				return;
			}

			clearCart();
			showToast({ variant: "success", message: "Payment successful" });
			navigate(`/order-confirmation/${orderId}`);
		} catch (e) {
			showToast({ variant: "danger", message: e.message });
		} finally {
			setPlacing(false);
		}
	}

	return (
		<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-4'>
			<div className='row g-3'>
				<div className='col-12'>
					<label className='form-input-label text-uppercase form-label text-main mb-0'>
						Card number
					</label>
					<div className='form-input form-control rounded-3 text-dark d-flex align-items-center'>
						<CardNumberElement options={elementOptions} />
					</div>
				</div>

				<div className='col-6'>
					<label className='form-input-label text-uppercase form-label text-main mb-0'>
						Expiration
					</label>
					<div className='form-input form-control rounded-3 text-dark d-flex align-items-center'>
						<CardExpiryElement options={elementOptions} />
					</div>
				</div>

				<div className='col-6'>
					<label className='form-input-label text-uppercase form-label text-main mb-0'>
						CVC
					</label>
					<div className='form-input form-control rounded-3 text-dark d-flex align-items-center'>
						<CardCvcElement options={elementOptions} />
					</div>
				</div>
			</div>

			<div className='d-flex justify-content-end pt-3'>
				<button
					className='btn-main-cta px-4 rounded-3 text-uppercase fw-regular py-2 text-main-light'
					onClick={payAndPlace}
					disabled={placing}>
					{placing ? "Processing…" : "Pay & Place Order"}
				</button>
			</div>
		</div>
	);
}
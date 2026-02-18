import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { apiFetch } from "../../utils/apiFetch";

import "./Checkout.css";

export default function Checkout() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const { items, cartTotal, clearCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [caps, setCaps] = useState(null);

  const [payMode, setPayMode] = useState("PAY_NOW"); // PAY_NOW or PAY_LATER
  const [payLaterType, setPayLaterType] = useState("NET30"); // NET30 or HOUSE

  const [cardSummary, setCardSummary] = useState(null);
  const hasCardOnFile = Boolean(user?.payment?.hasCardOnFile);

  const [useSavedCard, setUseSavedCard] = useState(hasCardOnFile);
  const [saveThisCard, setSaveThisCard] = useState(true);

  const [placing, setPlacing] = useState(false);

  const canUseNet30 = Boolean(caps?.canUseNet30);
  const canUseHouse = Boolean(caps?.canUseHouse);

  const payLaterAllowed =
    (payLaterType === "NET30" && canUseNet30) ||
    (payLaterType === "HOUSE" && canUseHouse);

  const orderItemsPayload = useMemo(() => {
    return items.map((it) => ({
      partNumber: it.partNumber,
      name: it.name || it.partNumber,
      detail: [
        it.attributes?.diameter && it.attributes?.length
          ? `${it.attributes.diameter} × ${it.attributes.length}`
          : "",
        it.attributes?.thread || "",
        it.attributes?.grade || "",
        it.attributes?.finish || ""
      ]
        .filter(Boolean)
        .join(" • "),
      qty: Number(it.quantity || 0),
      unitPrice: Number(it.price || 0),
      lineTotal: Number(it.lineTotal || 0)
    }));
  }, [items]);

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

        // default payment choice
        setUseSavedCard(Boolean(hasCardOnFile));
      } catch (e) {
        // if auth expired, your global handler will redirect
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

  async function placePayLaterOrder() {
    if (!payLaterAllowed) {
      showToast({
        variant: "danger",
        message: "Pay later requires admin approval. You can still pay now."
      });
      return;
    }

    setPlacing(true);
    try {
      const data = await apiFetch("/api/checkout/pay-later/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payLaterType,
          items: orderItemsPayload
        })
      });

      clearCart();
      showToast({ variant: "success", message: "Order submitted for invoicing" });
      navigate(`/order-status?orderId=${data.orderId}`);
    } catch (e) {
      showToast({ variant: "danger", message: e.message });
    } finally {
      setPlacing(false);
    }
  }

  async function requestAccount(type) {
    setPlacing(true);
    try {
      await apiFetch("/api/checkout/request-account-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedType: type })
      });
      await refreshMe();
      const cap = await apiFetch("/api/checkout/capabilities");
      setCaps(cap);

      showToast({
        variant: "success",
        message: "Request submitted. Awaiting admin approval."
      });
    } catch (e) {
      showToast({ variant: "danger", message: e.message });
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
        <div className="theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
          <div className="text-main text-uppercase mb-1 fs-2">Checkout</div>
          <div className="theme-detail-container py-3 rounded-4 px-3 px-sm-5">
            <div className="text-main">Your cart is empty.</div>
            <Link className="btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light mt-3 d-inline-block px-4" to="/products">
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !caps) {
    return (
      <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
        <div className="theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
          <div className="text-main text-uppercase mb-1 fs-2">Checkout</div>
          <div className="theme-detail-container py-3 rounded-4 px-3 px-sm-5">
            <div className="text-muted">Loading…</div>
          </div>
        </div>
      </div>
    );
  }

  const account = caps.account || {};
  const approvalStatus = account.approvalStatus || "NONE";
  const approvedType = account.approvedType || "RETAIL";

  return (
    <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
      <div className="theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
        <div className="text-main text-uppercase mb-1 fs-2">Checkout</div>

        <div className="theme-detail-container py-3 rounded-4 px-3 px-sm-5">
          {/* ORDER SUMMARY */}
          <div className="fs-4 contact-form-title text-main text-uppercase text-start">
            Order Summary
          </div>
          <div className="main-linebreak w-100 border-0 border-top border-main py-2 d-none d-sm-block" />

          <div className="mt-2">
            {items.map((it) => (
              <div key={it.partNumber} className="d-flex justify-content-between py-2 border-bottom">
                <div className="text-main">
                  <div className="fw-semibold">{it.name}</div>
                  <div className="text-muted small">
                    Qty {it.quantity} • ${Number(it.price || 0).toFixed(2)} ea
                  </div>
                </div>
                <div className="text-main fw-semibold">
                  ${Number(it.lineTotal || 0).toFixed(2)}
                </div>
              </div>
            ))}

            <div className="d-flex justify-content-between pt-3">
              <div className="text-main text-uppercase">Total</div>
              <div className="text-main fw-semibold fs-4">
                ${cartTotal.toFixed(2)}
              </div>
            </div>
          </div>

          {/* PAYMENT MODE */}
          <div className="mt-4">
            <div className="form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-2">
              Payment
            </div>

            <div className="d-flex flex-column gap-2">
              <label className="d-flex align-items-center gap-2">
                <input
                  type="radio"
                  name="payMode"
                  checked={payMode === "PAY_NOW"}
                  onChange={() => setPayMode("PAY_NOW")}
                />
                <span className="text-main">Pay now (Retail)</span>
              </label>

              <label className="d-flex align-items-center gap-2">
                <input
                  type="radio"
                  name="payMode"
                  checked={payMode === "PAY_LATER"}
                  onChange={() => setPayMode("PAY_LATER")}
                />
                <span className="text-main">Pay later (Invoice)</span>
              </label>
            </div>

            {/* PAY LATER DETAILS + GATING */}
            {payMode === "PAY_LATER" && (
              <div className="mt-3 p-3 rounded-3 border">
                <div className="text-muted small mb-2">
                  Pay later requires admin approval for NET30 or HOUSE accounts.
                </div>

                <div className="d-flex flex-column flex-sm-row gap-2 align-items-sm-center">
                  <select
                    className="form-input form-control rounded-3 text-dark"
                    value={payLaterType}
                    onChange={(e) => setPayLaterType(e.target.value)}
                  >
                    <option value="NET30">Net 30</option>
                    <option value="HOUSE">House Account</option>
                  </select>

                  {!payLaterAllowed && (
                    <button
                      className="btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 text-main px-3"
                      onClick={() => requestAccount(payLaterType)}
                      disabled={placing}
                    >
                      Request Approval
                    </button>
                  )}
                </div>

                <div className="text-muted small mt-2">
                  Status:{" "}
                  <span className="text-main">
                    {approvalStatus === "APPROVED"
                      ? `Approved (${approvedType})`
                      : approvalStatus === "PENDING"
                      ? "Pending"
                      : approvalStatus === "REJECTED"
                      ? `Rejected${account.rejectionReason ? `: ${account.rejectionReason}` : ""}`
                      : "Not requested"}
                  </span>
                </div>

                {!payLaterAllowed && (
                  <div className="text-danger small mt-2">
                    This pay later option is not available until approved. You can still select Pay now.
                  </div>
                )}

                <button
                  className="btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light mt-3 w-100"
                  onClick={placePayLaterOrder}
                  disabled={placing || !payLaterAllowed}
                >
                  Place Order (Invoice)
                </button>
              </div>
            )}

            {/* PAY NOW SECTION (UI only for now; next step we wire PaymentIntents) */}
            {payMode === "PAY_NOW" && (
              <div className="mt-3 p-3 rounded-3 border">
                <div className="text-muted small mb-3">
                  Pay now will charge immediately (we’ll wire this next). For now, use Pay later only if approved.
                </div>

                {hasCardOnFile && (
                  <div className="d-flex flex-column gap-2">
                    <label className="d-flex align-items-center gap-2">
                      <input
                        type="radio"
                        name="cardChoice"
                        checked={useSavedCard === true}
                        onChange={() => setUseSavedCard(true)}
                      />
                      <span className="text-main">
                        Use saved card{" "}
                        {cardSummary?.last4
                          ? `(${(cardSummary.brand || "CARD").toUpperCase()} •••• ${cardSummary.last4})`
                          : ""}
                      </span>
                    </label>

                    <label className="d-flex align-items-center gap-2">
                      <input
                        type="radio"
                        name="cardChoice"
                        checked={useSavedCard === false}
                        onChange={() => setUseSavedCard(false)}
                      />
                      <span className="text-main">Use a different card</span>
                    </label>
                  </div>
                )}

                {!hasCardOnFile && (
                  <div className="text-main mb-2">Use a different card</div>
                )}

                {/* Save card toggle when entering new card */}
                {(!hasCardOnFile || useSavedCard === false) && (
                  <label className="d-flex align-items-center gap-2 mt-3">
                    <input
                      type="checkbox"
                      checked={saveThisCard}
                      onChange={(e) => setSaveThisCard(e.target.checked)}
                    />
                    <span className="text-main">Save this card for future purchases</span>
                  </label>
                )}

                <div className="mt-3">
                  <button
                    className="btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light w-100"
                    disabled
                  >
                    Pay Now (Coming Next)
                  </button>
                </div>

                <div className="text-muted small mt-2">
                  Tip: You can add/update your saved card in{" "}
                  <Link to="/profile">Account</Link>.
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Link className="btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 text-main px-4" to="/cart">
              Back to Cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

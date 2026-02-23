import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";
import "./OrderConfirmation.css";

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const data = await apiFetch(`/api/orders/${orderId}`);
        if (!alive) return;
        setOrder(data.order);
      } catch (e) {
        if (!alive) return;
        setErr(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
        <div className="theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
          <div className="text-main text-uppercase mb-1 fs-2">Order Confirmation</div>
          <div className="theme-detail-container py-3 rounded-4 px-3 px-sm-5">
            <div className="text-muted">Loading…</div>
          </div>
        </div>
      </div>
    );
  }

  if (err || !order) {
    return (
      <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
        <div className="theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
          <div className="text-main text-uppercase mb-1 fs-2">Order Confirmation</div>
          <div className="theme-detail-container py-3 rounded-4 px-3 px-sm-5">
            <div className="text-danger">{err || "Order not found"}</div>
            <Link
              className="btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light mt-3 d-inline-block px-4"
              to="/products"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const total = (Number(order.amountTotalCents || 0) / 100).toFixed(2);

  return (
    <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
      <div className="theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
        <div className="text-main text-uppercase mb-1 fs-2">Order Confirmation</div>

        <div className="theme-detail-container py-3 rounded-4 px-3 px-sm-5">
          <div className="text-main fw-semibold">
            Thank you — your order has been received.
          </div>

          <div className="text-muted small mt-1">
            Order #: <span className="text-main fw-semibold">{order.orderNumber}</span>
          </div>

          <div className="mt-3">
            {(order.items || []).map((it, idx) => (
              <div key={idx} className="d-flex justify-content-between py-2 border-bottom">
                <div className="text-main">
                  <div className="fw-semibold">{it.name || it.partNumber}</div>
                  <div className="text-muted small">
                    {it.detail ? `${it.detail} • ` : ""}Qty {it.qty}
                  </div>
                </div>
                <div className="text-main fw-semibold">
                  ${Number(it.lineTotal || 0).toFixed(2)}
                </div>
              </div>
            ))}

            <div className="d-flex justify-content-between pt-3">
              <div className="text-main text-uppercase">Total</div>
              <div className="text-main fw-semibold fs-4">${total}</div>
            </div>
          </div>

          <div className="text-muted small mt-3">
            Confirmation email sent to:{" "}
            <span className="text-main fw-semibold">{order.customer?.email}</span>
          </div>

          <div className="mt-4 d-flex gap-2">
            <Link
              className="btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light px-4"
              to="/products"
            >
              Continue Shopping
            </Link>
            <Link
              className="btn-secondary-cta rounded-3 text-uppercase fw-regular py-2 text-main px-4"
              to="/profile"
            >
              Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
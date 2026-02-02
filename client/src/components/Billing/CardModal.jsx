import { useEffect } from "react";
import CardOnFile from "./CardOnFile.jsx";
import { apiFetch } from "../../utils/apiFetch";
import "./CardModal.css";

export default function CardModal({
  open,
  onClose,

  hasCardOnFile,
  loadingCard,
  cardSummary,

  saving,
  removeCardOnFile,

  setCardSummary
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  async function refreshSummary() {
    try {
      const data = await apiFetch("/api/billing/card-summary");
      setCardSummary?.(data.card || null);
    } catch {
      setCardSummary?.(null);
    }
  }

  const currentLabel = !hasCardOnFile
    ? "None"
    : loadingCard
      ? "Loading..."
      : cardSummary?.last4
        ? `${(cardSummary.brand || "card").toUpperCase()} •••• ${cardSummary.last4}`
        : "On file";

  return (
    <div className="card-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="card-modal-content rounded-4"
        role="dialog"
        aria-modal="true"
        aria-label="Card on file"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header stays at top */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="text-main text-uppercase fw-semibold">Card On File</div>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={onClose}
          />
        </div>

        {/* ✅ Scrollable body */}
        <div className="card-modal-body">
          <div className="text-muted small mb-3">
            Add a card to speed up checkout. Your card details are securely stored
            by our payment processor (not in our database).
          </div>

          <div className="card-summary-box mb-3">
            <div className="card-summary-row">
              <div className="text-main text-uppercase fw-semibold">Current</div>
              <div className="card-summary-muted">{currentLabel}</div>
            </div>
          </div>

          <CardOnFile
            onDone={async () => {
              await refreshSummary();
              onClose?.();
            }}
          />

          {hasCardOnFile && (
            <div className="d-flex justify-content-end mt-3">
              <button
                className="btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light"
                onClick={removeCardOnFile}
                disabled={saving}
              >
                Remove Card
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

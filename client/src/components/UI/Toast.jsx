import { useEffect, forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ToastItem = forwardRef(function ToastItem({ toast, onClose }, ref) {
  const {
    id,
    message,
    variant = "success",
    actionLabel,
    action,
    duration = 2500
  } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const variantClass =
    {
      success: "alert-success",
      danger: "alert-danger",
      warning: "alert-warning",
      info: "alert-info"
    }[variant] || "alert-success";

  const iconClass =
    {
      success: "bi-check-circle",
      danger: "bi-exclamation-triangle",
      warning: "bi-exclamation-circle",
      info: "bi-info-circle"
    }[variant] || "bi-check-circle";

  return (
    <motion.div
      ref={ref} // ✅ IMPORTANT: give PopChild a real DOM ref
      layout
      initial={{ opacity: 0, y: -18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -18, scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 520,
        damping: 34
      }}
      className={`alert ${variantClass} d-flex align-items-center justify-content-between mb-2 shadow`}
      role="alert"
    >
      <div className="d-flex align-items-center">
        <i className={`bi ${iconClass} me-2`} />
        <span>{message}</span>
      </div>

      <div className="d-flex align-items-center gap-2">
        {actionLabel && typeof action === "function" && (
          <button
            type="button"
            className="btn btn-sm btn-outline-dark"
            onClick={() => action()}
          >
            {actionLabel}
          </button>
        )}

        <button
          type="button"
          className="btn-close"
          aria-label="Close"
          onClick={() => onClose?.(id)}
        />
      </div>
    </motion.div>
  );
});

export default function Toast({ toasts = [], onClose }) {
  return (
    <div
      className="position-fixed top-0 end-0 mt-3 me-3"
      style={{
        zIndex: 9999,
        width: "min(420px, 92vw)",
        pointerEvents: "none"
      }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <AnimatePresence initial={false} mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={onClose} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

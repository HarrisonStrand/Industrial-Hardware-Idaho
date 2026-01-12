import { createContext, useContext, useMemo, useState, useCallback } from "react";
import Toast from "../components/UI/Toast.jsx";

const ToastContext = createContext(null);

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }) {
  // Queue of toasts
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  /**
   * showToast({
   *   message: string,
   *   variant?: "success"|"danger"|"warning"|"info",
   *   actionLabel?: string,
   *   onAction?: () => void,
   *   duration?: number (ms),
   *   id?: string
   * })
   */
  const showToast = useCallback((opts) => {
    const {
      message = "",
      variant = "success",
      actionLabel = "",
      onAction = null,
      duration = 2500,
      id = makeId()
    } = opts || {};

    const toast = {
      id,
      message,
      variant,
      actionLabel,
      action: typeof onAction === "function" ? onAction : null,
      duration
    };

    setToasts((prev) => {
      // keep most recent 5 so it never grows forever
      const next = [...prev, toast];
      return next.slice(-5);
    });

    return id;
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      removeToast,
      clearToasts
    }),
    [showToast, removeToast, clearToasts]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Global Toast UI */}
      <Toast toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe
} from "@stripe/react-stripe-js";
import { apiFetch } from "../../utils/apiFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function CardOnFileInner({ onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const { setUser } = useAuth();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSaving(true);
    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required"
      });

      if (result.error) throw new Error(result.error.message);

      const setupIntentId = result.setupIntent?.id;
      if (!setupIntentId) throw new Error("No setup intent returned");

      const data = await apiFetch("/api/billing/confirm-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupIntentId })
      });

      setUser(data.user);
      showToast({ variant: "success", message: "Card saved on file" });
      onDone?.();
    } catch (err) {
      showToast({
        variant: "danger",
        message: err?.message || "Failed to save card"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <PaymentElement />

      <button
        type="submit"
        className="btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light mt-3"
        disabled={!stripe || saving}
      >
        {saving ? "Saving..." : "Save Card"}
      </button>
    </form>
  );
}

export default function CardOnFile({ onDone }) {
  const { showToast } = useToast();

  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);

      const data = await apiFetch("/api/billing/setup-intent", {
        method: "POST"
      });

      if (!mounted) return;
      setClientSecret(data.clientSecret || "");
    }

    init()
      .catch((e) => {
        console.error(e);
        showToast({
          variant: "danger",
          message: e?.message || "Failed to start secure card form"
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [showToast]);

  const options = useMemo(() => ({ clientSecret }), [clientSecret]);

  if (loading) {
    return <div className="text-muted small">Loading secure card form...</div>;
  }

  if (!clientSecret) {
    return (
      <div className="text-muted small">
        Unable to start card setup. Please close and try again.
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <CardOnFileInner onDone={onDone} />
    </Elements>
  );
}

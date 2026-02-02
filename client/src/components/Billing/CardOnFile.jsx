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
        message: err.message || "Failed to save card"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <div className="card-link-box rounded-4 py-3 px-3 px-xl-4 fw-semibold">
        <div className="form-input-label text-uppercase text-main ps-0 ps-sm-2 mb-2">
          Card Information
        </div>

        {/* Keep your wrapper here (this is the right place) */}
        <div className="billing-card-box">
          <PaymentElement />
        </div>
      </div>

      <div className="d-flex justify-content-end mt-3">
        <button
          type="submit"
          className="btn-main-cta rounded-3 text-uppercase fw-regular py-2 text-main-light"
          disabled={!stripe || saving}
        >
          {saving ? "Saving..." : "Save Card"}
        </button>
      </div>
    </form>
  );
}

export default function CardOnFile({ onDone }) {
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    let mounted = true;

    async function init() {
      const data = await apiFetch("/api/billing/setup-intent", { method: "POST" });
      if (mounted) setClientSecret(data.clientSecret);
    }

    init().catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const options = useMemo(() => {
    const root = getComputedStyle(document.documentElement);

    // Your theme vars (fallbacks included)
    const mainLight = root.getPropertyValue("--main-light").trim() || "#ffffff";
    const textMain = root.getPropertyValue("--text-main").trim() || "#111111";
    const textDark = root.getPropertyValue("--text-dark").trim() || "#111111";
    const borderMain =
      root.getPropertyValue("--border-main").trim() || "rgba(0,0,0,.18)";
      const fontMain = root.getPropertyValue("--font-main").trim();

    // Use a real font stack (inherit often won’t behave how you expect in Stripe)
    const fontStack =
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

    return {
      clientSecret,
      appearance: {
        theme: "none",
        variables: {
          fontFamily: fontStack,
          fontSizeBase: "14px",
          borderRadius: "14px",
          colorText: textMain,
          colorPrimary: textMain,
          colorBackground: "transparent",
          colorDanger: "#dc3545"
        },
        rules: {
          /* Make the overall element blocks transparent (so your modal shows through) */
          ".Block": {
            backgroundColor: "transparent",
            boxShadow: "none",
            padding: "0px"
          },

          /* Labels: match your uppercase styling */
          ".Label": {
            fontFamily: fontStack,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: "600",
            color: textMain
          },

          /* Inputs: white background, your border feel */
          ".Input": {
            backgroundColor: "#ffffff",
            border: `2px solid ${borderMain}`,
            borderRadius: "14px",
            padding: "12px 14px",
            boxShadow: "none",
            color: textMain
          },
          ".Input:focus": {
            borderColor: textMain,
            boxShadow: "none"
          },

          /* Tabs (Card / Link) */
          ".Tab": {
            backgroundColor: "transparent",
            border: `2px solid ${borderMain}`,
            borderRadius: "14px"
          },
          ".Tab--selected": {
            borderColor: textMain
          },

          /* Errors */
          ".Error": {
            color: "#dc3545"
          }
        }
      }
    };
  }, [clientSecret]);

  if (!clientSecret) return null;

  return (
    <Elements stripe={stripePromise} options={options}>
      <CardOnFileInner onDone={onDone} />
    </Elements>
  );
}

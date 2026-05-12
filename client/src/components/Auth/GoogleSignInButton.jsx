import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import "./GoogleSignInButton.css";

const GOOGLE_SCRIPT_ID = "google-identity-services-script";

function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({
  label = "Sign in with Google",
  onSuccess,
  onError,
  disabled = false,
}) {
  const buttonRef = useRef(null);
  const initializedRef = useRef(false);
  const { loginWithGoogle } = useAuth();
  const [ready, setReady] = useState(false);
  const [localError, setLocalError] = useState("");

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    let mounted = true;

    async function setupGoogleButton() {
      setLocalError("");

      if (!clientId) {
        setLocalError("Google sign-in is not configured yet.");
        return;
      }

      try {
        const google = await loadGoogleIdentityScript();
        if (!mounted || !buttonRef.current || initializedRef.current) return;

        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              if (!response?.credential) {
                throw new Error("Google did not return a sign-in credential.");
              }

              const user = await loginWithGoogle(response.credential);
              onSuccess?.(user);
            } catch (err) {
              const message = err?.message || "Google sign-in failed";
              setLocalError(message);
              onError?.(message);
            }
          },
        });

        google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: label.toLowerCase().includes("sign up") ? "signup_with" : "signin_with",
          shape: "rectangular",
          width: buttonRef.current.offsetWidth || 320,
        });

        initializedRef.current = true;
        setReady(true);
      } catch (err) {
        const message = err?.message || "Google sign-in could not load.";
        setLocalError(message);
        onError?.(message);
      }
    }

    setupGoogleButton();

    return () => {
      mounted = false;
    };
  }, [clientId, label, loginWithGoogle, onError, onSuccess]);

  if (!clientId) {
    return null;
  }

  return (
    <div className="google-signin-wrap" aria-disabled={disabled || !ready}>
      <div className="google-signin-button-shell">
        <div ref={buttonRef} className="google-signin-button-target" />
        {disabled ? <div className="google-signin-disabled-layer" /> : null}
      </div>

      {localError ? (
        <div className="small text-danger text-center mt-2">{localError}</div>
      ) : null}
    </div>
  );
}

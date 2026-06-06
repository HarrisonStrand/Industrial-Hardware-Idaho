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
  const initializedRef = useRef(false);
  const googleRef = useRef(null);
  const { loginWithGoogle } = useAuth();
  const [ready, setReady] = useState(false);
  const [localError, setLocalError] = useState("");

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    let mounted = true;

    async function setupGooglePrompt() {
      setLocalError("");

      if (!clientId) {
        setLocalError("Google sign-in is not configured yet.");
        return;
      }

      try {
        const google = await loadGoogleIdentityScript();
        if (!mounted || initializedRef.current) return;

        google.accounts.id.initialize({
          client_id: clientId,
          use_fedcm_for_prompt: true,
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

        googleRef.current = google;
        initializedRef.current = true;
        setReady(true);
      } catch (err) {
        const message = err?.message || "Google sign-in could not load.";
        setLocalError(message);
        onError?.(message);
      }
    }

    setupGooglePrompt();

    return () => {
      mounted = false;
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [clientId, loginWithGoogle, onError, onSuccess]);

  function handleGoogleSignIn() {
    if (disabled || !ready) return;

    setLocalError("");

    try {
      const google = googleRef.current || window.google;

      google?.accounts?.id?.prompt?.((notification) => {
        if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
          const reason =
            notification?.getNotDisplayedReason?.() ||
            notification?.getSkippedReason?.() ||
            "Google sign-in was not displayed.";

          setLocalError(`Google sign-in could not open: ${reason}`);
          onError?.(reason);
        }
      });
    } catch (err) {
      const message = err?.message || "Google sign-in could not open.";
      setLocalError(message);
      onError?.(message);
    }
  }

  if (!clientId) {
    return null;
  }

  return (
    <div className="google-signin-wrap" aria-disabled={disabled || !ready}>
      <div className="google-signin-button-shell">
        <button
          type="button"
          className="google-signin-button-visual google-signin-native-button rounded-3 text-uppercase fw-regular fs-5 py-2 text-main font-main"
          onClick={handleGoogleSignIn}
          disabled={disabled || !ready}
        >
          <span className="google-signin-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
              />
            </svg>
          </span>
          <span className="text-uppercase fw-regular text-main">{label}</span>
        </button>
      </div>

      {localError ? (
        <div className="small text-danger text-center mt-2">{localError}</div>
      ) : null}
    </div>
  );
}

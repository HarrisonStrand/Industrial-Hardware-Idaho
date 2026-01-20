// client/src/pages/Auth/ForgotPassword.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./ForgotPassword.css"; // optional (you can delete if not using)

export default function ForgotPassword() {
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email })
      });

      // server always returns success to avoid leaking account existence
      await res.json().catch(() => ({}));

      setSent(true);
      showToast({
        variant: "success",
        message: "If that email exists, we sent a reset link."
      });
    } catch {
      showToast({
        variant: "danger",
        message: "Could not send reset email. Please try again."
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
        <div className="login-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
          <div className="text-main text-uppercase mb-1 fs-2 px-0 ps-4">
            Forgot Password
          </div>

          <div className="login-detail-container py-4 fade-in rounded-4 px-3 px-sm-5">
            <div className="row m-0">
              {!sent ? (
                <form className="contact-form g-0 py-3" onSubmit={submit}>
                  <div className="row g-3 align-items-end justify-content-center">
                    <div className="col-12 col-lg-6">
                      <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
                        Enter your email
                      </label>
                      <input
                        type="email"
                        className="form-input form-control rounded-3 text-dark"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                      <div className="text-muted small mt-2 ps-0 ps-sm-2">
                        We’ll email you a secure link to reset your password.
                      </div>
                    </div>

                    <div className="col-12 col-xl-3 text-center">
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-2 text-main-light"
                      >
                        {loading ? "Sending..." : "Send reset link"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="text-center py-4">
                  <div className="text-main fw-semibold text-uppercase mb-2">
                    Check your email
                  </div>
                  <div className="text-muted">
                    If an account exists for{" "}
                    <span className="fw-semibold">{email}</span>, we sent a reset link.
                  </div>

                  <div className="mt-4">
                    <Link
                      to="/login"
                      className="btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-2 text-main-light text-decoration-none d-inline-block"
                    >
                      Back to login
                    </Link>
                  </div>
                </div>
              )}

              <div className="d-flex justify-content-center align-items-center mt-3">
                <small className="text-muted text-uppercase">
                  Remembered it?{" "}
                  <Link to="/login" className="text-decoration-none">
                    log in
                  </Link>
                </small>
              </div>

              <div className="d-flex justify-content-center align-items-center mt-2">
                <small className="text-muted text-uppercase">
                  Need an account?{" "}
                  <Link to="/register" className="text-decoration-none">
                    create one
                  </Link>
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ContactBanner />
    </>
  );
}

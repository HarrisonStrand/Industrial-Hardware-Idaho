// client/src/pages/Auth/ResetPassword.jsx
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./ResetPassword.css";

export default function ResetPassword() {
  const { showToast } = useToast();
  const { setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { token: pathToken = "" } = useParams();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = params.get("token") || pathToken || "";
  const email = params.get("email") || "";

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  const linkLooksValid = Boolean(token && email);

  async function submit(e) {
    e.preventDefault();

    if (!linkLooksValid) {
      showToast({ variant: "danger", message: "Invalid reset link." });
      return;
    }
    if (pw1.length < 8) {
      showToast({ variant: "warning", message: "Password must be at least 8 characters." });
      return;
    }
    if (pw1 !== pw2) {
      showToast({ variant: "warning", message: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          token,
          newPassword: pw1
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Reset failed");

      if (data.user) setUser(data.user);

      showToast({ variant: "success", message: "Password updated." });
      navigate("/profile", { replace: true });
    } catch (err) {
      showToast({
        variant: "danger",
        message: err?.message || "Reset failed. Please request a new link."
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="reset-password-page container-fluid px-3 px-sm-5 py-4 pt-md-5">
        <section className="theme-section-container reset-password-shell fade-in rounded-4 px-3 px-sm-5 py-4">
          <div className="reset-password-header text-center text-lg-start">
            <div className="text-main text-uppercase fs-2 reset-password-title">
              Reset Password
            </div>
            <p className="text-muted mb-0">
              Create a new password for your account.
            </p>
          </div>

          <div className="theme-detail-container reset-password-card fade-in rounded-4 px-3 px-sm-5 py-4 py-md-5 mt-3">
            {!linkLooksValid ? (
              <div className="text-center py-4 reset-password-invalid">
                <div className="text-main fw-semibold text-uppercase mb-2 fs-5">
                  Invalid link
                </div>
                <div className="text-muted mx-auto reset-password-help-text">
                  This reset link is missing information. Please request a new one.
                </div>

                <div className="mt-4">
                  <Link
                    to="/forgot-password"
                    className="btn-main-cta reset-password-submit rounded-3 text-uppercase fw-regular fs-5 py-2 text-main-light text-decoration-none d-inline-flex align-items-center justify-content-center"
                  >
                    Request new link
                  </Link>
                </div>
              </div>
            ) : (
              <form className="contact-form reset-password-form" onSubmit={submit}>
                <div className="row g-4 align-items-start justify-content-center reset-password-fields-row">
                  <div className="col-12 col-lg-5 col-xl-4">
                    <label className="form-input-label text-uppercase form-label text-main mb-1">
                      New password
                    </label>
                    <input
                      type="password"
                      className="form-input form-control rounded-3 text-dark reset-password-input"
                      value={pw1}
                      onChange={(e) => setPw1(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="col-12 col-lg-5 col-xl-4">
                    <label className="form-input-label text-uppercase form-label text-main mb-1">
                      Confirm password
                    </label>
                    <input
                      type="password"
                      className="form-input form-control rounded-3 text-dark reset-password-input"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="col-12 col-lg-10 col-xl-2 reset-password-action-col">
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-main-cta reset-password-submit rounded-3 text-uppercase fw-regular fs-5 py-2 text-main-light w-100"
                    >
                      {loading ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                <div className="text-muted small reset-password-password-note">
                  Minimum 8 characters.
                </div>

                <div className="reset-password-meta text-center mt-4">
                  <small className="text-muted">
                    Resetting password for{" "}
                    <span className="fw-semibold reset-password-email">{email}</span>
                  </small>
                </div>

                <div className="d-flex justify-content-center align-items-center mt-3 reset-password-back-link">
                  <small className="text-muted text-uppercase">
                    Back to{" "}
                    <Link to="/login" className="text-decoration-none">
                      log in
                    </Link>
                  </small>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>

      <ContactBanner />
    </>
  );
}

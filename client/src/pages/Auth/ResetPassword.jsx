// client/src/pages/Auth/ResetPassword.jsx
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./ResetPassword.css"; // optional

export default function ResetPassword() {
  const { showToast } = useToast();
  const { setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = params.get("token") || "";
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
      <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
        <div className="login-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
          <div className="text-main text-uppercase mb-1 fs-2 px-0 ps-4">
            Reset Password
          </div>

          <div className="login-detail-container py-4 fade-in rounded-4 px-3 px-sm-5">
            <div className="row m-0">
              {!linkLooksValid ? (
                <div className="text-center py-4">
                  <div className="text-main fw-semibold text-uppercase mb-2">
                    Invalid link
                  </div>
                  <div className="text-muted">
                    This reset link is missing information. Please request a new one.
                  </div>

                  <div className="mt-4">
                    <Link
                      to="/forgot-password"
                      className="btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-2 text-main-light text-decoration-none d-inline-block"
                    >
                      Request new link
                    </Link>
                  </div>
                </div>
              ) : (
                <form className="contact-form g-0 py-3" onSubmit={submit}>
                  <div className="row g-3 align-items-end justify-content-center">
                    <div className="col-12 col-lg-4">
                      <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
                        New password
                      </label>
                      <input
                        type="password"
                        className="form-input form-control rounded-3 text-dark"
                        value={pw1}
                        onChange={(e) => setPw1(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                      <div className="text-muted small mt-2 ps-0 ps-sm-2">
                        Minimum 8 characters.
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
                        Confirm password
                      </label>
                      <input
                        type="password"
                        className="form-input form-control rounded-3 text-dark"
                        value={pw2}
                        onChange={(e) => setPw2(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="col-12 col-xl-2 text-center">
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-2 text-main-light"
                      >
                        {loading ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>

                  <div className="text-center mt-3">
                    <small className="text-muted">
                      Resetting password for{" "}
                      <span className="fw-semibold">{email}</span>
                    </small>
                  </div>

                  <div className="d-flex justify-content-center align-items-center mt-3">
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
          </div>
        </div>
      </div>

      <ContactBanner />
    </>
  );
}

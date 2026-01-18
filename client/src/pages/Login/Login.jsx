import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./Login.css";

export default function Login() {
  const { user, loadingAuth, isAdmin, login } = useAuth();
  const { showToast } = useToast();

  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Stable "from"
  const from = useMemo(() => {
    return location.state?.from || "";
  }, [location.state?.from]);

  // ✅ If already signed in, redirect away from /login
  useEffect(() => {
    if (loadingAuth) return;
    if (!user) return;

    if (from) {
      navigate(from, { replace: true });
      return;
    }

    navigate(isAdmin ? "/admin" : "/profile", { replace: true });
  }, [user, loadingAuth, isAdmin, navigate, from]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      await login(email, password);
      showToast({ variant: "success", message: "Signed in" });

      // ✅ Redirect immediately (also fine if the useEffect handles it)
      if (from) navigate(from, { replace: true });
      else navigate(isAdmin ? "/admin" : "/profile", { replace: true });
    } catch (ex) {
      const msg = ex?.message || "Login failed";
      setErr(msg);
      showToast({ variant: "danger", message: msg });
    } finally {
      setLoading(false);
    }
  };

  if (loadingAuth) return null;
  if (user) return null;

  return (
    <>
      <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
        <div className="login-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
          <div className="text-main text-uppercase mb-1 fs-2 px-0 ps-4">
            Account Log-in
          </div>

          <div className="login-detail-container py-4 fade-in rounded-4 px-3 px-sm-5">
            <div className="row m-0">
              <form className="contact-form g-0 py-3" onSubmit={submit}>
                <div className="row g-3 align-items-end justify-content-center">
                  <div className="col-12 col-lg-4">
                    {err && <div style={{ color: "crimson" }}>{err}</div>}

                    <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
                      Username
                    </label>
                    <input
                      type="text"
                      name="email"
                      className="form-input form-control rounded-3 text-dark"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="col-12 col-lg-4">
                    <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
                      Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      className="form-input form-control rounded-3 text-dark"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="col-12 col-xl-2 text-center">
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-2 text-main-light"
                    >
                      {loading ? "Logging in..." : "submit"}
                    </button>
                  </div>
                </div>
              </form>

              <div className="d-flex justify-content-center align-items-center mt-3">
                <small className="text-muted text-uppercase">
                  Don’t have an account?{" "}
                  <Link to="/register" className="text-decoration-none">
                    create one
                  </Link>
                </small>
              </div>

              <div className="d-flex justify-content-center align-items-center mt-3">
                <small className="text-muted">
                  <Link
                    to="/forgot-password"
                    className="text-decoration-none text-muted text-uppercase"
                  >
                    Forgot username/password?
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

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./Register.css";

export default function Register() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        company: {
          companyName,
        },
      });

      showToast({ variant: "success", message: "Account created" });
      navigate("/profile", { replace: true });
    } catch (ex) {
      const msg = ex?.message || "Registration failed";
      setErr(msg);
      showToast({ variant: "danger", message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
        <div className="theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
          <div className="text-main text-uppercase mb-1 fs-2 px-0 ps-4">
            Create Account
          </div>

          <div className="theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5">
            <div className="row m-0 justify-content-center">
              <div className="col-12 col-xl-10">
                <form className="contact-form register-form g-0 py-3" onSubmit={submit}>
                  {err ? (
                    <div className="alert alert-danger rounded-3 mb-4" role="alert">
                      {err}
                    </div>
                  ) : null}

                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
                        First Name
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        className="form-input form-control rounded-3 text-dark"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        autoComplete="given-name"
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
                        Last Name
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        className="form-input form-control rounded-3 text-dark"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        autoComplete="family-name"
                      />
                    </div>

                    <div className="col-12 col-lg-6">
                      <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        className="form-input form-control rounded-3 text-dark"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>

                    <div className="col-12 col-lg-6">
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
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
                        Company Name
                      </label>
                      <input
                        type="text"
                        name="companyName"
                        className="form-input form-control rounded-3 text-dark"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        autoComplete="organization"
                      />
                    </div>

                    <div className="col-12 d-flex justify-content-center pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-2 text-main-light"
                      >
                        {loading ? "Creating..." : "Create Account"}
                      </button>
                    </div>
                  </div>
                </form>

                <div className="d-flex justify-content-center align-items-center mt-3">
                  <small className="text-muted text-uppercase">
                    Already have an account?{" "}
                    <Link to="/login" className="text-decoration-none">
                      sign in
                    </Link>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ContactBanner />
    </>
  );
}

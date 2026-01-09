import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import "./Register.css";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();

  // Basic user info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Account info
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Company info (simple now; expandable later)
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
          companyName
        }
      });

      nav("/dashboard");
    } catch (ex) {
      setErr(ex?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h2>Register</h2>

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      <input
        placeholder="First Name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
      />

      <input
        placeholder="Last Name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        required
      />

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {/* IMPORTANT:
          No "role" field here. Admin is assigned manually in DB (Option 1). */}
      <input
        placeholder="Company Name"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
      />

      <button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Account"}
      </button>
    </form>
  );
}

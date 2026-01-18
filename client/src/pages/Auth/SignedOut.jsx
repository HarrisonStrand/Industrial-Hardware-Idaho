import { Link } from "react-router-dom";

export default function SignedOut() {
  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <h2 className="mb-2">You’ve been signed out</h2>
      <p className="text-muted mb-4">
        Your session has ended. Please log in again to continue.
      </p>

      <div className="d-flex gap-2">
        <Link className="btn btn-primary" to="/login">
          Log in
        </Link>
        <Link className="btn btn-outline-secondary" to="/">
          Go home
        </Link>
      </div>
    </div>
  );
}

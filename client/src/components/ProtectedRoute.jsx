import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loadingAuth, loggingOut, isAdmin } = useAuth();
  const location = useLocation();

  // ✅ Important: don't redirect during logout transition
  if (loadingAuth || loggingOut) return null;

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

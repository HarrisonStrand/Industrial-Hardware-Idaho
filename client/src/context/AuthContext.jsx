import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "../utils/apiFetch";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // ✅ prevents ProtectedRoute from redirecting while we're intentionally logging out
  const [loggingOut, setLoggingOut] = useState(false);

  const handleUnauthorized = useCallback(() => {
    // A 401 can happen during the initial auth check on public pages.
    // Do not force a browser redirect here; let ProtectedRoute decide what
    // requires login, and let logout intentionally route to /signed-out.
    setUser(null);
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch("/api/auth/me");
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(
    async (email, password) => {
      const data = await apiFetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        },
        { onUnauthorized: handleUnauthorized }
      );

      setUser(data.user);
      return data.user;
    },
    [handleUnauthorized]
  );

  const loginWithGoogle = useCallback(
    async (credential) => {
      const data = await apiFetch(
        "/api/auth/google",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential })
        },
        { onUnauthorized: handleUnauthorized }
      );

      setUser(data.user);
      return data.user;
    },
    [handleUnauthorized]
  );

  const register = useCallback(
    async (payload) => {
      const data = await apiFetch(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        },
        { onUnauthorized: handleUnauthorized }
      );

      setUser(data.user);
      return data.user;
    },
    [handleUnauthorized]
  );

  /**
   * Logout in a deterministic order:
   * 1. Clear the React user immediately so the header resets on the first click.
   * 2. Wait for the API to clear the authentication cookie.
   * 3. Redirect only after the server request has completed.
   */
  const logout = useCallback(async ({ redirectTo = "/signed-out" } = {}) => {
    setLoggingOut(true);
    setUser(null);

    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      setLoggingOut(false);

      try {
        const path = window.location?.pathname || "";
        if (redirectTo && path !== redirectTo) {
          window.location.replace(redirectTo);
        }
      } catch {
        // ignore navigation errors
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      isAdmin: user?.role === "admin",
      loadingAuth,
      loggingOut, // ✅ expose
      login,
      loginWithGoogle,
      register,
      logout,
      refreshMe: fetchMe,
      handleUnauthorized
    }),
    [
      user,
      loadingAuth,
      loggingOut,
      login,
      loginWithGoogle,
      register,
      logout,
      fetchMe,
      handleUnauthorized
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

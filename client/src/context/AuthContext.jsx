import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "../utils/apiFetch";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const handleUnauthorized = useCallback(() => {
    const path = window.location?.pathname || "";
    setUser(null);

    // avoid redirect loops
    if (!path.startsWith("/signed-out")) {
      window.location.replace("/signed-out");
    }
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch("/api/auth/me", {}, { onUnauthorized: handleUnauthorized });
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }, [handleUnauthorized]);

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

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      isAdmin: user?.role === "admin",
      loadingAuth,
      login,
      register,
      logout,
      refreshMe: fetchMe,
      handleUnauthorized // optional: exposed in case you want it elsewhere
    }),
    [user, loadingAuth, login, register, logout, fetchMe, handleUnauthorized]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

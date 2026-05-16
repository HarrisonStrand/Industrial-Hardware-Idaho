import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	useCallback,
} from "react";
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
					body: JSON.stringify({ email, password }),
				},
				{ onUnauthorized: handleUnauthorized },
			);

			setUser(data.user);
			return data.user;
		},
		[handleUnauthorized],
	);

	const loginWithGoogle = useCallback(
		async (credential) => {
			const data = await apiFetch(
				"/api/auth/google",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ credential }),
				},
				{ onUnauthorized: handleUnauthorized },
			);

			setUser(data.user);
			return data.user;
		},
		[handleUnauthorized],
	);

	const register = useCallback(
		async (payload) => {
			const data = await apiFetch(
				"/api/auth/register",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				},
				{ onUnauthorized: handleUnauthorized },
			);

			setUser(data.user);
			return data.user;
		},
		[handleUnauthorized],
	);

	/**
	 * ✅ Logout with optional redirect.
	 * We redirect FIRST (window.location.replace) to get off protected routes immediately,
	 * then clear local user state.
	 */
	const logout = useCallback(async ({ redirectTo = "/signed-out" } = {}) => {
		setLoggingOut(true);

		// 🚑 Get off protected routes immediately (no race with ProtectedRoute)
		try {
			const path = window.location?.pathname || "";
			if (redirectTo && path !== redirectTo) {
				window.location.replace(redirectTo);
			}
		} catch {
			// ignore
		}

		try {
			await apiFetch("/api/auth/logout", {
				method: "POST",
			});
		} catch {
			// ignore
		} finally {
			setUser(null);
			setLoggingOut(false);
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
			handleUnauthorized,
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
			handleUnauthorized,
		],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
	return ctx;
}

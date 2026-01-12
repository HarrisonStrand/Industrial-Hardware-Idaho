import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loadingAuth, setLoadingAuth] = useState(true);
	const refreshMe = fetchMe;

	async function fetchMe() {
		try {
			const res = await fetch("/api/auth/me", { credentials: "include" });
			if (!res.ok) {
				setUser(null);
				return;
			}
			const data = await res.json();
			setUser(data.user || null);
		} catch {
			setUser(null);
		} finally {
			setLoadingAuth(false);
		}
	}

	useEffect(() => {
		fetchMe();
	}, []);

	async function login(email, password) {
		const res = await fetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ email, password }),
		});

		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data?.error || "Login failed");

		setUser(data.user);
		return data.user;
	}

	async function register(payload) {
		const res = await fetch("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify(payload),
		});

		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data?.error || "Registration failed");

		setUser(data.user);
		return data.user;
	}

	async function logout() {
		await fetch("/api/auth/logout", {
			method: "POST",
			credentials: "include",
		}).catch(() => {});
		setUser(null);
	}

	return (
		<AuthContext.Provider
			value={{
				user,
				setUser,
				isAdmin: user?.role === "admin",
				loadingAuth,
				login,
				register,
				logout,
				refreshMe,
				refreshUser: fetchMe,
			}}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	return useContext(AuthContext);
}

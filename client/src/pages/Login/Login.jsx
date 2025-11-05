import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import "./Login.css";

export default function Login() {
	const { login } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [err, setErr] = useState("");
	const nav = useNavigate();
	const submit = async (e) => {
		e.preventDefault();
		setErr("");
		try {
			await login(email, password);
			nav("/dashboard");
		} catch (ex) {
			setErr(ex.response?.data?.message || "Login failed");
		}
	};
	return (
		<form onSubmit={submit}>
			<h2>Login</h2>
			{err && <div style={{ color: "crimson" }}>{err}</div>}
			<input
				placeholder='Email'
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				required
			/>
			<input
				type='password'
				placeholder='Password'
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				required
			/>
			<button type='submit'>Login</button>
		</form>
	);
}

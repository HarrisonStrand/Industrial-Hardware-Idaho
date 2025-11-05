import { useAuth } from "../../context/AuthContext.jsx";
import "./Dashboard.css";

export default function Dashboard() {
	const { user, logout } = useAuth();
	return (
		<div>
			<h2>Dashboard</h2>
			<p>
				Welcome, {user?.name || user?.email} ({user?.role})
			</p>
			<button onClick={logout}>Log Out</button>
		</div>
	);
}

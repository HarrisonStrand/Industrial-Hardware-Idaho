import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./index.css";
import "./styles/global.css";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { DataContext } from "./context/DataContext";
import brand from "./data/brand.json";

createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<ThemeProvider>
			<DataContext.Provider value={brand}>
				<AuthProvider>
					<App />
				</AuthProvider>
			</DataContext.Provider>
		</ThemeProvider>
	</React.StrictMode>
);

import React from "react";
import { createRoot } from "react-dom/client";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
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
import { SearchProvider } from "./context/SearchContext.jsx";

document.addEventListener("DOMContentLoaded", () => {
	document.body.classList.add("fade-in");
});

createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<BrowserRouter>
			<ThemeProvider>
				<DataContext.Provider value={brand}>
					<SearchProvider>
						<AuthProvider>
							<App />
						</AuthProvider>
					</SearchProvider>
				</DataContext.Provider>
			</ThemeProvider>
		</BrowserRouter>
	</React.StrictMode>
);

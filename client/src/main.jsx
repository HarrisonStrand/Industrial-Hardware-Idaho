import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./index.css";
import "./styles/global.css";
import brand from "./data/brand.json";
import variables from "./data/section-variables.json";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { BrandProvider } from "./context/BrandContext.jsx";
import { VariablesProvider } from "./context/VariableContext.jsx";
import { SearchProvider } from "./context/SearchContext.jsx";
import { CartProvider } from "./context/CartContext";

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("fade-in");
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <BrandProvider value={brand}>
          <VariablesProvider value={variables}>
            <SearchProvider>
              <CartProvider>
                <AuthProvider>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </AuthProvider>
              </CartProvider>
            </SearchProvider>
          </VariablesProvider>
        </BrandProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

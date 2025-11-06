import { createContext, useState, useEffect } from "react";

// Create context
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Read user preference or default to light
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  // Update <html> attribute and store theme preference
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Toggle theme handler
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Context value available to any component
  const value = { theme, toggleTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

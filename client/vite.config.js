import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const PORT = process.env.PORT || 5001;
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${PORT}`,
        changeOrigin: true,
        secure: false
      }
    }
  }
});

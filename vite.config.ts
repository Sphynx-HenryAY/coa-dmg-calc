import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages and local dev both use /coa-dmg-calc/
// so http://localhost:5175/coa-dmg-calc/ matches the deployed URL.
export default defineConfig({
  plugins: [react()],
  base: "/coa-dmg-calc/",
  server: {
    host: true,
    port: 5175,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 5175,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ["tesseract.js"],
  },
});

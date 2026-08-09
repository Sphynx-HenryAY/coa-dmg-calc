import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves at https://<user>.github.io/<repo>/
export default defineConfig({
  plugins: [react()],
  base: "/coa-dmg-calc/",
});

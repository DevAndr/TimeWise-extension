import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
});

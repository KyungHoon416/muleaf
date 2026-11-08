import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8"));

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: "muleaf-web-adsense",
    // Verify site ownership without enabling Auto ads on unfinished SPA screens.
    transformIndexHtml() {
      if (process.env.MULEAF_ADSENSE_VERIFY !== "true") return [];
      return [{ tag: "meta", attrs: {
        name: "google-adsense-account",
        content: "ca-pub-4004046235562178",
      }, injectTo: "head" as const }];
    },
  }],
  publicDir: false,
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: { "@": root, "tailwindcss": fileURLToPath(new URL("node_modules/tailwindcss", import.meta.url)), "tw-animate-css": fileURLToPath(new URL("node_modules/tw-animate-css/dist/tw-animate.css", import.meta.url)) },
    // The client UI is shared with the web project outside this package.
    dedupe: Object.keys(pkg.dependencies),
  },
  server: { fs: { allow: [root] } },
  build: { outDir: "dist", emptyOutDir: true },
});

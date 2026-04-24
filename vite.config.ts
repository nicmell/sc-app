import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const serverCommandsPkg = path.resolve(__dirname, "packages/server-commands/src");
const synthdefCompilerPkg = path.resolve(__dirname, "packages/synthdef-compiler/src");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    manifest: "manifest.json",
    // ES2022 for module-worker support.
    target: "es2022",
  },

  // Workers are ESM so Vite can code-split their bundles.
  worker: {
    format: "es",
  },

  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },

      // Local workspace packages — resolved directly to their TS
      // sources, no pre-build step.
      { find: /^@sc-app\/server-commands$/, replacement: `${serverCommandsPkg}/index.ts` },
      { find: /^@sc-app\/synthdef-compiler$/, replacement: `${synthdefCompilerPkg}/index.ts` },
    ],
  },

  // Tauri dev server config: fixed port, no clobbering Rust stderr.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    hmr: process.env.TAURI_DEV_HOST
      ? { protocol: "ws", host: process.env.TAURI_DEV_HOST, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});

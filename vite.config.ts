import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const serverCommandsPkg = path.resolve(__dirname, "packages/server-commands/src");
const synthdefCompilerPkg = path.resolve(__dirname, "packages/synthdef-compiler/src");
const uiFoundationPkg = path.resolve(__dirname, "packages/ui-foundation/src");

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
      // ui-foundation is pure CSS; Vite resolves the @import chain
      // natively. The dist/ build is for the future plugin runtime,
      // not for the app itself.
      { find: /^@sc-app\/ui-foundation$/, replacement: `${uiFoundationPkg}/index.css` },
    ],
  },

  // Tauri dev server config: fixed port, no clobbering Rust stderr.
  // Same-origin /ws is proxied to the Rust bridge so the frontend
  // doesn't need a separate VITE_OSC_WS_URL env var — `yarn dev`
  // alone (or `yarn dev:full`, which adds the bridge) gives a
  // working setup. `ws: true` makes the proxy upgrade the request
  // for the WebSocket handshake.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    hmr: process.env.TAURI_DEV_HOST
      ? { protocol: "ws", host: process.env.TAURI_DEV_HOST, port: 1421 }
      : undefined,
    proxy: {
      "/ws": {
        target: process.env.SC_BRIDGE_URL || "http://127.0.0.1:3000",
        ws: true,
      },
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});

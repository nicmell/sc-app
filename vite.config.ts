import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkgDir = path.resolve(__dirname, "crates/scserver-commands/pkg");
const preview2Browser = path.resolve(
  __dirname,
  "node_modules/@bytecodealliance/preview2-shim/lib/browser",
);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // jco's wasm bootstrap uses top-level await; `target: modules`
  // (Vite's default) predates TLA in module workers. Dev uses `esnext`
  // which already supports it, so only `build.target` needs bumping.
  build: {
    manifest: "manifest.json",
    target: "es2022",
  },

  // jco's transpiled output splits into multiple chunks per interface;
  // Vite can only code-split worker bundles when their output is ESM.
  worker: {
    format: "es",
  },

  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },

      // jco-transpiled scserver-commands component. Regenerate via
      // `yarn build:wasm`. Bare import → ESM entry; sub-paths →
      // per-interface .d.ts files used for types only.
      { find: /^@wasm\/scserver-commands$/, replacement: `${pkgDir}/scserver_commands.js` },
      { find: /^@wasm\/scserver-commands\/(.*)$/, replacement: `${pkgDir}/$1` },

      // jco's preview2-shim has a `{ node, default }` exports map; Vite
      // otherwise resolves the `node` branch, which imports
      // `node:fs/promises` and crashes the worker at init. Pin every
      // subpath to the browser build.
      { find: /^@bytecodealliance\/preview2-shim\/(.*)$/, replacement: `${preview2Browser}/$1.js` },
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

import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  build: {
    manifest: "manifest.json",
    // jco's wasm bootstrap uses top-level await, which needs a modern
    // target. All browsers since ~2022 plus Tauri's webview are fine.
    target: "es2022",
  },
  // The jco-generated bindings import sub-modules (WASI shims, per-
  // interface glue), and Vite can only code-split worker bundles when
  // their output is ES modules. Force `es` format; all modern browsers
  // plus Tauri's webview support module workers.
  worker: {
    format: "es",
  },
  esbuild: {
    // Dev transpile target must match too, otherwise Vite's dev server
    // serves a module with top-level-await that the browser can't load.
    target: "es2022",
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      // jco-transpiled scserver-commands component. Regenerate via
      // `yarn build:wasm`. The main alias resolves the top-level ESM
      // entry; the `/...` form lets us import typed sub-interfaces
      // (e.g. `@wasm/scserver-commands/interfaces/...d.ts`).
      {
        find: /^@wasm\/scserver-commands$/,
        replacement: path.resolve(
          __dirname,
          "crates/scserver-commands/pkg/scserver_commands.js",
        ),
      },
      {
        find: /^@wasm\/scserver-commands\/(.*)$/,
        replacement: path.resolve(__dirname, "crates/scserver-commands/pkg") + "/$1",
      },
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

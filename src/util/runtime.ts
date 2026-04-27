/**
 * Runtime-environment detection. The same compiled bundle ships in
 * two contexts:
 *   - **Tauri native** (`yarn tauri dev`, packaged macOS / Windows /
 *     Linux app): Tauri injects `__TAURI_INTERNALS__` into the
 *     window and exposes filesystem / dialog / opener IPC.
 *   - **Browser via `serve`** (`yarn serve` or any browser hitting
 *     the standalone Rust HTTP server): plain web context, no
 *     Tauri APIs.
 *
 * Components that want platform-specific behaviour (e.g. native
 * save-as dialog vs. `<a download>`) gate on `IS_TAURI`. Anything
 * inside the gate may dynamically `import('@tauri-apps/...')` —
 * the plugin packages tolerate import in the browser, they just
 * fail loudly when their methods are called there.
 */
export const IS_TAURI =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

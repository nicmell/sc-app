//! Tauri GUI mode (default, no subcommand).
//!
//! The webview loads the UI from `http://127.0.0.1:<port>/` in
//! release builds (axum serves the bundled `dist/`) or from `devUrl`
//! in debug builds (Vite at :1420). The bridge runs on Tauri's async
//! runtime; the listener is bound synchronously inside `.setup()` so
//! the window URL is valid the moment the webview navigates to it
//! (no boot race against the bridge).
//!
//! Logging: `init_tracing` runs *inside* `.setup()` so it can pick up
//! `app.path().app_log_dir()` for the platform-standard log
//! location. The returned `WorkerGuard` is held by Tauri's managed
//! state via [`TracingGuard`] for the app's lifetime.

use std::net::SocketAddr;

use tauri::Manager;

use crate::logging;
use crate::server;
use crate::server::static_assets::DIST_SUBPATH;

pub fn run(port: u16, scsynth: SocketAddr) {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |app| {
            // Platform-standard log dir (~/Library/Logs/<bundle-id>/
            // on macOS, $XDG_DATA_HOME/<bundle-id>/logs/ on Linux,
            // %LOCALAPPDATA%\<bundle-id>\logs\ on Windows). No env
            // var indirection.
            let log_dir = app.path().app_log_dir().ok();
            let guard = logging::init_tracing(log_dir.as_deref());
            // The non-blocking appender's flush thread is owned by
            // this guard; managed state outlives the event loop, so
            // file logging stays alive until exit.
            app.manage(TracingGuard(guard));

            // In release the webview loads from the local axum, so
            // we serve `dist/` from the bundle. In debug
            // (`tauri dev`, `cargo run`) the webview loads from
            // Vite — `resource_dir()` may resolve to a non-existent
            // `_up_/dist` next to `target/debug/`, harmless because
            // nothing requests it.
            let dist = app
                .path()
                .resource_dir()
                .ok()
                .map(|d| d.join(DIST_SUBPATH));

            // Bind synchronously so the window URL is valid the
            // moment the webview navigates to it.
            let (listener, addr) = tauri::async_runtime::block_on(server::bind(port))
                .map_err(|e| format!("server::bind: {e}"))?;
            tracing::info!(addr = %addr, "sc-app listening on http://{addr}");

            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::serve_on(listener, scsynth, dist).await {
                    tracing::error!(error = %e, "bridge error");
                }
            });

            // Webview URL:
            // - Release (`tauri build`): point at the local axum.
            //   Same source of truth as headless bridge mode.
            // - Debug (`tauri dev`, `cargo run`): defer to `devUrl`
            //   from `tauri.conf.json` so Vite's HMR keeps working.
            //   The Vite proxy in `vite.config.ts` forwards `/ws` to
            //   `:port` so the webview's WS still reaches the bridge.
            let url = if cfg!(debug_assertions) {
                tauri::WebviewUrl::default()
            } else {
                tauri::WebviewUrl::External(
                    format!("http://{addr}/")
                        .parse()
                        .expect("constructed http URL must parse"),
                )
            };
            tauri::WebviewWindowBuilder::new(app, "main", url)
                .title("sc-app")
                .inner_size(800.0, 600.0)
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Newtype so `tauri::Manager::manage` accepts the tracing guard.
/// We never read it back — its only job is to live as long as the
/// Tauri app does, keeping the appender's flush thread alive.
struct TracingGuard(#[allow(dead_code)] Option<tracing_appender::non_blocking::WorkerGuard>);

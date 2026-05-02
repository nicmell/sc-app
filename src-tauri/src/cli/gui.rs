//! Tauri GUI mode (default, no subcommand).
//!
//! The webview loads the UI from `http://127.0.0.1:<port>/` in
//! release builds (axum serves the bundled `dist/`) or from `devUrl`
//! in debug builds (Vite at :1420). The bridge runs on Tauri's async
//! runtime; the listener is bound synchronously inside `.setup()` so
//! the window URL is valid the moment the webview navigates to it
//! (no boot race against the bridge).
//!
//! Config: GUI mode reads
//! `app.path().app_config_dir()/config.json` and writes a default
//! version on first launch (port + scsynth seeded with built-ins;
//! `log_dir` left out so it falls through to
//! `app.path().app_log_dir()`). Precedence is the same as bridge
//! mode minus the CLI flags: env > config > built-in.
//!
//! Logging: `init_tracing` runs *inside* `.setup()` so it can pick
//! up either the config-supplied `log_dir` or the platform-standard
//! `app.path().app_log_dir()`. The returned `WorkerGuard` is held
//! by Tauri's managed state via [`TracingGuard`] for the app's
//! lifetime.

use std::net::SocketAddr;

use tauri::Manager;

use crate::config::Config;
use crate::logging;
use crate::server::{self, RoutingTable};
use crate::server::static_assets::DIST_SUBPATH;

const DEFAULT_PORT: u16 = 3000;
const DEFAULT_SCSYNTH: &str = "127.0.0.1:57110";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |app| {
            // 1. Resolve config: app_config_dir/config.json, written
            //    on first launch with port + scsynth defaults so the
            //    user has something to discover and edit.
            let cfg_path = app
                .path()
                .app_config_dir()
                .ok()
                .map(|d| d.join("config.json"));
            if let Some(p) = cfg_path.as_deref() {
                Config::write_default_if_missing(p);
            }
            let cfg = cfg_path
                .as_deref()
                .and_then(|p| match Config::load(p) {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("[config] failed to parse {}: {e}", p.display());
                        None
                    }
                })
                .unwrap_or_default();

            // 2. Logging — config.log_dir > app_log_dir.
            let log_dir = cfg
                .log_dir
                .clone()
                .or_else(|| app.path().app_log_dir().ok());
            let guard = logging::init_tracing(log_dir.as_deref());
            app.manage(TracingGuard(guard));
            if let Some(p) = cfg_path.as_deref() {
                if p.exists() {
                    tracing::info!(path = %p.display(), "loaded config");
                }
            }

            // 3. Resolve port + scsynth: env > config > default.
            let port = std::env::var("SC_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .or(cfg.port)
                .unwrap_or(DEFAULT_PORT);
            let scsynth_str = std::env::var("SC_SCSYNTH_ADDR")
                .ok()
                .or(cfg.scsynth)
                .unwrap_or_else(|| DEFAULT_SCSYNTH.to_string());
            let scsynth: SocketAddr = scsynth_str
                .parse()
                .map_err(|e| format!("invalid scsynth {scsynth_str:?}: {e}"))?;

            // 3.5 Build the routing table. `cfg.routes` resolves
            //     each `target` host:port via lookup_host. Failure
            //     is fatal — we'd rather refuse to boot than start
            //     with a half-broken route map.
            let routes_cfg = cfg.routes.clone();
            let table = tauri::async_runtime::block_on(
                RoutingTable::build(scsynth, &routes_cfg),
            )
            .map_err(|e| format!("routing table: {e}"))?;

            // 4. Static assets: in release the webview loads from
            //    the local axum, so we serve `dist/` from the
            //    bundle. In debug (`tauri dev`, `cargo run`) the
            //    webview loads from Vite — `resource_dir()` may
            //    resolve to a non-existent `_up_/dist` next to
            //    `target/debug/`, harmless because nothing requests
            //    it.
            let dist = app
                .path()
                .resource_dir()
                .ok()
                .map(|d| d.join(DIST_SUBPATH));

            // 5. Bind synchronously so the window URL is valid the
            //    moment the webview navigates to it.
            let (listener, addr) = tauri::async_runtime::block_on(server::bind(port))
                .map_err(|e| format!("server::bind: {e}"))?;
            tracing::info!(addr = %addr, "sc-app listening on http://{addr}");

            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::serve_on(listener, table, dist).await {
                    tracing::error!(error = %e, "bridge error");
                }
            });

            // 6. Webview URL:
            //    - Release (`tauri build`): point at the local axum.
            //      Same source of truth as headless bridge mode.
            //    - Debug (`tauri dev`, `cargo run`): defer to
            //      `devUrl` from `tauri.conf.json` so Vite's HMR
            //      keeps working. The Vite proxy in
            //      `vite.config.ts` forwards `/ws` to `:port` so
            //      the webview's WS still reaches the bridge.
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

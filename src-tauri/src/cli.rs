//! CLI dispatch.
//!
//! Two modes:
//! * No subcommand → launch the native Tauri GUI. The webview loads
//!   the UI from `http://127.0.0.1:<port>/` in production (axum
//!   serves the bundled `dist/`), or from `devUrl` in dev (Vite at
//!   :1420). The bridge runs on Tauri's async runtime.
//! * `bridge` subcommand → run the WS↔UDP bridge standalone. No
//!   `tauri::Builder`, no GTK init — just tokio + axum. Static
//!   assets are served when `dist/` resolves (via the bundle's
//!   resource dir or `--dist` override); otherwise the bridge
//!   answers only `/ws` and the frontend is expected to come from
//!   somewhere else (e.g. `yarn dev`).
//!
//! Asset bundling: `dist/` ships once via `bundle.resources` in
//! `tauri.conf.json`. The Tauri `tauri://` protocol is unused —
//! `frontendDist` is intentionally absent and the webview points at
//! the local axum like any browser would.

use std::net::SocketAddr;
use std::path::PathBuf;

use clap::{Parser, Subcommand};
use tauri::Manager;

use crate::server;

/// Subpath inside the Tauri resource dir where `dist/` lands.
/// `bundle.resources: ["../dist"]` re-bases the leading `..` to
/// `_up_` when copying into the bundle, so the actual files live at
/// `<resource_dir>/_up_/dist/...`.
const DIST_SUBPATH: &str = "_up_/dist";

#[derive(Parser)]
#[command(name = "sc-app", version, about = "SCSynth Oscilloscope & Recorder")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Run the WS↔UDP bridge standalone (no GUI). Serves bundled
    /// static assets if available; otherwise the frontend must be
    /// hosted elsewhere (Vite dev, an external CDN, etc.).
    Bridge {
        /// HTTP port to bind. Env: `SC_PORT`.
        #[arg(short, long, env = "SC_PORT", default_value_t = 3000)]
        port: u16,

        /// Default scsynth address. Each WebSocket connection may
        /// override this via `?scsynth=HOST:PORT`. Env:
        /// `SC_SCSYNTH_ADDR`.
        #[arg(long, env = "SC_SCSYNTH_ADDR", default_value = "127.0.0.1:57110")]
        scsynth: String,

        /// Override the static asset directory. Without this flag
        /// `dist/` is resolved via Tauri's resource-dir mechanism,
        /// which only works inside a built bundle. For a dev-mode
        /// `cargo run -- bridge`, omit it and load the UI from Vite
        /// (`yarn dev`).
        #[arg(long)]
        dist: Option<PathBuf>,

        /// Directory to write rotated NDJSON log files into (one file
        /// per day, `sc-app.log.<YYYY-MM-DD>`). When unset, only
        /// stderr logging is enabled — file logging is opt-in for the
        /// bridge subcommand, since deploys typically pin the path
        /// from a systemd unit or similar.
        #[arg(long)]
        log_dir: Option<PathBuf>,
    },
}

pub fn run() {
    match Cli::parse().command {
        None => run_gui(),
        Some(Command::Bridge {
            port,
            scsynth,
            dist,
            log_dir,
        }) => {
            let scsynth = parse_scsynth_or_die(&scsynth);
            run_bridge_blocking(port, scsynth, dist, log_dir);
        }
    }
}

fn parse_scsynth_or_die(raw: &str) -> SocketAddr {
    match raw.parse::<SocketAddr>() {
        Ok(addr) => addr,
        Err(e) => {
            eprintln!("error: invalid --scsynth address {raw:?}: {e}");
            std::process::exit(2);
        }
    }
}

/// Resolve the bundled `dist/` directory for a non-Tauri-runtime
/// caller (the `bridge` subcommand). Uses `tauri::utils::platform::
/// resource_dir` directly so we get Tauri's platform-specific path
/// logic without paying for `Builder::run()` (and, on Linux, without
/// `gtk::init()` failing on a headless host).
///
/// Returns `Err` when not running inside a Tauri bundle (e.g. plain
/// `cargo run -- bridge` in dev). Caller is expected to fall back
/// gracefully — `--dist` override or no static fallback at all.
fn resolve_bundled_dist() -> anyhow::Result<PathBuf> {
    let pkg_info = tauri::utils::PackageInfo {
        name: env!("CARGO_PKG_NAME").into(),
        version: env!("CARGO_PKG_VERSION")
            .parse()
            .expect("CARGO_PKG_VERSION must be a valid semver"),
        authors: env!("CARGO_PKG_AUTHORS"),
        description: env!("CARGO_PKG_DESCRIPTION"),
        crate_name: env!("CARGO_PKG_NAME"),
    };
    let env = tauri::Env::default();
    let resource_dir = tauri::utils::platform::resource_dir(&pkg_info, &env)
        .map_err(|e| anyhow::anyhow!("resource_dir: {e}"))?;
    Ok(resource_dir.join(DIST_SUBPATH))
}

fn run_bridge_blocking(
    port: u16,
    scsynth: SocketAddr,
    dist_override: Option<PathBuf>,
    log_dir: Option<PathBuf>,
) {
    // Phase 23 — initialise tracing before anything else logs.
    let _guard = server::init_tracing(log_dir.as_deref());

    let dist = dist_override.or_else(|| match resolve_bundled_dist() {
        Ok(d) => Some(d),
        Err(e) => {
            tracing::info!(
                reason = %e,
                "no bundled dist/ found — running /ws-only. \
                 Pass --dist or run inside a Tauri bundle to enable static serving."
            );
            None
        }
    });

    let rt = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
    rt.block_on(async move {
        if let Err(e) = server::run_bridge(port, scsynth, dist).await {
            tracing::error!(error = %e, "bridge error");
            std::process::exit(1);
        }
    });
}

fn run_gui() {
    let port: u16 = std::env::var("SC_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3000);
    let scsynth = parse_scsynth_or_die(
        &std::env::var("SC_SCSYNTH_ADDR").unwrap_or_else(|_| "127.0.0.1:57110".into()),
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |app| {
            // GUI mode picks up file logging automatically — Tauri
            // gives us the platform-standard log dir
            // (~/Library/Logs/<bundle-id>/ on macOS, etc.). Bridge
            // mode skips this; deploys pin the path explicitly via
            // --log-dir.
            let log_dir = app.path().app_log_dir().ok();
            let guard = server::init_tracing(log_dir.as_deref());
            // The non-blocking appender's flush thread is owned by
            // this guard; managed state outlives the app's
            // event-loop, so file logging stays alive until exit.
            app.manage(TracingGuard(guard));

            // In production, the webview loads from the local axum,
            // so we serve `dist/` from the bundle. In dev the
            // webview loads from Vite (`devUrl`), so the dist path
            // is irrelevant — but `resource_dir()` may still resolve
            // to a non-existent `_up_/dist` next to `target/debug/`,
            // and that's harmless because nothing requests it.
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

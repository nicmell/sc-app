//! CLI dispatch.
//!
//! Two modes:
//! * No subcommand → launch the native Tauri GUI. The webview loads
//!   the UI from `http://127.0.0.1:<port>/`, served by axum from the
//!   bundled `dist/` (`bundle.resources` in `tauri.conf.json`). The
//!   bridge runs on Tauri's async runtime.
//! * `serve` subcommand → run the bridge server standalone. No
//!   `tauri::Builder`, no GTK init — just tokio + axum. The bundled
//!   `dist/` is located via `tauri::utils::platform::resource_dir`,
//!   the same library function `AppHandle::path().resource_dir()`
//!   uses internally; `--dist` overrides it for dev (`cargo run`
//!   outside a bundle).
//!
//! Asset bundling: only `bundle.resources` ships `dist/`. The Tauri
//! `tauri://` protocol is unused — there's no `frontendDist` and the
//! webview points at the local axum like any browser would.

use std::net::SocketAddr;
use std::path::PathBuf;

use clap::{Parser, Subcommand};
use tauri::Manager;

use crate::server;

#[derive(Parser)]
#[command(name = "sc-app", version, about = "SCSynth Oscilloscope & Recorder")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Run as a standalone HTTP server (browser mode). Serves the
    /// bundled `dist/` plus the `/ws` bridge to scsynth.
    Serve {
        /// HTTP port to bind. Env: `SC_PORT`.
        #[arg(short, long, env = "SC_PORT", default_value_t = 3000)]
        port: u16,

        /// Default scsynth address. Each WebSocket connection may
        /// override this via `?scsynth=HOST:PORT`. Env:
        /// `SC_SCSYNTH_ADDR`.
        #[arg(long, env = "SC_SCSYNTH_ADDR", default_value = "127.0.0.1:57110")]
        scsynth: String,

        /// Override the static asset directory. Without this flag,
        /// `dist/` is resolved via Tauri's resource-dir mechanism,
        /// which only works inside a built bundle. For
        /// `cargo run -- serve` in dev, point this at the freshly
        /// built `dist/`. Env: `SC_DIST_DIR`.
        #[arg(long, env = "SC_DIST_DIR")]
        dist: Option<PathBuf>,

        /// Phase 23 — directory to write rotated NDJSON log files
        /// into (one file per day, `sc-app.log.<YYYY-MM-DD>`). When
        /// unset, only stderr logging is enabled. Env: `SC_LOG_DIR`.
        #[arg(long, env = "SC_LOG_DIR")]
        log_dir: Option<PathBuf>,
    },
}

pub fn run() {
    match Cli::parse().command {
        None => run_gui(),
        Some(Command::Serve {
            port,
            scsynth,
            dist,
            log_dir,
        }) => {
            let scsynth = parse_scsynth_or_die(&scsynth);
            run_server_blocking(port, scsynth, dist, log_dir);
        }
    }
}

/// Parse the `--scsynth` flag's value into a `SocketAddr`, printing a
/// clear error and exiting on malformed input.
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
/// caller (the `serve` subcommand). Uses `tauri::utils::platform::
/// resource_dir` directly so we get Tauri's platform-specific path
/// logic without paying for `Builder::run()` (and, on Linux, without
/// `gtk::init()` failing on a headless host).
///
/// Returns `Err` when not running inside a Tauri bundle (e.g. plain
/// `cargo run -- serve` in dev) — caller is expected to fall back to
/// the explicit `--dist` flag in that case.
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
    // `bundle.resources: ["../dist"]` re-bases `..` to `_up_` inside
    // the bundle, so the actual dist lives at `resource_dir/_up_/dist`.
    Ok(resource_dir.join("_up_").join("dist"))
}

/// `serve` subcommand — the HTTP+WS bridge, standalone. No Tauri
/// runtime; on Linux this means no GTK init, so the binary runs
/// cleanly under systemd on a headless Pi.
fn run_server_blocking(
    port: u16,
    scsynth: SocketAddr,
    dist_override: Option<PathBuf>,
    log_dir: Option<PathBuf>,
) {
    // Phase 23 — initialise tracing before anything else logs. The
    // returned guard owns the appender's background flush thread and
    // must live as long as the process. Bound to `_guard` so it drops
    // at end of scope (program exit), flushing on the way out.
    let _guard = server::init_tracing(log_dir.as_deref());

    let dist = match dist_override {
        Some(d) => d,
        None => match resolve_bundled_dist() {
            Ok(d) => d,
            Err(e) => {
                eprintln!(
                    "error: could not locate bundled dist/ ({e}). \
                     Pass --dist or set SC_DIST_DIR when running \
                     outside a Tauri bundle."
                );
                std::process::exit(2);
            }
        },
    };

    let rt = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
    rt.block_on(async move {
        if let Err(e) = server::serve(port, scsynth, dist).await {
            tracing::error!(error = %e, "server error");
            std::process::exit(1);
        }
    });
}

/// Default mode — launch the Tauri GUI. The webview is created
/// programmatically in `.setup()` after axum binds, so it can be
/// pointed at the actual listening address (avoids a boot race
/// against the bridge).
fn run_gui() {
    let port: u16 = std::env::var("SC_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3000);
    let scsynth = parse_scsynth_or_die(
        &std::env::var("SC_SCSYNTH_ADDR").unwrap_or_else(|_| "127.0.0.1:57110".into()),
    );
    // Phase 23 — Tauri builds have no CLI flags, so the file-logging
    // path is opted into via env var. Same semantics as `--log-dir`
    // for serve mode.
    let log_dir = std::env::var("SC_LOG_DIR").ok().map(PathBuf::from);
    // Guard is bound to the function's stack frame; tauri::run blocks
    // until the user quits the app, so the guard outlives every log
    // call.
    let _guard = server::init_tracing(log_dir.as_deref());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |app| {
            // Resolve the bundled dist via Tauri's runtime API. Same
            // result as `resolve_bundled_dist()` in the serve path,
            // but goes through the AppHandle (which is the supported
            // way once a Builder is in play).
            let resource_dir = app
                .path()
                .resource_dir()
                .map_err(|e| format!("resource_dir: {e}"))?;
            let dist = resource_dir.join("_up_").join("dist");

            // Bind the listener synchronously so the window URL is
            // valid the moment the webview navigates to it. axum's
            // accept loop runs on the spawned task afterwards.
            let (listener, addr) = tauri::async_runtime::block_on(server::bind(port))
                .map_err(|e| format!("server::bind: {e}"))?;
            tracing::info!(addr = %addr, "sc-app listening on http://{addr}");

            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::serve_on(listener, scsynth, dist).await {
                    tracing::error!(error = %e, "bridge server error");
                }
            });

            // Webview URL:
            // - Production (`tauri build`): point at the local axum,
            //   same source of truth as the headless serve path.
            // - Dev (`tauri dev`): defer to `devUrl` from
            //   `tauri.conf.json` so Vite's HMR keeps working. We
            //   detect via `debug_assertions` — true in `cargo run`
            //   / `tauri dev`, false in release builds.
            // Capability `default.json` whitelists
            // `http://{127.0.0.1,localhost}:*` so IPC (fs, dialog,
            // opener) keeps working in both cases.
            let url = if cfg!(debug_assertions) {
                tauri::WebviewUrl::default()
            } else {
                let parsed = format!("http://{addr}/")
                    .parse()
                    .expect("constructed http URL must parse");
                tauri::WebviewUrl::External(parsed)
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

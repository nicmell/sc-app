//! Phase 0 — CLI dispatch.
//!
//! Two modes:
//! * No subcommand → launch the native Tauri GUI (the bridge server is
//!   started on Tauri's async runtime so the webview can talk OSC).
//! * `serve` subcommand → run the bridge server standalone, serving the
//!   built Vite `dist/` directory over HTTP alongside the `/ws` endpoint.
//!
//! In both modes the WS bridge is identical; only the host for the
//! webview differs (Tauri vs. any browser hitting the HTTP server).

use std::net::SocketAddr;
use std::path::PathBuf;

use clap::{Parser, Subcommand};

use crate::server;

#[derive(Parser)]
#[command(name = "sc-app", version, about = "SCSynth Oscilloscope & Recorder")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Run as a standalone HTTP server (browser mode). Serves the built
    /// Vite `dist/` directory plus the `/ws` bridge to scsynth.
    Serve {
        /// HTTP port to bind. Env: `SC_PORT`.
        #[arg(short, long, env = "SC_PORT", default_value_t = 3000)]
        port: u16,

        /// Default scsynth address. Each WebSocket connection may override
        /// this via `?scsynth=HOST:PORT`. Env: `SC_SCSYNTH_ADDR`.
        #[arg(long, env = "SC_SCSYNTH_ADDR", default_value = "127.0.0.1:57110")]
        scsynth: String,

        /// Directory to serve static assets from. Env: `SC_DIST_DIR`.
        #[arg(long, env = "SC_DIST_DIR", default_value = "dist")]
        dist: PathBuf,

        /// Phase 23 — directory to write rotated NDJSON log files into
        /// (one file per day, `sc-app.log.<YYYY-MM-DD>`). When unset,
        /// only stderr logging is enabled. Env: `SC_LOG_DIR`.
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

/// `serve` subcommand — the HTTP+WS bridge, standalone.
fn run_server_blocking(
    port: u16,
    scsynth: SocketAddr,
    dist: PathBuf,
    log_dir: Option<PathBuf>,
) {
    // Phase 23 — initialise tracing before anything else logs. The
    // returned guard owns the appender's background flush thread and
    // must live as long as the process. Bound to `_guard` so it drops
    // at end of scope (program exit), flushing on the way out.
    let _guard = server::init_tracing(log_dir.as_deref());

    let rt = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
    rt.block_on(async move {
        if let Err(e) = server::serve(port, scsynth, dist).await {
            tracing::error!(error = %e, "server error");
            std::process::exit(1);
        }
    });
}

/// Default mode — launch the Tauri GUI with the bridge server running on
/// a background task of Tauri's async runtime.
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

    // Tauri's async_runtime is tokio — spawn the bridge there so it dies
    // when the app exits.
    tauri::async_runtime::spawn(async move {
        if let Err(e) = server::serve(port, scsynth, PathBuf::from("dist")).await {
            tracing::error!(error = %e, "bridge server error");
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

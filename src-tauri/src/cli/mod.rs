//! CLI parsing and dispatch.
//!
//! Two modes, each in its own submodule under this directory:
//! * No subcommand → [`gui::run`] launches the native Tauri GUI.
//! * `bridge` subcommand → [`bridge::run_blocking`] runs the WS↔UDP
//!   bridge standalone (no Tauri runtime, no GTK init).
//!
//! Asset bundling: `dist/` ships once via `bundle.resources` in
//! `tauri.conf.json`. The Tauri `tauri://` protocol is unused —
//! `frontendDist` is intentionally absent and the webview points at
//! the local axum like any browser would.

mod bridge;
mod gui;

use std::net::SocketAddr;
use std::path::PathBuf;

use clap::{Parser, Subcommand};

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

        /// Directory to write rotated NDJSON log files into (one
        /// file per day, `sc-app.log.<YYYY-MM-DD>`). When unset,
        /// only stderr logging is enabled — file logging is opt-in
        /// for the bridge subcommand, since deploys typically pin
        /// the path from a systemd unit or similar.
        #[arg(long)]
        log_dir: Option<PathBuf>,
    },
}

pub fn run() {
    match Cli::parse().command {
        None => {
            // GUI mode reads the same env vars the bridge subcommand
            // exposes via flags — Tauri builds have no CLI surface.
            let port: u16 = std::env::var("SC_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(3000);
            let scsynth = parse_scsynth_or_die(
                &std::env::var("SC_SCSYNTH_ADDR").unwrap_or_else(|_| "127.0.0.1:57110".into()),
            );
            gui::run(port, scsynth);
        }
        Some(Command::Bridge {
            port,
            scsynth,
            dist,
            log_dir,
        }) => {
            let scsynth = parse_scsynth_or_die(&scsynth);
            bridge::run_blocking(port, scsynth, dist, log_dir);
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

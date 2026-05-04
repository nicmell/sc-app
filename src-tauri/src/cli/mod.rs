//! CLI parsing and dispatch.
//!
//! Two modes, each in its own submodule under this directory:
//! * No subcommand → [`gui::run`] launches the native Tauri GUI.
//! * `bridge` subcommand → [`bridge::run_blocking`] runs the WS↔UDP
//!   bridge standalone (no Tauri runtime, no GTK init).
//!
//! Config precedence for the bridge subcommand:
//!
//! 1. CLI flag (`--port`, `--scsynth`, `--log-dir`)
//! 2. Env var (`SC_PORT`, `SC_SCSYNTH_ADDR`)
//! 3. `config.json` value (`--config <path>` or auto-discovered at
//!    [`config::LINUX_SYSTEM_PATH`])
//! 4. Built-in default
//!
//! GUI mode does the same precedence inside `gui::run` (no CLI
//! flags; reads env + `app_config_dir/config.json`).
//!
//! Asset bundling: `dist/` ships once via `bundle.resources` in
//! `tauri.conf.json`. The Tauri `tauri://` protocol is unused —
//! `frontendDist` is intentionally absent and the webview points at
//! the local axum like any browser would.

mod bridge;
mod gui;

use std::net::SocketAddr;
use std::path::{Path, PathBuf};

use clap::{Parser, Subcommand};

use std::time::Duration;

use crate::config::{
    self, Config, DEFAULT_DIRT, DEFAULT_PORT, DEFAULT_SCSYNTH,
    DEFAULT_SESSION_TTL_SECONDS,
};

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
        /// HTTP port to bind. Falls back to env (`SC_PORT`),
        /// config.json `port`, then 3000.
        #[arg(short, long)]
        port: Option<u16>,

        /// Default scsynth address. Each WebSocket connection may
        /// override this via `?scsynth=HOST:PORT`. Falls back to
        /// env (`SC_SCSYNTH_ADDR`), config.json `scsynth`, then
        /// `127.0.0.1:57110`.
        #[arg(long)]
        scsynth: Option<String>,

        /// Override the static asset directory. Without this flag
        /// `dist/` is resolved via Tauri's resource-dir mechanism,
        /// which only works inside a built bundle. For a dev-mode
        /// `cargo run -- bridge`, omit it and load the UI from Vite
        /// (`yarn dev`).
        #[arg(long)]
        dist: Option<PathBuf>,

        /// Directory to write rotated NDJSON log files into (one
        /// file per day, `sc-app.log.<YYYY-MM-DD>`). Falls back to
        /// config.json `log_dir`. When unset everywhere, only
        /// stderr logging is enabled.
        #[arg(long)]
        log_dir: Option<PathBuf>,

        /// Path to a `config.json` file. If passed, the file *must*
        /// exist (we fail loudly on missing/unparseable). If
        /// omitted, [`config::LINUX_SYSTEM_PATH`] is auto-discovered
        /// — silently skipped if absent.
        #[arg(long)]
        config: Option<PathBuf>,

        /// Phase 36: force OSC `/b_getn` fallback mode regardless of
        /// SHM availability. Useful for testing the OSC code path
        /// without disabling SHM at the OS layer (e.g. on a local
        /// dev box where /tmp/boost_interprocess/... is perfectly
        /// readable). Production deployments leave this off and let
        /// the bridge auto-detect.
        #[arg(long)]
        no_shm: bool,
    },
}

pub fn run() {
    match Cli::parse().command {
        None => gui::run(),
        Some(Command::Bridge {
            port,
            scsynth,
            dist,
            log_dir,
            config,
            no_shm,
        }) => {
            let cfg = resolve_bridge_config(config.as_deref());

            let port = port
                .or_else(|| std::env::var("SC_PORT").ok().and_then(|s| s.parse().ok()))
                .or(cfg.port)
                .unwrap_or(DEFAULT_PORT);
            let scsynth_str = scsynth
                .or_else(|| std::env::var("SC_SCSYNTH_ADDR").ok())
                .or(cfg.scsynth)
                .unwrap_or_else(|| DEFAULT_SCSYNTH.to_string());
            let scsynth = parse_scsynth_or_die(&scsynth_str);
            // Phase 39b: sclang address for the bootstrap round-trip.
            // Defaults to DEFAULT_DIRT so a stale starter config
            // (written before Phase 39 added the field) still gets a
            // working bootstrap. Always Some(_) — if sclang isn't
            // actually reachable, `try_lazy_sclang_bootstrap` retries
            // on every GET /api/session.
            let sclang_str = cfg
                .sclang
                .unwrap_or_else(|| DEFAULT_DIRT.to_string());
            let sclang = Some(parse_scsynth_or_die(&sclang_str));
            // Phase 39d: clock chunkSize. Pre-39d this lived in
            // sclang's SC_APP_CLOCK_CHUNK_SIZE env var; Phase 39d
            // hoists it to bridge config.
            let clock_chunk_size = std::env::var("SC_APP_CLOCK_CHUNK_SIZE")
                .ok()
                .and_then(|s| s.parse::<u32>().ok())
                .or(cfg.clock_chunk_size)
                .unwrap_or(crate::config::DEFAULT_CLOCK_CHUNK_SIZE);
            let log_dir = log_dir.or(cfg.log_dir);
            let routes = cfg.routes;
            let session_ttl = Duration::from_secs(
                cfg.session_ttl_seconds.unwrap_or(DEFAULT_SESSION_TTL_SECONDS),
            );

            bridge::run_blocking(
                port,
                scsynth,
                sclang,
                clock_chunk_size,
                routes,
                dist,
                log_dir,
                session_ttl,
                no_shm,
            );
        }
    }
}

/// Bridge-mode config resolution. Explicit `--config` is required
/// to exist; auto-discovery walks a small list of conventional
/// paths and silently skips missing files.
///
/// Auto-discovery order:
/// 1. `./config.json` (CWD-relative) — for `yarn bridge` /
///    `yarn dev:full` runs from the repo root.
/// 2. [`config::LINUX_SYSTEM_PATH`] (`/etc/sc-app/config.json`) —
///    for systemd deployments.
fn resolve_bridge_config(explicit: Option<&Path>) -> Config {
    if let Some(path) = explicit {
        return match Config::load(path) {
            Ok(Some(c)) => {
                eprintln!("[config] loaded {}", path.display());
                c
            }
            Ok(None) => {
                eprintln!("error: --config {} does not exist", path.display());
                std::process::exit(2);
            }
            Err(e) => {
                eprintln!("error: failed to load --config {}: {e}", path.display());
                std::process::exit(2);
            }
        };
    }

    for candidate in &[Path::new("./config.json"), Path::new(config::LINUX_SYSTEM_PATH)] {
        match Config::load(candidate) {
            Ok(Some(c)) => {
                eprintln!("[config] loaded {}", candidate.display());
                return c;
            }
            Ok(None) => continue,
            Err(e) => {
                eprintln!(
                    "[config] failed to load auto-discovered {}: {e}",
                    candidate.display()
                );
                continue;
            }
        }
    }
    Config::default()
}

fn parse_scsynth_or_die(raw: &str) -> SocketAddr {
    match raw.parse::<SocketAddr>() {
        Ok(addr) => addr,
        Err(e) => {
            eprintln!("error: invalid scsynth address {raw:?}: {e}");
            std::process::exit(2);
        }
    }
}

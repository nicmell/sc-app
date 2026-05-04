//! Headless `bridge` subcommand.
//!
//! Plain tokio + axum — no `tauri::Builder`, no GTK init. Ships as
//! a single binary that runs cleanly under systemd on a headless
//! host (Pi, Linux server). Static assets are served when `dist/`
//! resolves (via the bundle's resource dir or `--dist` override);
//! otherwise the bridge answers only `/ws` and the frontend is
//! expected from elsewhere (Vite dev, an external CDN, etc.).
//!
//! Logging is stderr-only by default; `--log-dir` opts into the
//! daily-rotated file appender. Deploys typically pin the path from
//! a systemd unit, so file logging stays explicit rather than
//! auto-detected.
//!
//! Phase 26 — the `cfg.routes` table is resolved at startup (each
//! `target` host:port goes through `tokio::net::lookup_host`) and
//! handed to `server::run_bridge` as a [`RoutingTable`]. Resolution
//! failure is fatal — the bridge exits with code 1 rather than
//! booting with a half-broken route map.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

use crate::config::Route;
use crate::logging;
use crate::server::{self, RoutingTable};
use crate::server::static_assets;

pub fn run_blocking(
    port: u16,
    scsynth: SocketAddr,
    sclang: Option<SocketAddr>,
    routes: Vec<Route>,
    dist_override: Option<PathBuf>,
    log_dir: Option<PathBuf>,
    session_ttl: Duration,
    force_osc_mode: bool,
) {
    let _guard = logging::init_tracing(log_dir.as_deref());

    let dist = dist_override.or_else(|| match static_assets::resolve_bundled_dist() {
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

    if force_osc_mode {
        tracing::info!(
            "  --no-shm: forcing OSC /b_getn fallback mode for all sessions"
        );
    }

    let rt = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
    rt.block_on(async move {
        let table = match RoutingTable::build(&routes).await {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(error = %e, "failed to build routing table");
                std::process::exit(1);
            }
        };
        if let Err(e) = server::run_bridge(
            port,
            table,
            scsynth,
            sclang,
            dist,
            session_ttl,
            force_osc_mode,
        )
        .await
        {
            tracing::error!(error = %e, "bridge error");
            std::process::exit(1);
        }
    });
}

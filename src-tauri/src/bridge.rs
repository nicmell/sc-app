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

use std::net::SocketAddr;
use std::path::PathBuf;

use crate::logging;
use crate::server;
use crate::server::static_assets;

pub fn run_blocking(
    port: u16,
    scsynth: SocketAddr,
    dist_override: Option<PathBuf>,
    log_dir: Option<PathBuf>,
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

    let rt = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
    rt.block_on(async move {
        if let Err(e) = server::run_bridge(port, scsynth, dist).await {
            tracing::error!(error = %e, "bridge error");
            std::process::exit(1);
        }
    });
}

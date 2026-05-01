//! Global tracing subscriber init.
//!
//! Always emits to stderr at INFO+. When `log_dir` is `Some`, also
//! writes daily-rotated JSON files to
//! `<log_dir>/sc-app.log.<YYYY-MM-DD>` via `tracing-appender`. The
//! returned `WorkerGuard` must live as long as the process — it owns
//! the background flush thread; dropping it loses any in-flight
//! buffered events.
//!
//! `RUST_LOG` overrides the default filter (e.g.
//! `RUST_LOG=sc_app_lib=debug`).

use std::path::Path;

use tracing_appender::non_blocking::WorkerGuard;

/// Called once per process: from `bridge::run_bridge_blocking` for
/// the headless bridge, and from `gui::run_gui::setup` for the Tauri
/// build (where the guard is stored in Tauri's managed state).
pub fn init_tracing(log_dir: Option<&Path>) -> Option<WorkerGuard> {
    use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,sc_app_lib=info"));

    let stderr_layer = fmt::layer()
        .with_writer(std::io::stderr)
        .with_target(true);

    let Some(dir) = log_dir else {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(stderr_layer)
            .init();
        return None;
    };

    if let Err(e) = std::fs::create_dir_all(dir) {
        eprintln!("[init_tracing] could not create {dir:?}: {e}");
        // Fall back to stderr-only — better than refusing to boot.
        tracing_subscriber::registry()
            .with(env_filter)
            .with(stderr_layer)
            .init();
        return None;
    }

    let appender = tracing_appender::rolling::daily(dir, "sc-app.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(appender);
    let file_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .json();

    tracing_subscriber::registry()
        .with(env_filter)
        .with(stderr_layer)
        .with(file_layer)
        .init();

    tracing::info!(log_dir = %dir.display(), "tracing initialised — file output active");
    Some(guard)
}

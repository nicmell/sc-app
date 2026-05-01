//! HTTP server.
//!
//! Two responsibilities:
//! 1. Serve the Vite `dist/` directory as static files with a SPA
//!    fallback to `index.html` for any unknown path — delegated to
//!    [`static_assets`]. Used by both the Tauri webview (which loads
//!    its UI from `http://127.0.0.1:port/`) and external browsers in
//!    `serve` mode.
//! 2. Upgrade `GET /ws` to a WebSocket that the [`ws_bridge`]
//!    forwards to a per-session UDP socket connected to scsynth. The
//!    target address can be overridden per connection via
//!    `?scsynth=HOST:PORT`.
//!
//! Tracing init lives in [`logging`] and is re-exported as
//! `server::init_tracing` for the `cli.rs` callers.

use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result};
use axum::extract::{Query, Request, State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use tokio::net::TcpListener;

mod logging;
mod session;
mod static_assets;
pub mod ws_bridge;

pub use logging::init_tracing;

#[derive(Clone)]
struct AppState {
    default_scsynth: SocketAddr,
}

#[derive(Deserialize)]
struct WsQuery {
    scsynth: Option<String>,
}

/// Bind the TCP listener loopback-only on `port`. Returns the listener
/// + the resolved local address (useful for callers that want to log
/// or navigate to it before the server starts accepting).
pub async fn bind(port: u16) -> Result<(TcpListener, SocketAddr)> {
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind to {addr}"))?;
    let local = listener.local_addr().context("listener.local_addr")?;
    Ok((listener, local))
}

/// Run the HTTP+WS server on a pre-bound listener. The two-step
/// `bind` + `serve_on` split lets the GUI mode learn the port early
/// so it can navigate the webview at the right URL before the event
/// loop opens it.
pub async fn serve_on(
    listener: TcpListener,
    default_scsynth: SocketAddr,
    dist: PathBuf,
) -> Result<()> {
    let state = AppState { default_scsynth };

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(state)
        .fallback({
            let dist = dist.clone();
            move |req: Request| static_assets::static_or_spa(req, dist.clone())
        });

    tracing::info!(
        "  /ws → {default_scsynth} (override per-connection via ?scsynth=HOST:PORT)"
    );
    tracing::info!("  static → {}", dist.display());

    axum::serve(listener, app).await.context("axum serve error")?;
    Ok(())
}

/// Convenience wrapper for the `serve` subcommand: bind + serve in
/// one call, with an info log on the listening address.
pub async fn serve(port: u16, default_scsynth: SocketAddr, dist: PathBuf) -> Result<()> {
    let (listener, addr) = bind(port).await?;
    tracing::info!(addr = %addr, "sc-app listening on http://{addr}");
    serve_on(listener, default_scsynth, dist).await
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> Result<Response, (StatusCode, String)> {
    let scsynth = match query.scsynth.as_deref() {
        None => state.default_scsynth,
        Some(raw) => raw
            .parse::<SocketAddr>()
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("invalid scsynth address {raw:?}: {e}")))?,
    };

    Ok(ws.on_upgrade(move |socket| async move {
        if let Err(e) = ws_bridge::handle_ws(socket, scsynth).await {
            tracing::warn!(error = %e, "ws_bridge session error");
        }
    }))
}

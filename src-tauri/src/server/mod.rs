//! HTTP server.
//!
//! Two responsibilities:
//! 1. Serve the Vite `dist/` directory as static files with a SPA
//!    fallback to `index.html` for any unknown path (browser mode) —
//!    delegated to [`static_assets`].
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

pub async fn serve(port: u16, default_scsynth: SocketAddr, dist: PathBuf) -> Result<()> {
    let state = AppState { default_scsynth };

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(state)
        .fallback({
            let dist = dist.clone();
            move |req: Request| static_assets::static_or_spa(req, dist.clone())
        });

    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind to {addr}"))?;

    tracing::info!(addr = %addr, "sc-app listening on http://{addr}");
    tracing::info!(
        "  /ws → {default_scsynth} (override per-connection via ?scsynth=HOST:PORT)"
    );
    tracing::info!("  static → {}", dist.display());

    axum::serve(listener, app).await.context("axum serve error")?;
    Ok(())
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

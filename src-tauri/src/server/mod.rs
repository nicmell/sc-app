//! Phase 0 — HTTP server.
//!
//! Two responsibilities:
//! 1. Serve the Vite `dist/` directory as static files with a SPA
//!    fallback to `index.html` for any unknown path (browser mode).
//! 2. Upgrade `GET /ws` to a WebSocket that the
//!    [`ws_bridge`](super::server::ws_bridge) forwards to a per-session
//!    UDP socket connected to scsynth. The target address can be
//!    overridden per connection via `?scsynth=HOST:PORT`.

use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use tower_http::services::{ServeDir, ServeFile};

pub mod ws_bridge;

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

    // SPA fallback: anything that's not a file in `dist/` returns
    // `index.html` so the frontend router can take over.
    let index = dist.join("index.html");
    let static_files = ServeDir::new(&dist).fallback(ServeFile::new(&index));

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(state)
        .fallback_service(static_files);

    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind to {addr}"))?;

    eprintln!("sc-app listening on http://{addr}");
    eprintln!(
        "  /ws → {default_scsynth} (override per-connection via ?scsynth=HOST:PORT)"
    );
    eprintln!("  static → {}", dist.display());

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
            eprintln!("ws_bridge session error: {e:#}");
        }
    }))
}

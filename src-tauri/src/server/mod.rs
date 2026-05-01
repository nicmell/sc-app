//! HTTP server.
//!
//! Two responsibilities:
//! 1. Upgrade `GET /ws` to a WebSocket that the [`ws_bridge`]
//!    forwards to a per-session UDP socket connected to scsynth. The
//!    target address can be overridden per connection via
//!    `?scsynth=HOST:PORT`. This is the only required route.
//! 2. *Optionally* serve the Vite `dist/` directory as static files
//!    with a SPA fallback to `index.html` — delegated to
//!    [`static_assets`]. Used in production (Tauri webview points at
//!    the local axum, or a remote browser hits the deployed
//!    bundle). In dev the frontend is served by Vite, so the static
//!    fallback is `None` and any non-`/ws` request 404s.

use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result};
use axum::extract::{Query, Request, State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use tokio::net::TcpListener;

mod session;
pub mod static_assets;
pub mod ws_bridge;

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

/// Run the HTTP+WS server on a pre-bound listener. `dist = None`
/// disables the static fallback — anything that's not `/ws` returns
/// 404. The two-step `bind` + `serve_on` split lets the GUI mode
/// learn the port early so it can navigate the webview at the right
/// URL before the event loop opens it.
pub async fn serve_on(
    listener: TcpListener,
    default_scsynth: SocketAddr,
    dist: Option<PathBuf>,
) -> Result<()> {
    let state = AppState { default_scsynth };

    let mut app = Router::new().route("/ws", get(ws_handler));

    tracing::info!(
        "  /ws → {default_scsynth} (override per-connection via ?scsynth=HOST:PORT)"
    );

    if let Some(dist) = dist {
        tracing::info!("  static → {}", dist.display());
        let dist_for_fallback = dist.clone();
        app = app.fallback(move |req: Request| {
            static_assets::static_or_spa(req, dist_for_fallback.clone())
        });
    } else {
        tracing::info!("  static → (none — frontend served externally, e.g. yarn dev)");
        app = app.fallback(no_static_fallback);
    }

    let app = app.with_state(state);
    axum::serve(listener, app).await.context("axum serve error")?;
    Ok(())
}

/// Convenience wrapper for the `bridge` subcommand: bind + serve in
/// one call, with an info log on the listening address.
pub async fn run_bridge(
    port: u16,
    default_scsynth: SocketAddr,
    dist: Option<PathBuf>,
) -> Result<()> {
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

async fn no_static_fallback() -> Response {
    (
        StatusCode::NOT_FOUND,
        "static assets not configured — load the frontend from your dev server (yarn dev) \
         or pass --dist when running outside a Tauri bundle\n",
    )
        .into_response()
}

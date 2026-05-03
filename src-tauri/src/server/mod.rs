//! HTTP server.
//!
//! Three responsibilities:
//! 1. `GET /ws` — upgrade to a WebSocket and attach it to a
//!    bridge-managed Session (`?session=<uuid>`). The Session
//!    owns the UDP sockets to scsynth + any other route target;
//!    the WS is a forwarder. Phase 29 collapsed the pre-26
//!    per-WS-socket model — there's no `?scsynth=` legacy path
//!    anymore.
//! 2. `/api/session*` — REST endpoints for minting / reading /
//!    deleting sessions (delegated to [`api`]).
//! 3. *Optionally* serve the Vite `dist/` directory as static
//!    files with a SPA fallback to `index.html` (delegated to
//!    [`static_assets`]). In dev the frontend is served by
//!    Vite, so the static fallback is `None` and any non-API,
//!    non-`/ws` request 404s.
//!
//! A background TTL task (Phase 29d) scans the SessionStore once
//! per minute and evicts sessions whose `last_active` is older
//! than the configured TTL. Each evicted session runs its
//! cleanup bundle (/g_freeAll + /n_free + /notify 0).

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use axum::extract::{Query, Request, State, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode};
use axum::middleware;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use tokio::net::TcpListener;
use uuid::Uuid;

mod api;
mod routing;
mod security;
mod session;
pub mod static_assets;
pub mod ws_bridge;
pub mod ws_scope;

pub use routing::RoutingTable;
use session::SessionStore;

/// How often the TTL eviction task scans the session store.
/// One minute is well under the typical 30-minute TTL so a
/// session that just expired won't linger more than a minute
/// past its deadline.
const TTL_SCAN_INTERVAL: Duration = Duration::from_secs(60);

#[derive(Clone)]
pub(crate) struct AppState {
    pub routes: Arc<RoutingTable>,
    pub sessions: SessionStore,
}

#[derive(Deserialize)]
struct WsQuery {
    /// Identifier for a bridge-managed Session minted via
    /// `POST /api/session`. The WS attaches to that Session's
    /// pre-bound UDP sockets and broadcast channels. Required —
    /// the pre-29 `?scsynth=` legacy path is gone.
    session: Option<Uuid>,
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
/// disables the static fallback — anything that's not `/ws` or
/// `/api/*` returns 404. The two-step `bind` + `serve_on` split
/// lets GUI mode learn the port early so it can navigate the
/// webview at the right URL before the event loop opens it.
///
/// Spawns a background TTL eviction task on the same runtime;
/// no JoinHandle returned, the task lives until the bridge
/// process exits.
pub async fn serve_on(
    listener: TcpListener,
    routes: RoutingTable,
    dist: Option<PathBuf>,
    session_ttl: Duration,
) -> Result<()> {
    tracing::info!("  /ws routing table:\n{}", routes.describe());
    tracing::info!(
        ttl_seconds = session_ttl.as_secs(),
        "  session TTL"
    );

    let state = AppState {
        routes: Arc::new(routes),
        sessions: SessionStore::new(),
    };

    spawn_ttl_task(state.sessions.clone(), session_ttl);

    let mut app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/ws/scope", get(ws_scope::ws_scope_handler))
        .route("/api/session", axum::routing::post(api::post_session))
        .route(
            "/api/session/{id}",
            get(api::get_session).delete(api::delete_session),
        )
        .route("/api/scope/probe", get(api::get_scope_probe))
        .route("/api/scope/layout", get(api::get_scope_layout))
        .route("/api/scope/debug", get(api::get_scope_debug))
        .route("/api/scope/headers", get(api::get_scope_headers));

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

    // Phase 34: enforce loopback Host on every HTTP request to
    // defend against DNS rebinding. Layered before `with_state`
    // so it sees every route — `/ws`, `/api/*`, the static
    // fallback, all of it.
    let app = app
        .layer(middleware::from_fn(security::enforce_host))
        .with_state(state);
    axum::serve(listener, app).await.context("axum serve error")?;
    Ok(())
}

/// Convenience wrapper for the `bridge` subcommand: bind + serve in
/// one call, with an info log on the listening address.
pub async fn run_bridge(
    port: u16,
    routes: RoutingTable,
    dist: Option<PathBuf>,
    session_ttl: Duration,
) -> Result<()> {
    let (listener, addr) = bind(port).await?;
    tracing::info!(addr = %addr, "sc-app listening on http://{addr}");
    serve_on(listener, routes, dist, session_ttl).await
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    // Phase 34: WebSocket upgrades aren't subject to SOP the way
    // `fetch` is. Reject any upgrade whose Origin (when present)
    // doesn't name a loopback origin.
    security::check_ws_origin(&headers)?;
    // Phase 29: only the `?session=<uuid>` path is supported.
    // The Session owns the UDP sockets, broadcast channels, and
    // scsynth /notify subscription; the WS is purely a forwarder.
    let Some(session_id) = query.session else {
        return Err((
            StatusCode::BAD_REQUEST,
            "WS upgrade requires ?session=<uuid> — mint a session via POST /api/session first".into(),
        ));
    };
    let Some(session) = state.sessions.get_and_touch(&session_id).await else {
        return Err((
            StatusCode::NOT_FOUND,
            format!("session {session_id} not found (expired or never existed)"),
        ));
    };
    Ok(ws.on_upgrade(move |socket| async move {
        if let Err(e) = ws_bridge::handle_ws_session(socket, session).await {
            tracing::warn!(error = %e, "ws_bridge session error");
        }
    }))
}

/// Spawn the once-a-minute TTL eviction loop. Detached — runs
/// until the bridge process exits. The first tick fires after
/// `TTL_SCAN_INTERVAL` (not immediately) so a freshly-bootstrapped
/// frontend isn't racing with eviction during its first attach.
fn spawn_ttl_task(sessions: SessionStore, ttl: Duration) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(TTL_SCAN_INTERVAL);
        // tokio's first tick fires immediately by default; advance
        // past it so we don't sweep before any session has even
        // had a chance to be created.
        interval.tick().await;
        loop {
            interval.tick().await;
            sessions.evict_idle(ttl).await;
        }
    });
}

async fn no_static_fallback() -> Response {
    (
        StatusCode::NOT_FOUND,
        "static assets not configured — load the frontend from your dev server (yarn dev) \
         or pass --dist when running outside a Tauri bundle\n",
    )
        .into_response()
}

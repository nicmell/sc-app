//! HTTP server.
//!
//! Three responsibilities:
//! 1. `GET /ws` — upgrade to a WebSocket and attach it to a
//!    bridge-managed Session (`?session=<uuid>`).
//! 2. `/api/session*` — REST endpoints for minting / reading /
//!    deleting sessions (delegated to [`api`]).
//! 3. *Optionally* serve the Vite `dist/` directory as static
//!    files with a SPA fallback to `index.html`.
//!
//! Phase 39a: UDP sockets, broadcast channels, and the scsynth
//! `/notify` registration live on bridge-level [`server::Server`]
//! instances (one per route target), not per-Session. Sessions
//! become per-tab bookkeeping (session_slot, parent_group_id,
//! scope_mode). The TTL eviction job sweeps stale sessions and
//! runs `Session::cleanup` against the shared scsynth Server;
//! `/notify 0` only runs at bridge shutdown.

use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use axum::extract::{Query, Request, State, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::from_fn as axum_middleware_from_fn;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use tokio::net::TcpListener;
use uuid::Uuid;

mod api;
pub(crate) mod middleware;
mod routing;
mod security;
pub(crate) mod server;
pub(crate) mod session;
pub mod static_assets;
pub mod ws_bridge;

pub use routing::RoutingTable;
use server::{free_bridge_clock, instantiate_bridge_clock, scan_dirt_samples, Server, ServerRole};
use session::{send_bridge_notify_off, SessionSlotAllocator, SessionStore};

use crate::scope::middleware::BridgeScopeAllocator;

/// How often the TTL eviction task scans the session store.
const TTL_SCAN_INTERVAL: Duration = Duration::from_secs(60);

#[derive(Clone)]
pub(crate) struct AppState {
    pub routes: Arc<RoutingTable>,
    /// Phase 39a: bridge-level Server pool, one per unique route
    /// target. Sessions never own UDP sockets; they look up
    /// servers via this map.
    pub servers: Arc<HashMap<SocketAddr, Arc<Server>>>,
    /// Convenience strong-ref to the scsynth Server. Same Arc as
    /// `servers[scsynth_addr]`. Avoids a HashMap lookup on the
    /// hot paths (cleanup, scope SHM probe, /b_getn issuance).
    pub scsynth_server: Arc<Server>,
    /// Phase 39b: convenience strong-ref to the sclang Server,
    /// if configured. Holds cached bootstrap metadata
    /// (`ClockMetadata`, `num_scope_buffers`, `dirt_samples`)
    /// surfaced via `SessionInfo`.
    pub sclang_server: Option<Arc<Server>>,
    /// Phase 39c: bridge-owned scope-buffer allocator. Sized
    /// from `SclangServer.metadata.num_scope_buffers` at boot
    /// (default 128 if sclang isn't reachable).
    pub scope_allocator: Arc<BridgeScopeAllocator>,
    /// Phase 39d: clock chunkSize from config; used by the
    /// lazy bootstrap path to call `instantiate_bridge_clock`
    /// when the boot-time bootstrap missed sclang.
    pub clock_chunk_size: u32,
    /// Phase 40: clock nodeId from config. Used by the lazy
    /// bootstrap path's `instantiate_bridge_clock` call and by
    /// the bridge-shutdown `free_bridge_clock` call.
    pub clock_node_id: i32,
    /// Phase 40: clock audio-bus index from config. /s_new arg
    /// for the `\scAppClock` synth.
    pub clock_audio_bus: i32,
    pub sessions: SessionStore,
    pub session_slot_allocator: Arc<SessionSlotAllocator>,
    /// Phase 36: when true, every new session uses
    /// `ScopeMode::Osc` regardless of SHM availability. Set via
    /// the `bridge --no-shm` CLI flag.
    pub force_osc_mode: bool,
}

#[derive(Deserialize)]
struct WsQuery {
    /// Identifier for a bridge-managed Session minted via
    /// `POST /api/session`.
    session: Option<Uuid>,
}

/// Bind the TCP listener loopback-only on `port`.
pub async fn bind(port: u16) -> Result<(TcpListener, SocketAddr)> {
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind to {addr}"))?;
    let local = listener.local_addr().context("listener.local_addr")?;
    Ok((listener, local))
}

/// Run the HTTP+WS server on a pre-bound listener. Builds one
/// [`Server`] per unique route target at boot, runs the scsynth
/// handshake (`/notify` + `/status`) once, then accepts HTTP
/// connections.
///
/// scsynth and sclang targets are derived from the routes table
/// by walking it for known probe addresses (`/notify` for
/// scsynth, `/dirt` for sclang in Phase 40 — pre-40 the sclang
/// probe was `/bootstrap/hello`, which is no longer routed since
/// the bootstrap responder is gone). Returns an error if no route
/// matches `/notify` (the bridge can't function without a scsynth
/// handshake target); a missing sclang route just disables
/// clock/scope/sequencer features.
pub async fn serve_on(
    listener: TcpListener,
    routes: RoutingTable,
    clock_chunk_size: u32,
    clock_node_id: i32,
    clock_audio_bus: i32,
    num_scope_buffers: i32,
    dist: Option<PathBuf>,
    session_ttl: Duration,
    force_osc_mode: bool,
) -> Result<()> {
    tracing::info!("  /ws routing table:\n{}", routes.describe());

    let scsynth_addr = routes.route_for("/notify").ok_or_else(|| {
        anyhow::anyhow!(
            "config.routes has no route matching `/notify` — the bridge \
             needs a scsynth target. Check config.json's routes table."
        )
    })?;
    let sclang_addr = routes.route_for("/dirt");
    tracing::info!(scsynth = %scsynth_addr, "  scsynth target (derived from routes via /notify)");
    if let Some(addr) = sclang_addr {
        tracing::info!(sclang = %addr, "  sclang target (derived from routes via /dirt)");
    } else {
        tracing::info!("  sclang: no /dirt route — clock/scope/sequencer features will not work");
    }
    tracing::info!(
        ttl_seconds = session_ttl.as_secs(),
        "  session TTL"
    );

    // Build Servers for every unique route target. With scsynth +
    // sclang derived from the routes table, every target we need is
    // already in `routes.unique_targets()`.
    let targets: HashSet<SocketAddr> = routes.unique_targets().into_iter().collect();

    let mut servers: HashMap<SocketAddr, Arc<Server>> = HashMap::new();
    for target in targets {
        let role = if target == scsynth_addr {
            ServerRole::Scsynth
        } else if Some(target) == sclang_addr {
            ServerRole::Sclang
        } else {
            ServerRole::Generic
        };
        let server = Server::build(target, role).await?;
        servers.insert(target, server);
    }
    let scsynth_server = servers
        .get(&scsynth_addr)
        .expect("scsynth Server must be in the map (just inserted)")
        .clone();
    let sclang_server = sclang_addr.and_then(|addr| servers.get(&addr).cloned());

    // Phase 39d: bridge instantiates the \scAppClock synth
    // BEFORE accepting HTTP/WS, so sessions can rely on the
    // clock being up. Reads clockBus + clockNodeId from
    // SclangServer's bootstrap reply; reads sampleRate from
    // ScsynthServer's /status reply; uses chunkSize from
    // bridge config. Best-effort: if it fails, log + continue
    // (sessions will see SessionInfo.clock = None and surface
    // a clear error in the connect screen).
    // Phase 40: write the sclang Server's bridge-owned metadata
    // (scope-pool size + dirt-samples scan from disk). Both pre-40
    // came via /bootstrap/hello; Phase 40 sources them from config
    // + the SC_APP_DIRT_SAMPLES env var directly.
    if let Some(sclang) = sclang_server.as_ref() {
        // Phase 40: dirt samples come from a disk walk. Source path
        // precedence:
        //   1. SC_APP_DIRT_SAMPLES env var (matches what
        //      start-superdirt-only.sh exports for sclang).
        //   2. "./superdirt-deps/Dirt-Samples" relative to CWD —
        //      auto-discovery for `yarn bridge` / `yarn dev:full`
        //      from the repo root, so users don't need to export
        //      the env var twice (once for sclang, once for the
        //      bridge shell).
        //   3. Empty list — sequencer panel autocomplete just
        //      stays empty.
        let dirt_samples_source = std::env::var("SC_APP_DIRT_SAMPLES")
            .ok()
            .or_else(|| {
                let p = std::path::Path::new("./superdirt-deps/Dirt-Samples");
                p.is_dir().then(|| p.display().to_string())
            });
        let dirt_samples = dirt_samples_source
            .as_deref()
            .map(scan_dirt_samples)
            .unwrap_or_default();
        if dirt_samples.is_empty() {
            tracing::info!(
                "  dirt samples: 0 banks (no SC_APP_DIRT_SAMPLES and no \
                 ./superdirt-deps/Dirt-Samples in CWD)"
            );
        } else {
            tracing::info!(
                bank_count = dirt_samples.len(),
                source = ?dirt_samples_source,
                "  dirt samples scanned from disk"
            );
        }
        sclang
            .set_sclang_metadata(Some(num_scope_buffers), dirt_samples)
            .await;

        // Phase 40: clock /s_new. Failure is non-fatal — sclang
        // may not have .add()-ed the SynthDef yet (bridge boots
        // before sclang). The api.rs lazy-bootstrap path retries
        // on every session create until success.
        match instantiate_bridge_clock(
            &scsynth_server,
            sclang,
            clock_chunk_size,
            clock_node_id,
            clock_audio_bus,
        )
        .await
        {
            Ok(()) => {
                tracing::info!(
                    clock_chunk_size,
                    clock_node_id,
                    clock_audio_bus,
                    "bridge clock /s_new succeeded"
                );
            }
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "bridge clock /s_new failed at boot — will retry on first \
                     session create (typical when bridge starts before sclang)"
                );
            }
        }
    } else {
        tracing::info!(
            "no sclang server configured — skipping clock /s_new + samples scan"
        );
    }

    // Phase 40: scope-buffer allocator pool size comes from config
    // directly (pre-40 it came from sclang's bootstrap reply). The
    // value pins to scsynth's 128-slot SHM pool unless the user has
    // overridden it for a custom scsynth fork.
    let scope_pool_size: u32 = num_scope_buffers.max(0) as u32;
    tracing::info!(scope_pool_size, "  scope-buffer allocator pool sized");
    let scope_allocator = Arc::new(BridgeScopeAllocator::new(scope_pool_size));

    let state = AppState {
        routes: Arc::new(routes),
        servers: Arc::new(servers),
        scsynth_server: scsynth_server.clone(),
        sclang_server,
        scope_allocator,
        clock_chunk_size,
        clock_node_id,
        clock_audio_bus,
        sessions: SessionStore::new(),
        session_slot_allocator: Arc::new(SessionSlotAllocator::new()),
        force_osc_mode,
    };

    spawn_ttl_task(
        state.sessions.clone(),
        state.scsynth_server.clone(),
        state.session_slot_allocator.clone(),
        session_ttl,
    );

    let mut app = Router::new()
        .route("/ws", get(ws_handler))
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

    let app = app
        .layer(axum_middleware_from_fn(security::enforce_host))
        .with_state(state.clone());

    // Run the HTTP server, then on shutdown drain sessions and
    // release the bridge's /notify slot + free the clock synth.
    let serve_result = axum::serve(listener, app).await.context("axum serve error");

    tracing::info!("HTTP server stopping; running bridge teardown");
    let active = state.sessions.drain_all().await;
    for session in active {
        session
            .cleanup(&state.scsynth_server, &state.session_slot_allocator)
            .await;
    }
    // Phase 40: free the clock synth before /notify 0. nodeId
    // comes from config (AppState) — pre-40 it came from
    // sclang's bootstrap reply.
    if state.sclang_server.is_some() {
        if let Err(e) =
            free_bridge_clock(&state.scsynth_server, state.clock_node_id).await
        {
            tracing::warn!(error = %e, "free_bridge_clock failed at shutdown");
        }
    }
    if let Err(e) = send_bridge_notify_off(&state.scsynth_server).await {
        tracing::warn!(error = %e, "bridge /notify 0 failed at shutdown");
    }
    tokio::time::sleep(Duration::from_millis(50)).await;

    serve_result
}

/// Convenience wrapper for the `bridge` subcommand: bind + serve.
pub async fn run_bridge(
    port: u16,
    routes: RoutingTable,
    clock_chunk_size: u32,
    clock_node_id: i32,
    clock_audio_bus: i32,
    num_scope_buffers: i32,
    dist: Option<PathBuf>,
    session_ttl: Duration,
    force_osc_mode: bool,
) -> Result<()> {
    let (listener, addr) = bind(port).await?;
    tracing::info!(addr = %addr, "sc-app listening on http://{addr}");
    serve_on(
        listener,
        routes,
        clock_chunk_size,
        clock_node_id,
        clock_audio_bus,
        num_scope_buffers,
        dist,
        session_ttl,
        force_osc_mode,
    )
    .await
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    security::check_ws_origin(&headers)?;
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
        if let Err(e) = ws_bridge::handle_ws_session(socket, session, state).await {
            tracing::warn!(error = %e, "ws_bridge session error");
        }
    }))
}

/// Spawn the once-a-minute TTL eviction loop.
fn spawn_ttl_task(
    sessions: SessionStore,
    scsynth_server: Arc<Server>,
    session_slot_allocator: Arc<SessionSlotAllocator>,
    ttl: Duration,
) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(TTL_SCAN_INTERVAL);
        interval.tick().await; // skip the immediate first tick
        loop {
            interval.tick().await;
            sessions
                .evict_idle(&scsynth_server, &session_slot_allocator, ttl)
                .await;
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

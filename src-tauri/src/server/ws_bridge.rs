//! WebSocket ↔ bridge OSC dispatch.
//!
//! Phase 39a: UDP sockets and broadcast channels live on the
//! shared `Server` instances in `AppState.servers`, not on the
//! Session. The WS handler subscribes to each Server's broadcast
//! channel and runs `dispatch_inbound` on payloads; the recv
//! loop runs `dispatch_outbound` then sends via
//! `state.servers[target].send()`.
//!
//! Cleanup invariant: per-WS `ScopeContext` drops with the
//! handler's stack frame (WS closed). The Session itself
//! outlives the WS — sessions are torn down on DELETE or by the
//! TTL eviction job.

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::{SplitSink, StreamExt};
use futures_util::SinkExt;
use tokio::sync::broadcast;
use tokio::sync::Mutex as TokioMutex;
use tokio::task::JoinHandle;

use super::middleware::{
    self, Direction, InboundMiddleware, MiddlewareOutcome, MiddlewareRegistry,
    OutboundMiddleware, WsCtx,
};
use super::routing::peek_osc_address;
use super::session::Session;
use super::AppState;
use crate::scope::middleware::{self as scope_mw, ScopeContext};

/// Bridge a WebSocket against an existing Session. Subscribes to
/// every Server's broadcast channel and forwards inbound replies
/// through `dispatch_inbound`; the recv loop runs
/// `dispatch_outbound` + Server-routed UDP send for outbound
/// frames.
pub(crate) async fn handle_ws_session(
    ws: WebSocket,
    session: Arc<Session>,
    state: AppState,
) -> Result<()> {
    let (tx, mut rx) = ws.split();
    let tx = Arc::new(TokioMutex::new(tx));

    // Per-WS scope subscriptions. Wrapped in a Mutex so the recv
    // loop (outbound dispatch on /scope/{subscribe,unsubscribe})
    // and the broadcast forwarders (inbound dispatch on
    // /clock/tick + /b_setn) can both mutate it.
    let scope_ctx = Arc::new(TokioMutex::new(ScopeContext::new()));

    // Phase 38: pure-OSC scope wire. Outbound registry claims
    // /scope/subscribe + /scope/unsubscribe. Inbound registry
    // gets the scope-mode-appropriate handlers.
    let outbound_registry: Arc<MiddlewareRegistry<OutboundMiddleware>> = {
        let mut reg = MiddlewareRegistry::new();
        scope_mw::register_outbound_middlewares(&mut reg);
        Arc::new(reg)
    };
    let inbound_registry: Arc<MiddlewareRegistry<InboundMiddleware>> = {
        let mut reg = MiddlewareRegistry::new();
        scope_mw::register_inbound_middlewares(&mut reg, session.scope_mode);
        Arc::new(reg)
    };

    // Subscribe to each Server's broadcast channel and spawn one
    // forwarder per channel. Phase 39a: every WS shares the
    // bridge-level broadcast (sees every other session's replies
    // too — see plan.md Phase 39 cross-cutting risks for the
    // /fail correlation cost).
    let mut forwarder_tasks: Vec<JoinHandle<()>> = Vec::new();
    for (target, server) in state.servers.iter() {
        let receiver = server.subscribe();
        let target = *target;
        let tx_clone = tx.clone();
        let scope_ctx_clone = scope_ctx.clone();
        let session_clone = session.clone();
        let inbound_clone = inbound_registry.clone();
        let state_clone = state.clone();
        let task = tokio::spawn(forward_with_dispatch(
            receiver,
            tx_clone,
            target,
            scope_ctx_clone,
            session_clone,
            inbound_clone,
            state_clone,
        ));
        forwarder_tasks.push(task);
    }

    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Binary(bytes)) => {
                let bytes_slice = bytes.as_ref();
                if bytes_slice.is_empty() {
                    continue;
                }
                if let Err(e) = handle_outbound_osc(
                    bytes_slice,
                    &scope_ctx,
                    &session,
                    &outbound_registry,
                    &state,
                )
                .await
                {
                    tracing::warn!(
                        error = %e,
                        session_id = %session.session_id,
                        "outbound dispatch error"
                    );
                    break;
                }
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => {} // ignore text / ping / pong
            Err(e) => {
                tracing::warn!(error = %e, "ws recv error");
                break;
            }
        }
    }

    for task in &forwarder_tasks {
        task.abort();
    }

    let dropped_count = {
        let ctx = scope_ctx.lock().await;
        ctx.total_subs()
    };
    if dropped_count > 0 {
        tracing::debug!(
            session_id = %session.session_id,
            dropped_count,
            "ws closed; dropped scope subscriptions"
        );
    }

    drop(tx);
    Ok(())
}

/// Outbound dispatch for one OSC payload from the WS recv loop.
async fn handle_outbound_osc(
    bytes: &[u8],
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
    session: &Arc<Session>,
    outbound_registry: &Arc<MiddlewareRegistry<OutboundMiddleware>>,
    state: &AppState,
) -> Result<()> {
    let address = peek_osc_address(bytes);
    let Some(addr_str) = address else {
        tracing::warn!(
            session_id = %session.session_id,
            "outbound packet has no parseable OSC address; dropping"
        );
        return Ok(());
    };

    let outcome = if outbound_registry.is_empty() {
        MiddlewareOutcome::PassThrough
    } else {
        let mut scope = scope_ctx.lock().await;
        let mut ctx = WsCtx::new(
            session,
            &state.scsynth_server,
            &state.scope_allocator,
            &mut scope,
            Direction::Outbound,
            None,
        );
        let outcome = middleware::dispatch_outbound(
            outbound_registry,
            &mut ctx,
            addr_str,
            bytes,
        )
        .await;
        let WsCtx {
            ws_extras,
            udp_extras,
            ..
        } = ctx;
        flush_udp_extras(state, udp_extras).await;
        if !ws_extras.is_empty() {
            tracing::warn!(
                session_id = %session.session_id,
                count = ws_extras.len(),
                "outbound middleware emitted ws_extras — Phase 39a expected this empty"
            );
        }
        outcome
    };

    let payload = match outcome {
        MiddlewareOutcome::Consumed => return Ok(()),
        MiddlewareOutcome::ConsumedAndSend(bytes) => bytes,
        MiddlewareOutcome::PassThrough => bytes.to_vec(),
    };

    let route_addr = peek_osc_address(&payload).unwrap_or(addr_str);
    let Some(target) = session.routes_route_for(&state.routes, route_addr) else {
        tracing::warn!(
            session_id = %session.session_id,
            address = route_addr,
            "orphan outbound address (no matching route); dropping"
        );
        return Ok(());
    };
    let Some(server) = state.servers.get(&target) else {
        tracing::warn!(
            ?target,
            session_id = %session.session_id,
            "no Server for routed target; dropping packet"
        );
        return Ok(());
    };
    if let Err(e) = server.send(&payload).await {
        anyhow::bail!("udp send to {target}: {e}");
    }
    Ok(())
}

/// Per-Server broadcast forwarder.
async fn forward_with_dispatch(
    mut receiver: broadcast::Receiver<Vec<u8>>,
    tx: Arc<TokioMutex<SplitSink<WebSocket, Message>>>,
    target: SocketAddr,
    scope_ctx: Arc<TokioMutex<ScopeContext>>,
    session: Arc<Session>,
    inbound_registry: Arc<MiddlewareRegistry<InboundMiddleware>>,
    state: AppState,
) {
    loop {
        match receiver.recv().await {
            Ok(payload) => {
                if let Err(()) = forward_one_payload(
                    &payload,
                    &tx,
                    target,
                    &scope_ctx,
                    &session,
                    &inbound_registry,
                    &state,
                )
                .await
                {
                    break;
                }
            }
            Err(broadcast::error::RecvError::Lagged(skipped)) => {
                tracing::warn!(
                    skipped,
                    ?target,
                    "Server forwarder lagged; some replies dropped"
                );
            }
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}

/// Run inbound dispatch + WS send for a single broadcast payload.
async fn forward_one_payload(
    payload: &[u8],
    tx: &Arc<TokioMutex<SplitSink<WebSocket, Message>>>,
    target: SocketAddr,
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
    session: &Arc<Session>,
    inbound_registry: &Arc<MiddlewareRegistry<InboundMiddleware>>,
    state: &AppState,
) -> std::result::Result<(), ()> {
    let address = peek_osc_address(payload);

    let needs_dispatch = address
        .map(|a| inbound_registry.iter_matching(a).next().is_some())
        .unwrap_or(false);

    let (outcome, ws_extras, udp_extras) = if needs_dispatch {
        let mut scope = scope_ctx.lock().await;
        let mut ctx = WsCtx::new(
            session,
            &state.scsynth_server,
            &state.scope_allocator,
            &mut scope,
            Direction::Inbound,
            Some(target),
        );
        let outcome = middleware::dispatch_inbound(
            inbound_registry,
            &mut ctx,
            address.expect("needs_dispatch implies Some"),
            payload,
        )
        .await;
        let WsCtx {
            ws_extras,
            udp_extras,
            ..
        } = ctx;
        (outcome, ws_extras, udp_extras)
    } else {
        (MiddlewareOutcome::PassThrough, Vec::new(), Vec::new())
    };

    let primary_bytes = match outcome {
        MiddlewareOutcome::Consumed => None,
        MiddlewareOutcome::ConsumedAndSend(bytes) => Some(bytes),
        MiddlewareOutcome::PassThrough => Some(payload.to_vec()),
    };

    if primary_bytes.is_some() || !ws_extras.is_empty() {
        let mut tx_guard = tx.lock().await;
        if let Some(bytes) = primary_bytes {
            if let Err(e) = tx_guard.send(Message::Binary(bytes.into())).await {
                tracing::debug!(
                    error = %e,
                    ?target,
                    "ws send error from forwarder (probably closed)"
                );
                return Err(());
            }
        }
        for extra in ws_extras {
            if let Err(e) = tx_guard.send(Message::Binary(extra.into())).await {
                tracing::debug!(
                    error = %e,
                    ?target,
                    "ws send error sending scope chunk extra (probably closed)"
                );
                return Err(());
            }
        }
    }

    flush_udp_extras(state, udp_extras).await;

    Ok(())
}

/// Send each (target, bytes) pair via the bridge-level Server
/// for that target.
async fn flush_udp_extras(state: &AppState, udp_extras: Vec<(SocketAddr, Vec<u8>)>) {
    for (target, bytes) in udp_extras {
        let Some(server) = state.servers.get(&target) else {
            tracing::warn!(
                ?target,
                "no Server for udp_extras target; dropping"
            );
            continue;
        };
        if let Err(e) = server.send(&bytes).await {
            tracing::warn!(
                error = %e,
                ?target,
                "udp send error from middleware extras"
            );
        }
    }
}

/// Helper: routes lookup. Phase 39a's Session no longer holds
/// the routing table; callers go through AppState. This thin
/// wrapper keeps the call-site readable.
trait SessionRouting {
    fn routes_route_for(
        &self,
        routes: &super::routing::RoutingTable,
        address: &str,
    ) -> Option<SocketAddr>;
}

impl SessionRouting for Session {
    fn routes_route_for(
        &self,
        routes: &super::routing::RoutingTable,
        address: &str,
    ) -> Option<SocketAddr> {
        routes.route_for(address)
    }
}

//! WebSocket ↔ Session bridge.
//!
//! Phase 0 (per-WS sockets) and Phase 22 (per-WS cleanup) are
//! gone in 29d — the only path now is "WS attaches to a
//! pre-existing bridge-managed [`Session`] and forwards bytes
//! through its UDP sockets". Sockets, broadcast channels, and
//! the scsynth `/notify 1` subscription all live on the
//! Session; cleanup runs on `DELETE /api/session/:id` or the
//! TTL eviction task. Closing a WS only aborts that WS's
//! per-target forwarder tasks — the Session itself outlives.
//!
//! Phase 35: scope buffer chunk delivery is back in-band on
//! this same WS (after the brief Phase 31 detour through
//! per-scope `/ws/scope` connections). Wire format on inbound
//! binary frames discriminates by first byte:
//!
//! ```text
//! `/` (0x2F) | `#` (0x23)  → OSC bytes (existing forward path)
//! 0x01                      → scope subscribe
//! 0x02                      → scope unsubscribe
//! ```
//!
//! Outbound (bridge → WS): scope chunks are 0x03-tagged frames,
//! interleaved with the per-target forwarders' OSC payloads.
//! See `src/workers/scopeWire.ts` for the worker-side encoder /
//! decoder.
//!
//! Phase 37c: the scope-related dispatch logic moved out of this
//! module into [`crate::scope::middleware`]. ws_bridge now owns:
//!
//! 1. The recv loop (WS → bridge):
//!    - 0x01 / 0x02 binary frames call into
//!      [`crate::scope::middleware::ws_scope_subscribe_binary`] /
//!      [`crate::scope::middleware::ws_scope_unsubscribe_binary`]
//!      directly.
//!    - OSC payloads run through [`super::middleware::dispatch_outbound`]
//!      first (no variants registered in 37c — Phase 38 adds
//!      `/scope/{subscribe,unsubscribe}`), then fall through to
//!      [`super::routing::RoutingTable::route_for`] + UDP send.
//!      Orphan addresses (no route + no middleware) drop with a
//!      `warn!` log.
//! 2. The forwarder loop (bridge → WS):
//!    - Each broadcast payload is run through
//!      [`super::middleware::dispatch_inbound`]. The scope
//!      module registers handlers for `^/clock/tick$` (chunk
//!      emission in SHM mode, `/b_getn` issuance in OSC mode)
//!      and `^/b_setn` (intercept matching bufnums in OSC mode).
//!      Side-effect bytes (per-tick chunks, per-tick `/b_getn`
//!      bundles) flow through `WsCtx::ws_extras` and
//!      `WsCtx::udp_extras`; the forwarder drains them post-
//!      dispatch.
//!
//! ## WS-close cleanup
//!
//! `ScopeContext` lives in `handle_ws_session`'s scope and drops
//! when the function returns (WS closed, peer disconnect, or
//! transport error). The subscription map drops with it, so no
//! polling task keeps reading SHM for a dead WS. The `forwarder_tasks`
//! abort loop at end-of-function also stops the forwarder/poller
//! tasks. The `Session::scope_shm` mmap stays alive — other WSs
//! on the same session reuse it; it drops only when the Session
//! itself drops (TTL eviction or DELETE).

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
use crate::scope::middleware::{self as scope_mw, ScopeContext};

/// Bridge a WebSocket against an existing [`Session`]'s pre-bound
/// UDP sockets. Inbound replies fan out via `broadcast::Sender`
/// per target — each WS subscribes once per target and forwards
/// to its sink. `RecvError::Lagged(n)` fires a warning and
/// continues; this is the trapdoor for a slow consumer to lose
/// messages, but at our throughput + 4096-deep buffer we'd need
/// to be in the seconds-of-stalled-IO range before it bites.
pub async fn handle_ws_session(ws: WebSocket, session: Arc<Session>) -> Result<()> {
    let (tx, mut rx) = ws.split();
    let tx = Arc::new(TokioMutex::new(tx));

    // Per-WS scope subscriptions. Wrapped in a Mutex so the recv
    // loop (outbound dispatch on /scope/{subscribe,unsubscribe})
    // and the broadcast forwarder (inbound dispatch on
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

    // Subscribe to each target's broadcast channel and spawn one
    // forwarder per channel. Every forwarder runs the inbound
    // dispatcher; the registry decides per-address whether to do
    // anything (most addresses pass through trivially).
    let mut forwarder_tasks: Vec<JoinHandle<()>> = Vec::new();
    for (target, sender) in session.broadcast_senders.iter() {
        let receiver = sender.subscribe();
        let target = *target;
        let tx_clone = tx.clone();
        let scope_ctx_clone = scope_ctx.clone();
        let session_clone = session.clone();
        let inbound_clone = inbound_registry.clone();
        let task = tokio::spawn(forward_with_dispatch(
            receiver,
            tx_clone,
            target,
            scope_ctx_clone,
            session_clone,
            inbound_clone,
        ));
        forwarder_tasks.push(task);
    }

    // WS → UDP loop. Phase 38: every inbound binary frame is
    // pure OSC. Run dispatch_outbound first; if Consumed
    // (e.g. /scope/subscribe), stop. If PassThrough or
    // ConsumedAndSend, route via routes.route_for + UDP send.
    // Orphan addresses (no route + no middleware) drop+warn.
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

    // Stop the per-target forwarders so they don't keep the
    // subscriptions alive after the WS sink closes.
    for task in &forwarder_tasks {
        task.abort();
    }

    // Phase 35 cleanup point: ScopeContext drops here, taking
    // every subscription with it. Log the count so the cleanup
    // is visible in traces. (The session-level `scope_shm` mmap
    // outlives this WS — only the per-WS subscription state goes.)
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

    // No session cleanup here — sessions outlive WS by design.
    // DELETE /api/session/:id or the TTL job (29d) is what
    // triggers Session::cleanup.
    drop(tx);
    Ok(())
}

/// Outbound dispatch for one OSC payload from the WS recv loop.
/// 37c always returns PassThrough from `dispatch_outbound`
/// (registry empty); the routing path runs every time. Phase 38
/// will add `/scope/{subscribe,unsubscribe}` variants that may
/// claim before routing.
async fn handle_outbound_osc(
    bytes: &[u8],
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
    session: &Arc<Session>,
    outbound_registry: &Arc<MiddlewareRegistry<OutboundMiddleware>>,
) -> Result<()> {
    let address = peek_osc_address(bytes);
    let Some(addr_str) = address else {
        tracing::warn!(
            session_id = %session.session_id,
            "outbound packet has no parseable OSC address; dropping"
        );
        return Ok(());
    };

    // Outbound dispatch. Skip the lock acquisition entirely if
    // the registry is empty (37c default).
    let outcome = if outbound_registry.is_empty() {
        MiddlewareOutcome::PassThrough
    } else {
        let mut scope = scope_ctx.lock().await;
        let mut ctx = WsCtx::new(session, &mut scope, Direction::Outbound, None);
        let outcome = middleware::dispatch_outbound(
            outbound_registry,
            &mut ctx,
            addr_str,
            bytes,
        )
        .await;
        // Drain side-channels even on outbound (handlers may
        // emit additional UDP packets — none do today, but the
        // shape is preserved for future use).
        let WsCtx { ws_extras, udp_extras, .. } = ctx;
        flush_udp_extras(session, udp_extras).await;
        // ws_extras on outbound: route via routing table just
        // like the original payload would. Empty in 37c.
        for extra in ws_extras {
            tracing::warn!(
                session_id = %session.session_id,
                bytes = extra.len(),
                "outbound middleware emitted ws_extras — Phase 37c expected this empty"
            );
        }
        outcome
    };

    let payload = match outcome {
        MiddlewareOutcome::Consumed => return Ok(()),
        MiddlewareOutcome::ConsumedAndSend(bytes) => bytes,
        MiddlewareOutcome::PassThrough => bytes.to_vec(),
    };

    // Default routing path: regex match → UDP send.
    let route_addr = peek_osc_address(&payload).unwrap_or(addr_str);
    let Some(target) = session.routes.route_for(route_addr) else {
        tracing::warn!(
            session_id = %session.session_id,
            address = route_addr,
            "orphan outbound address (no matching route); dropping"
        );
        return Ok(());
    };
    let Some(sock) = session.target_sockets.get(&target) else {
        tracing::warn!(
            ?target,
            session_id = %session.session_id,
            "no socket for routed target on session; dropping packet"
        );
        return Ok(());
    };
    if let Err(e) = sock.send(&payload).await {
        anyhow::bail!("udp send to {target}: {e}");
    }
    Ok(())
}

/// Per-target broadcast forwarder. Peels payloads off the
/// session's broadcast channel; runs each through the inbound
/// dispatcher; sends the result (original, swapped bytes, or
/// nothing) to the WS sink; then drains the side-channel extras
/// (chunk frames to the WS, /b_getn bundles to UDP).
async fn forward_with_dispatch(
    mut receiver: broadcast::Receiver<Vec<u8>>,
    tx: Arc<TokioMutex<SplitSink<WebSocket, Message>>>,
    target: SocketAddr,
    scope_ctx: Arc<TokioMutex<ScopeContext>>,
    session: Arc<Session>,
    inbound_registry: Arc<MiddlewareRegistry<InboundMiddleware>>,
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
                    "session forwarder lagged; some replies dropped"
                );
            }
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}

/// Run inbound dispatch + WS send for a single broadcast payload.
/// Returns `Err(())` to signal the caller to break the loop (WS
/// sink closed). Returns `Ok(())` on either successful forward or
/// successful "middleware consumed it, nothing to send".
async fn forward_one_payload(
    payload: &[u8],
    tx: &Arc<TokioMutex<SplitSink<WebSocket, Message>>>,
    target: SocketAddr,
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
    session: &Arc<Session>,
    inbound_registry: &Arc<MiddlewareRegistry<InboundMiddleware>>,
) -> std::result::Result<(), ()> {
    let address = peek_osc_address(payload);

    // Avoid the lock acquisition entirely when the registry has
    // no matching middleware. Most addresses on most forwarders
    // (e.g. /done from scsynth, /dirt/listSamples.reply from
    // sclang) pass through without touching the scope context.
    let needs_dispatch = address
        .map(|a| inbound_registry.iter_matching(a).next().is_some())
        .unwrap_or(false);

    let (outcome, ws_extras, udp_extras) = if needs_dispatch {
        let mut scope = scope_ctx.lock().await;
        let mut ctx = WsCtx::new(
            session,
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

    // Flush WS-bound bytes from the outcome + ws_extras side
    // channel. Order matters: if a middleware on /b_setn returned
    // ConsumedAndSend(chunk), we send the chunk INSTEAD of the
    // /b_setn. If it returned PassThrough, we send the original.
    // ws_extras (chunks emitted on /clock/tick in SHM mode) go
    // out alongside.
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

    // Flush UDP-bound bytes (e.g. /b_getn bundles in OSC mode).
    flush_udp_extras(session, udp_extras).await;

    Ok(())
}

/// Send each (target, bytes) pair via the session's pre-bound
/// socket for that target. Errors are logged + the loop
/// continues (one bad send shouldn't tear down a forwarder).
async fn flush_udp_extras(
    session: &Arc<Session>,
    udp_extras: Vec<(SocketAddr, Vec<u8>)>,
) {
    for (target, bytes) in udp_extras {
        let Some(sock) = session.target_sockets.get(&target) else {
            tracing::warn!(
                ?target,
                session_id = %session.session_id,
                "no socket for udp_extras target on session; dropping"
            );
            continue;
        };
        if let Err(e) = sock.send(&bytes).await {
            tracing::warn!(
                error = %e,
                ?target,
                session_id = %session.session_id,
                "udp send error from middleware extras"
            );
        }
    }
}

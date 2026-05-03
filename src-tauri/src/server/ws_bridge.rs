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
//! Phase 31 post-shipping refactor: scope buffer chunk delivery
//! is OFF this WS — each scope subscription opens its own WS at
//! `/ws/scope` (see `super::ws_scope`). This file is back to
//! "OSC bytes both directions"; no binary multiplexing, no scope
//! subscription state.

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::{SplitSink, StreamExt};
use futures_util::SinkExt;
use tokio::sync::broadcast;
use tokio::sync::Mutex as TokioMutex;
use tokio::task::JoinHandle;

use super::routing::peek_osc_address;
use super::session::Session;

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

    // Subscribe to each target's broadcast channel and spawn a
    // forwarder task per channel. Each forwarder reads one
    // payload at a time and writes it to the WS sink.
    let mut forwarder_tasks: Vec<JoinHandle<()>> = Vec::new();
    for (target, sender) in session.broadcast_senders.iter() {
        let receiver = sender.subscribe();
        let target = *target;
        let tx_clone = tx.clone();
        let task = tokio::spawn(forward_broadcast(receiver, tx_clone, target));
        forwarder_tasks.push(task);
    }

    // WS → UDP loop. Per binary frame:
    //   1. Peek the OSC address (None ⇒ default route).
    //   2. session.routes.route_for(addr) → SocketAddr.
    //   3. Look up the matching pre-bound socket on the session.
    //   4. Send.
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Binary(bytes)) => {
                let target = match peek_osc_address(&bytes) {
                    Some(addr) => session.routes.route_for(addr),
                    None => session.scsynth_addr,
                };
                let Some(sock) = session.target_sockets.get(&target) else {
                    tracing::warn!(
                        ?target,
                        session_id = %session.session_id,
                        "no socket for routed target on session; dropping packet"
                    );
                    continue;
                };
                if let Err(e) = sock.send(&bytes).await {
                    tracing::warn!(
                        error = %e,
                        ?target,
                        session_id = %session.session_id,
                        "udp send error on session socket"
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

    // Abort forwarders so they don't keep the broadcast
    // subscriptions alive after the WS sink closes.
    for task in &forwarder_tasks {
        task.abort();
    }

    // No session cleanup here — sessions outlive WS by design.
    // DELETE /api/session/:id or the TTL job (29d) is what
    // triggers Session::cleanup.
    drop(tx);
    Ok(())
}

/// Per-target forwarder task body. Pulls payloads off the
/// session's broadcast channel and pushes each to the WS sink.
/// `Lagged` warns + continues; `Closed` (sender gone — Session
/// dropped) breaks cleanly.
async fn forward_broadcast(
    mut receiver: broadcast::Receiver<Vec<u8>>,
    tx: Arc<TokioMutex<SplitSink<WebSocket, Message>>>,
    target: SocketAddr,
) {
    loop {
        match receiver.recv().await {
            Ok(payload) => {
                let mut tx_guard = tx.lock().await;
                if let Err(e) = tx_guard.send(Message::Binary(payload.into())).await {
                    tracing::debug!(
                        error = %e,
                        ?target,
                        "ws send error from session forwarder (probably closed)"
                    );
                    break;
                }
            }
            Err(broadcast::error::RecvError::Lagged(skipped)) => {
                tracing::warn!(
                    skipped,
                    ?target,
                    "session forwarder lagged; some replies dropped"
                );
                // Continue — broadcast::Receiver auto-recovers.
            }
            Err(broadcast::error::RecvError::Closed) => {
                // Session dropped; the recv-broadcast task already
                // exited, no more bytes coming.
                break;
            }
        }
    }
}

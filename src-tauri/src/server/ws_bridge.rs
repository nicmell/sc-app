//! Phase 0 — per-session WebSocket ↔ UDP bridge.
//! Phase 22 — bridge-side cleanup on ungraceful WS close.
//! Phase 26 — multi-target routing via [`super::routing::RoutingTable`].
//!
//! Each WebSocket connection gets one ephemeral UDP socket *per
//! unique route target*. Binary frames from the client are
//! demultiplexed by OSC-address prefix and forwarded to the
//! matching socket; incoming UDP datagrams from any target are
//! relayed back to the WS as binary frames. Text, ping and pong
//! frames are ignored.
//!
//! scsynth (and any other target) replies to whichever socket the
//! command came from. Per-session sockets keep cross-session
//! traffic from contaminating each other, and let the bridge
//! address each target independently.
//!
//! The bridge stays minimally OSC-aware: it peeks the address to
//! pick a route (cheap; see [`super::routing::peek_osc_address`]),
//! and delegates `/done /notify` snoop / `/notify 0` outbound snoop
//! / WS-close cleanup to [`super::ws_cleanup::WsCleanup`]. Snoop logic
//! is scsynth-specific, so it runs only on the *default route's*
//! socket; non-default targets (SuperDirt, future analyzer / MIDI
//! bridge / etc.) are pure forwarders.
//!
//! The cleanup catches the cases the frontend can't (browser crash,
//! TCP RST, forced tab kill before `pagehide` flushes); the eager
//! frontend `handleDisconnect` / `pagehide` paths still run first
//! in normal use.
//!
//! ## WS-close cleanup ordering
//!
//! 1. Abort all `recv_tasks` *first*. Otherwise scsynth's `/fail`
//!    replies to our cleanup bundle (when one is sent) get picked
//!    up by the default route's recv task and forwarded to the
//!    closed WS, producing a "Sending after closing" warning per
//!    reply. Aborting first lets those datagrams hit a closed UDP
//!    socket and the kernel drops them silently.
//! 2. Run `session.cleanup()` against the *default route's* socket
//!    only — `/g_freeAll`, `/n_free`, `/notify 0` are scsynth
//!    concepts; non-default targets are stateless from the
//!    bridge's perspective and need no cleanup.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::StreamExt;
use futures_util::SinkExt;
use tokio::net::UdpSocket;
use tokio::sync::Mutex as TokioMutex;
use tokio::task::JoinHandle;

use super::routing::{peek_osc_address, RoutingTable};
use super::ws_cleanup::WsCleanup;

/// Bridge a single WebSocket session against a routing table.
/// Opens one UDP socket per unique target; outbound packets are
/// demuxed by OSC address; inbound replies from any target fan
/// back to the WS. Returns when either side closes or errors.
/// Fires the Phase 22 cleanup bundle to the default target on the
/// way out (unless the frontend already cleaned up).
pub async fn handle_ws(ws: WebSocket, routes: RoutingTable) -> Result<()> {
    let (tx, mut rx) = ws.split();

    let default = routes.default_target();
    let unique_targets = routes.unique_targets();

    // Bind one UDP socket per unique target.
    let mut sockets: HashMap<SocketAddr, Arc<UdpSocket>> = HashMap::new();
    for target in &unique_targets {
        let sock = UdpSocket::bind("0.0.0.0:0")
            .await
            .context("bind ephemeral UDP socket")?;
        sock.connect(*target)
            .await
            .with_context(|| format!("udp connect to {target}"))?;
        sockets.insert(*target, Arc::new(sock));
    }

    let session = Arc::new(WsCleanup::new());

    // Wrap the WS sender in a Mutex so multiple recv tasks can share
    // it. Lock contention is negligible at our throughput
    // (~9 KB/s per active scope, plus sparse SuperDirt traffic).
    let tx = Arc::new(TokioMutex::new(tx));

    // Spawn one recv task per UDP socket. The default route's task
    // also runs `WsCleanup::snoop` to capture `/done /notify`
    // replies; non-default tasks are pure forwarders.
    let mut recv_tasks: Vec<JoinHandle<()>> = Vec::new();
    for (target, sock) in &sockets {
        let is_default = *target == default;
        let target = *target;
        let sock = sock.clone();
        let tx = tx.clone();
        let session = session.clone();
        let task = tokio::spawn(async move {
            let mut buf = vec![0u8; 65_536];
            loop {
                match sock.recv(&mut buf).await {
                    Ok(n) => {
                        let payload = &buf[..n];
                        if is_default {
                            session.snoop(payload).await;
                        }
                        let mut tx_guard = tx.lock().await;
                        if let Err(e) = tx_guard
                            .send(Message::Binary(payload.to_vec().into()))
                            .await
                        {
                            tracing::warn!(error = %e, "ws send error");
                            break;
                        }
                    }
                    Err(e) => {
                        tracing::warn!(error = %e, ?target, "udp recv error");
                        break;
                    }
                }
            }
        });
        recv_tasks.push(task);
    }

    // WS → UDP loop. Per binary frame:
    //   1. Peek the OSC address (None ⇒ default route).
    //   2. routing.route_for(addr) → target.
    //   3. If target is default, run `snoop_outbound` (Phase 22).
    //   4. Send via that target's UDP socket.
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Binary(bytes)) => {
                let target = match peek_osc_address(&bytes) {
                    Some(addr) => routes.route_for(addr),
                    None => default,
                };
                if target == default {
                    session.snoop_outbound(&bytes).await;
                }
                let Some(sock) = sockets.get(&target) else {
                    // Should never happen — `unique_targets`
                    // covers every routable destination.
                    tracing::warn!(?target, "no socket for routed target; dropping packet");
                    continue;
                };
                if let Err(e) = sock.send(&bytes).await {
                    tracing::warn!(error = %e, ?target, "udp send error");
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

    // Abort all recv tasks BEFORE cleanup so scsynth's `/fail`
    // replies to the cleanup bundle don't get forwarded to the
    // closed WS. See module-level comment.
    for task in &recv_tasks {
        task.abort();
    }

    // Cleanup runs only against the default route — scsynth-
    // specific. Non-default targets have no bridge-managed state.
    if let Some(default_sock) = sockets.get(&default) {
        session.cleanup(default_sock).await;
    }

    drop(sockets); // make explicit that we're done with the bound ports
    drop(tx);      // close the WS sink Arc — last reference dropped here
    Ok(())
}

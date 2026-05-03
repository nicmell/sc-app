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
//! Phase 31c: each WS additionally hosts a small scope-subscription
//! state machine. The worker sends `subscribeShm` / `unsubscribeShm`
//! frames (1-byte op tag — see [`crate::scope_shm`] wire format);
//! the bridge tracks per-bufferId scope index + channel count, and
//! whenever a `/clock/tick` reply lands in the broadcast stream,
//! polls SHM for every active subscription and emits a `bufferChunk`
//! frame per subscription on the same WS.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::{SplitSink, StreamExt};
use futures_util::SinkExt;
use tokio::sync::broadcast;
use tokio::sync::Mutex as TokioMutex;
use tokio::sync::RwLock as TokioRwLock;
use tokio::task::JoinHandle;

use super::routing::peek_osc_address;
use super::session::Session;
use crate::scope_shm::{
    self, decode_subscribe, decode_unsubscribe, encode_chunk, MmapRegion,
    ScopeBufferLayout, ScopeReadResult, SCOPE_OP_SUBSCRIBE, SCOPE_OP_UNSUBSCRIBE,
};

/// Per-WS scope state. Subscriptions accumulate as `subscribeShm`
/// frames arrive; `forward_broadcast` reads this on every observed
/// `/clock/tick` to know which scope_buffers to poll.
#[derive(Default)]
struct ScopeContext {
    subscriptions: TokioRwLock<HashMap<String, ScopeSubscription>>,
    /// Lazy-initialized on first subscribe. mmap'd once, reused for
    /// every poll. Held in `Option` so we can fail open gracefully
    /// when SHM isn't available (e.g., remote scsynth).
    shm: TokioRwLock<Option<ScopeShm>>,
    /// scsynth UDP port — needed to compute the SHM file path.
    scsynth_port: u16,
}

#[derive(Debug, Clone)]
struct ScopeSubscription {
    scope_idx: u32,
    /// Channel count the worker told us at subscribe time. Stored
    /// for parity-checking against what the SHM read returns;
    /// the read itself reports the authoritative channel count
    /// from `scope_buffer._channels`.
    #[allow(dead_code)]
    channels: u32,
    /// chunkSize in frames (= ScopeOut2 `scopeFrames` per slot). Not
    /// strictly needed by the bridge today but stored for future
    /// gap-detection refinement.
    #[allow(dead_code)]
    chunk_size: u32,
    /// `_stage` value observed on the last successful poll. Compare
    /// to current `_stage` to detect "no new slot" (skip emission).
    last_seen_stage: i32,
}

struct ScopeShm {
    region: MmapRegion,
    layout: ScopeBufferLayout,
}

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

    // Phase 31c: per-WS scope-subscription context, shared with
    // every forwarder task so they can poll SHM on /clock/tick.
    let scope_ctx = Arc::new(ScopeContext {
        scsynth_port: session.scsynth_addr.port(),
        ..Default::default()
    });

    // Subscribe to each target's broadcast channel and spawn a
    // forwarder task per channel. Each forwarder reads one
    // payload at a time and writes it to the WS sink, plus polls
    // SHM on /clock/tick for any active scope subscriptions.
    let mut forwarder_tasks: Vec<JoinHandle<()>> = Vec::new();
    for (target, sender) in session.broadcast_senders.iter() {
        let receiver = sender.subscribe();
        let target = *target;
        let tx_clone = tx.clone();
        let scope_clone = scope_ctx.clone();
        let task = tokio::spawn(forward_broadcast(
            receiver, tx_clone, target, scope_clone,
        ));
        forwarder_tasks.push(task);
    }

    // WS → UDP loop. Per binary frame:
    //   - First byte op tags 0x01 / 0x02: scope subscribe /
    //     unsubscribe (Phase 31c). Decoded + applied locally;
    //     not forwarded to any UDP target.
    //   - Anything else: treat as OSC, peek address, route, send
    //     to the matching pre-bound socket on the session.
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Binary(bytes)) => {
                if let Some(&first) = bytes.first() {
                    match first {
                        SCOPE_OP_SUBSCRIBE => {
                            handle_scope_subscribe(&scope_ctx, &bytes).await;
                            continue;
                        }
                        SCOPE_OP_UNSUBSCRIBE => {
                            handle_scope_unsubscribe(&scope_ctx, &bytes).await;
                            continue;
                        }
                        _ => {} // fall through to OSC handling
                    }
                }
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

async fn handle_scope_subscribe(ctx: &ScopeContext, bytes: &[u8]) {
    let msg = match decode_subscribe(bytes) {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!(error = %e, "scope subscribe decode failed");
            return;
        }
    };
    // Lazily open the SHM segment on first subscribe.
    let mut shm_guard = ctx.shm.write().await;
    if shm_guard.is_none() {
        let path = scope_shm::shm_path(ctx.scsynth_port)
            .to_string_lossy()
            .into_owned();
        match MmapRegion::open(&path) {
            Ok(region) => match scope_shm::find_scope_buffer_array(&region) {
                Ok(layout) => {
                    tracing::info!(
                        scsynth_port = ctx.scsynth_port,
                        scope_count = layout.count,
                        "opened SHM segment for scope subscriptions"
                    );
                    *shm_guard = Some(ScopeShm { region, layout });
                }
                Err(e) => {
                    tracing::warn!(
                        error = %e,
                        scsynth_port = ctx.scsynth_port,
                        "scope_buffer layout scan failed; SHM subscriptions \
                         won't deliver chunks"
                    );
                }
            },
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    scsynth_port = ctx.scsynth_port,
                    path = %path,
                    "SHM mmap failed; scope subscriptions disabled for this WS"
                );
            }
        }
    }
    drop(shm_guard);

    let mut subs = ctx.subscriptions.write().await;
    subs.insert(
        msg.buffer_id.clone(),
        ScopeSubscription {
            scope_idx: msg.scope_idx,
            channels: msg.channels,
            chunk_size: msg.chunk_size,
            last_seen_stage: -1,
        },
    );
    tracing::debug!(
        buffer_id = %msg.buffer_id,
        scope_idx = msg.scope_idx,
        channels = msg.channels,
        chunk_size = msg.chunk_size,
        "scope subscribed"
    );
}

async fn handle_scope_unsubscribe(ctx: &ScopeContext, bytes: &[u8]) {
    let msg = match decode_unsubscribe(bytes) {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!(error = %e, "scope unsubscribe decode failed");
            return;
        }
    };
    let mut subs = ctx.subscriptions.write().await;
    if subs.remove(&msg.buffer_id).is_some() {
        tracing::debug!(buffer_id = %msg.buffer_id, "scope unsubscribed");
    }
}

/// Per-target forwarder task body. Pulls payloads off the
/// session's broadcast channel and pushes each to the WS sink.
/// `Lagged` warns + continues; `Closed` (sender gone — Session
/// dropped) breaks cleanly.
///
/// Phase 31c: also peeks each payload for `/clock/tick` (the
/// shared clock's `SendReply` address); when one fires, polls SHM
/// for every active scope subscription on this WS and emits a
/// `bufferChunk` frame per subscription on the same sink.
async fn forward_broadcast(
    mut receiver: broadcast::Receiver<Vec<u8>>,
    tx: Arc<TokioMutex<SplitSink<WebSocket, Message>>>,
    target: SocketAddr,
    scope_ctx: Arc<ScopeContext>,
) {
    loop {
        match receiver.recv().await {
            Ok(payload) => {
                // Forward the original reply first so /clock/tick
                // arrival latency on the worker stays minimal.
                {
                    let mut tx_guard = tx.lock().await;
                    if let Err(e) = tx_guard
                        .send(Message::Binary(payload.clone().into()))
                        .await
                    {
                        tracing::debug!(
                            error = %e,
                            ?target,
                            "ws send error from session forwarder (probably closed)"
                        );
                        break;
                    }
                }
                // Then, if this was a /clock/tick reply, poll
                // every active scope subscription and emit chunks.
                if peek_osc_address(&payload) == Some("/clock/tick") {
                    poll_scope_subs(&scope_ctx, &tx).await;
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

/// On every observed `/clock/tick`, walk active scope subscriptions
/// and push a `bufferChunk` frame for each whose `_stage` advanced
/// since last poll. Subscriptions where `_stage` is unchanged are
/// silently skipped (no new slot from the writer yet — common
/// transient).
async fn poll_scope_subs(
    scope_ctx: &ScopeContext,
    tx: &Arc<TokioMutex<SplitSink<WebSocket, Message>>>,
) {
    let shm_guard = scope_ctx.shm.read().await;
    let Some(shm) = shm_guard.as_ref() else {
        return; // SHM open failed earlier; nothing to do
    };

    // Snapshot subscriptions (clone keys + values) so we don't
    // hold the read lock across await points where we might want
    // to mutate `last_seen_stage`. Update in a separate write
    // pass after polling.
    let snapshot: Vec<(String, ScopeSubscription)> = {
        let subs = scope_ctx.subscriptions.read().await;
        subs.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    };
    if snapshot.is_empty() {
        return;
    }

    let mut frames_to_send: Vec<Vec<u8>> = Vec::new();
    let mut stage_updates: Vec<(String, i32)> = Vec::new();
    for (buffer_id, sub) in &snapshot {
        let result = scope_shm::read_scope_slot(
            &shm.region,
            &shm.layout,
            sub.scope_idx as usize,
        );
        let (data, channels, frames, stage) = match result {
            Ok(ScopeReadResult::Data {
                floats,
                channels,
                frames,
                stage,
            }) => (floats, channels, frames, stage),
            Ok(ScopeReadResult::NotInitialized | ScopeReadResult::NoData) => {
                continue;
            }
            Err(e) => {
                tracing::debug!(
                    buffer_id = %buffer_id,
                    error = %e,
                    "scope_shm read failed"
                );
                continue;
            }
        };
        if stage as i32 == sub.last_seen_stage {
            // Writer hasn't advanced since last poll — no new slot.
            continue;
        }
        // Bridge tick counter is informational for now (gap
        // detection lives at the worker via tick deltas).
        let tick_index = 0u32;
        let frame = encode_chunk(
            buffer_id,
            tick_index,
            false,
            channels.min(255) as u8,
            frames as u32,
            &data,
        );
        frames_to_send.push(frame);
        stage_updates.push((buffer_id.clone(), stage as i32));
    }

    drop(shm_guard);

    // Persist last_seen_stage updates.
    if !stage_updates.is_empty() {
        let mut subs = scope_ctx.subscriptions.write().await;
        for (id, stage) in stage_updates {
            if let Some(s) = subs.get_mut(&id) {
                s.last_seen_stage = stage;
            }
        }
    }

    // Send chunks to the WS.
    if !frames_to_send.is_empty() {
        let mut tx_guard = tx.lock().await;
        for frame in frames_to_send {
            if let Err(e) = tx_guard.send(Message::Binary(frame.into())).await {
                tracing::debug!(error = %e, "scope chunk ws send error");
                break;
            }
        }
    }
}

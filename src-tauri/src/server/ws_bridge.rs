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

use std::collections::HashMap;
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
use crate::scope_shm::{self, ScopeReadResult};

const SCOPE_OP_SUBSCRIBE: u8 = 0x01;
const SCOPE_OP_UNSUBSCRIBE: u8 = 0x02;
const SCOPE_OP_CHUNK: u8 = 0x03;

/// Per-WS scope subscription state. Keyed by the worker-minted
/// `sub_id` (`u32`). The bridge never interprets that id beyond
/// echoing it back on chunk frames; we use it as a HashMap key
/// because it's small and unique-per-WS.
#[derive(Debug)]
struct ScopeSubscription {
    sub_id: u32,
    scope_idx: u32,
    last_seen_stage: i32,
    /// Tick counter local to this subscription. Bumped on each
    /// emitted chunk; the worker uses it for diagnostics + as a
    /// monotonic ordering signal.
    tick_index: u32,
}

/// Per-WS scope context. Owned by `handle_ws_session`'s scope;
/// drops when the WS closes (and with it, every subscription —
/// see module docs for the cleanup invariant).
struct ScopeContext {
    /// Lazily populated on first 0x01 frame: the session-level
    /// SHM mmap. Multiple WSs on the same session share one
    /// mapping (lives on `Session::scope_shm`).
    shm: Option<Arc<crate::server::session::ScopeShm>>,
    /// Active subscriptions, keyed by `sub_id`.
    subs: HashMap<u32, ScopeSubscription>,
}

impl ScopeContext {
    fn new() -> Self {
        Self {
            shm: None,
            subs: HashMap::new(),
        }
    }
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

    // Phase 35: per-WS scope subscriptions. Wrapped in a Mutex so
    // the recv loop (handles 0x01/0x02 from main) and the
    // default-route forwarder (polls SHM on /clock/tick) can both
    // mutate it.
    let scope_ctx = Arc::new(TokioMutex::new(ScopeContext::new()));

    // Subscribe to each target's broadcast channel and spawn a
    // forwarder task per channel. The default-route forwarder
    // also peeks for /clock/tick and drives the SHM polling
    // loop for this WS's scope subscriptions.
    let mut forwarder_tasks: Vec<JoinHandle<()>> = Vec::new();
    for (target, sender) in session.broadcast_senders.iter() {
        let receiver = sender.subscribe();
        let target = *target;
        let tx_clone = tx.clone();
        let task = if target == session.scsynth_addr {
            // Default-route forwarder also drives scope polling.
            let scope_ctx_clone = scope_ctx.clone();
            let session_clone = session.clone();
            tokio::spawn(forward_default_route(
                receiver,
                tx_clone,
                target,
                scope_ctx_clone,
                session_clone,
            ))
        } else {
            tokio::spawn(forward_broadcast(receiver, tx_clone, target))
        };
        forwarder_tasks.push(task);
    }

    // WS → UDP loop. Per binary frame:
    //   1. Peek the first byte. 0x01/0x02 → scope subprotocol
    //      (see `handle_scope_*`).
    //   2. Otherwise → OSC: peek the address, route via
    //      session.routes, send on the matching socket.
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Binary(bytes)) => {
                let bytes_slice = bytes.as_ref();
                if bytes_slice.is_empty() {
                    continue;
                }
                match bytes_slice[0] {
                    SCOPE_OP_SUBSCRIBE => {
                        if let Err(e) = handle_scope_subscribe(
                            bytes_slice,
                            &scope_ctx,
                            &session,
                        )
                        .await
                        {
                            tracing::warn!(
                                error = %e,
                                session_id = %session.session_id,
                                "scope subscribe failed"
                            );
                        }
                    }
                    SCOPE_OP_UNSUBSCRIBE => {
                        if let Err(e) =
                            handle_scope_unsubscribe(bytes_slice, &scope_ctx).await
                        {
                            tracing::warn!(
                                error = %e,
                                session_id = %session.session_id,
                                "scope unsubscribe failed"
                            );
                        }
                    }
                    _ => {
                        // OSC byte → existing forward path.
                        let target = match peek_osc_address(bytes_slice) {
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
                        if let Err(e) = sock.send(bytes_slice).await {
                            tracing::warn!(
                                error = %e,
                                ?target,
                                session_id = %session.session_id,
                                "udp send error on session socket"
                            );
                            break;
                        }
                    }
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

    // Phase 35 cleanup point: ScopeContext drops here, taking
    // every subscription with it. Log the count so the cleanup
    // is visible in traces. (The session-level `scope_shm` mmap
    // outlives this WS — only the per-WS subscription state goes.)
    let dropped_count = {
        let ctx = scope_ctx.lock().await;
        ctx.subs.len()
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

async fn handle_scope_subscribe(
    bytes: &[u8],
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
    session: &Arc<Session>,
) -> Result<()> {
    // Frame: [op:u8 | sub_id:u32 | scope:u32 | channels:u32 | chunk:u32]
    if bytes.len() < 17 {
        anyhow::bail!("subscribe frame too short ({} < 17)", bytes.len());
    }
    let sub_id = u32::from_le_bytes(bytes[1..5].try_into().unwrap());
    let scope_idx = u32::from_le_bytes(bytes[5..9].try_into().unwrap());
    // channels + chunk are not used by the bridge — the layout
    // already knows them. Decoded here for log clarity / future
    // sanity checks.
    let channels = u32::from_le_bytes(bytes[9..13].try_into().unwrap());
    let chunk_size = u32::from_le_bytes(bytes[13..17].try_into().unwrap());

    let mut ctx = scope_ctx.lock().await;

    // Lazily ensure the session-level SHM mmap on first subscribe.
    if ctx.shm.is_none() {
        let shm = session
            .ensure_scope_shm()
            .await
            .map_err(|e| anyhow::anyhow!("ensure_scope_shm failed: {e}"))?;
        ctx.shm = Some(shm);
    }
    let shm = ctx.shm.as_ref().expect("shm just set above");

    if (scope_idx as usize) >= shm.layout.count {
        anyhow::bail!(
            "scope index {} out of range (layout count {})",
            scope_idx,
            shm.layout.count
        );
    }

    if let Some(prev) = ctx.subs.insert(
        sub_id,
        ScopeSubscription {
            sub_id,
            scope_idx,
            last_seen_stage: -1,
            tick_index: 0,
        },
    ) {
        tracing::warn!(
            session_id = %session.session_id,
            sub_id,
            prev_scope_idx = prev.scope_idx,
            new_scope_idx = scope_idx,
            "scope subscribe replaced existing subscription with same sub_id"
        );
    }

    tracing::debug!(
        session_id = %session.session_id,
        sub_id,
        scope_idx,
        channels,
        chunk_size,
        "scope subscription installed"
    );
    Ok(())
}

async fn handle_scope_unsubscribe(
    bytes: &[u8],
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
) -> Result<()> {
    // Frame: [op:u8 | sub_id:u32]
    if bytes.len() < 5 {
        anyhow::bail!("unsubscribe frame too short ({} < 5)", bytes.len());
    }
    let sub_id = u32::from_le_bytes(bytes[1..5].try_into().unwrap());
    let mut ctx = scope_ctx.lock().await;
    if ctx.subs.remove(&sub_id).is_none() {
        // Worker either never subscribed this id or already
        // unsubscribed. Idempotent; not worth more than a debug.
        tracing::debug!(sub_id, "scope unsubscribe for unknown sub_id");
    }
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

/// Default-route forwarder (Phase 35). Same as `forward_broadcast`
/// but additionally peeks each payload for `/clock/tick`; on hit,
/// polls SHM for every active scope subscription on this WS and
/// emits 0x03 chunk frames for those whose `_stage` advanced.
async fn forward_default_route(
    mut receiver: broadcast::Receiver<Vec<u8>>,
    tx: Arc<TokioMutex<SplitSink<WebSocket, Message>>>,
    target: SocketAddr,
    scope_ctx: Arc<TokioMutex<ScopeContext>>,
    session: Arc<Session>,
) {
    loop {
        match receiver.recv().await {
            Ok(payload) => {
                let is_tick = peek_osc_address(&payload) == Some("/clock/tick");
                // Send the OSC reply to the WS first; the scope poll
                // is independent.
                {
                    let mut tx_guard = tx.lock().await;
                    if let Err(e) = tx_guard
                        .send(Message::Binary(payload.into()))
                        .await
                    {
                        tracing::debug!(
                            error = %e,
                            ?target,
                            "ws send error from default-route forwarder (probably closed)"
                        );
                        break;
                    }
                }
                if !is_tick {
                    continue;
                }
                // /clock/tick observed — poll SHM for every active
                // subscription. The lock is held across the entire
                // poll loop; subscribe/unsubscribe will queue
                // briefly, which is fine (this poll is at most ~47 Hz
                // and the per-sub work is O(1)).
                let chunk_frames = poll_scope_chunks(&scope_ctx, &session).await;
                if !chunk_frames.is_empty() {
                    let mut tx_guard = tx.lock().await;
                    for frame in chunk_frames {
                        if let Err(e) =
                            tx_guard.send(Message::Binary(frame.into())).await
                        {
                            tracing::debug!(
                                error = %e,
                                "ws send error sending scope chunk (probably closed)"
                            );
                            return;
                        }
                    }
                }
            }
            Err(broadcast::error::RecvError::Lagged(skipped)) => {
                tracing::warn!(
                    skipped,
                    ?target,
                    "session default-route forwarder lagged; some replies dropped"
                );
            }
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}

/// Walk the per-WS subscription map; for each sub whose
/// scope_buffer `_stage` has advanced since last poll, encode a
/// 0x03 chunk frame. Returns the encoded frames.
async fn poll_scope_chunks(
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
    session: &Arc<Session>,
) -> Vec<Vec<u8>> {
    let mut out = Vec::new();
    let mut ctx = scope_ctx.lock().await;
    let Some(shm) = ctx.shm.clone() else {
        return out; // No subscribes yet on this WS.
    };
    for sub in ctx.subs.values_mut() {
        match scope_shm::read_scope_slot(&shm.region, &shm.layout, sub.scope_idx as usize) {
            Ok(ScopeReadResult::Data {
                floats,
                channels,
                frames,
                stage,
            }) => {
                if stage as i32 == sub.last_seen_stage {
                    continue; // writer hasn't advanced
                }
                sub.last_seen_stage = stage as i32;
                sub.tick_index = sub.tick_index.wrapping_add(1);
                out.push(encode_chunk(
                    sub.sub_id,
                    sub.tick_index,
                    false,
                    channels.min(255) as u8,
                    frames as u32,
                    &floats,
                ));
            }
            Ok(_) => {} // Not yet initialized, etc.
            Err(e) => {
                tracing::debug!(
                    sub_id = sub.sub_id,
                    scope_idx = sub.scope_idx,
                    error = %e,
                    session_id = %session.session_id,
                    "scope slot read failed"
                );
            }
        }
    }
    out
}

/// Encode one 0x03 chunk frame. See module docs for layout.
fn encode_chunk(
    sub_id: u32,
    tick_index: u32,
    is_gap: bool,
    channels: u8,
    frame_count: u32,
    interleaved_floats: &[f32],
) -> Vec<u8> {
    // Header: op + sub_id + tick + is_gap + channels + frames
    //         1     4       4      1        1          4    = 15 bytes
    let mut out = Vec::with_capacity(15 + interleaved_floats.len() * 4);
    out.push(SCOPE_OP_CHUNK);
    out.extend_from_slice(&sub_id.to_le_bytes());
    out.extend_from_slice(&tick_index.to_le_bytes());
    out.push(if is_gap { 1 } else { 0 });
    out.push(channels);
    out.extend_from_slice(&frame_count.to_le_bytes());
    for &f in interleaved_floats {
        out.extend_from_slice(&f.to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Wire-format round-trip: encode a chunk, manually decode the
    /// header bytes (mirrors the worker-side `decodeChunk` in
    /// `src/workers/scopeWire.ts`). Catches accidental layout
    /// changes between bridge and worker.
    #[test]
    fn chunk_frame_layout() {
        let payload = [0.5_f32, -0.25_f32, 1.0_f32, -1.0_f32];
        let frame = encode_chunk(7, 42, false, 2, 2, &payload);

        // Header check.
        assert_eq!(frame[0], SCOPE_OP_CHUNK);
        assert_eq!(u32::from_le_bytes(frame[1..5].try_into().unwrap()), 7);
        assert_eq!(u32::from_le_bytes(frame[5..9].try_into().unwrap()), 42);
        assert_eq!(frame[9], 0); // is_gap
        assert_eq!(frame[10], 2); // channels
        assert_eq!(u32::from_le_bytes(frame[11..15].try_into().unwrap()), 2); // frames
        // Payload check.
        for (i, &f) in payload.iter().enumerate() {
            let off = 15 + i * 4;
            assert_eq!(
                f32::from_le_bytes(frame[off..off + 4].try_into().unwrap()),
                f
            );
        }
        // Total length.
        assert_eq!(frame.len(), 15 + payload.len() * 4);
    }

    #[test]
    fn chunk_frame_is_gap_flag() {
        let frame = encode_chunk(0, 0, true, 1, 0, &[]);
        assert_eq!(frame[9], 1);
    }

    #[test]
    fn first_byte_dispatch_unambiguous_with_osc() {
        // OSC always starts with `/` (0x2F) for messages or `#`
        // (0x23) for bundles. 0x01..0x03 must not collide.
        for op in [SCOPE_OP_SUBSCRIBE, SCOPE_OP_UNSUBSCRIBE, SCOPE_OP_CHUNK] {
            assert_ne!(op, b'/');
            assert_ne!(op, b'#');
        }
    }
}

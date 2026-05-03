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
use super::session::{ScopeMode, Session};
use crate::scope_osc::{self, OscPollState, OscScopeSubscription};
use crate::scope_shm::{self, ScopeReadResult};

const SCOPE_OP_SUBSCRIBE: u8 = 0x01;
const SCOPE_OP_UNSUBSCRIBE: u8 = 0x02;
const SCOPE_OP_CHUNK: u8 = 0x03;

/// Per-WS scope subscription state. Keyed by the worker-minted
/// `sub_id` (`u32`). The bridge never interprets that id beyond
/// echoing it back on chunk frames; we use it as a HashMap key
/// because it's small and unique-per-WS.
#[derive(Debug)]
struct ShmScopeSubscription {
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
///
/// Phase 36: dual-mode. The session's `ScopeMode` decides which
/// branch is populated. Both arms are always allocated (zero-cost
/// when unused — `HashMap::new()` doesn't allocate); only the
/// active path's storage gets entries. A handoff between modes
/// mid-session is unsupported (Session::scope_mode is frozen at
/// create).
struct ScopeContext {
    /// SHM mode: lazily-populated session-level mmap. Multiple
    /// WSs on the same session share one mapping (lives on
    /// `Session::scope_shm`).
    shm: Option<Arc<crate::server::session::ScopeShm>>,
    /// SHM mode: active subscriptions, keyed by `sub_id`.
    shm_subs: HashMap<u32, ShmScopeSubscription>,
    /// OSC fallback mode: active subscriptions + ring-half
    /// tracking. Empty in SHM mode.
    osc: OscPollState,
}

impl ScopeContext {
    fn new() -> Self {
        Self {
            shm: None,
            shm_subs: HashMap::new(),
            osc: OscPollState::default(),
        }
    }

    /// Total subscription count across both modes — used for the
    /// WS-close cleanup log line.
    fn total_subs(&self) -> usize {
        self.shm_subs.len() + self.osc.subs.len()
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
                        if let Err(e) = handle_scope_unsubscribe(
                            bytes_slice,
                            &scope_ctx,
                            &session,
                        )
                        .await
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

async fn handle_scope_subscribe(
    bytes: &[u8],
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
    session: &Arc<Session>,
) -> Result<()> {
    // Frame: [op:u8 | sub_id:u32 | scope:u32 | channels:u32 | chunk:u32]
    // The `scope` field is interpreted as scope_idx in SHM mode
    // and as bufnum in OSC mode (frontend picks accordingly).
    if bytes.len() < 17 {
        anyhow::bail!("subscribe frame too short ({} < 17)", bytes.len());
    }
    let sub_id = u32::from_le_bytes(bytes[1..5].try_into().unwrap());
    let scope_or_bufnum = u32::from_le_bytes(bytes[5..9].try_into().unwrap());
    let channels = u32::from_le_bytes(bytes[9..13].try_into().unwrap());
    let chunk_size = u32::from_le_bytes(bytes[13..17].try_into().unwrap());

    match session.scope_mode {
        ScopeMode::Shm => {
            let mut ctx = scope_ctx.lock().await;
            if ctx.shm.is_none() {
                let shm = session
                    .ensure_scope_shm()
                    .await
                    .map_err(|e| anyhow::anyhow!("ensure_scope_shm failed: {e}"))?;
                ctx.shm = Some(shm);
            }
            let shm = ctx.shm.as_ref().expect("shm just set above");
            if (scope_or_bufnum as usize) >= shm.layout.count {
                anyhow::bail!(
                    "scope index {} out of range (layout count {})",
                    scope_or_bufnum,
                    shm.layout.count
                );
            }
            if let Some(prev) = ctx.shm_subs.insert(
                sub_id,
                ShmScopeSubscription {
                    sub_id,
                    scope_idx: scope_or_bufnum,
                    last_seen_stage: -1,
                    tick_index: 0,
                },
            ) {
                tracing::warn!(
                    session_id = %session.session_id,
                    sub_id,
                    prev_scope_idx = prev.scope_idx,
                    new_scope_idx = scope_or_bufnum,
                    "scope subscribe replaced existing SHM subscription with same sub_id"
                );
            }
            tracing::debug!(
                session_id = %session.session_id,
                sub_id,
                scope_idx = scope_or_bufnum,
                channels,
                chunk_size,
                "shm scope subscription installed"
            );
        }
        ScopeMode::Osc => {
            let mut ctx = scope_ctx.lock().await;
            if let Some(prev) = ctx.osc.subs.insert(
                sub_id,
                OscScopeSubscription::new(
                    sub_id,
                    scope_or_bufnum,
                    channels,
                    chunk_size,
                ),
            ) {
                tracing::warn!(
                    session_id = %session.session_id,
                    sub_id,
                    prev_bufnum = prev.bufnum,
                    new_bufnum = scope_or_bufnum,
                    "scope subscribe replaced existing OSC subscription with same sub_id"
                );
            }
            tracing::debug!(
                session_id = %session.session_id,
                sub_id,
                bufnum = scope_or_bufnum,
                channels,
                chunk_size,
                "osc scope subscription installed"
            );
        }
    }
    Ok(())
}

async fn handle_scope_unsubscribe(
    bytes: &[u8],
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
    session: &Arc<Session>,
) -> Result<()> {
    if bytes.len() < 5 {
        anyhow::bail!("unsubscribe frame too short ({} < 5)", bytes.len());
    }
    let sub_id = u32::from_le_bytes(bytes[1..5].try_into().unwrap());
    let mut ctx = scope_ctx.lock().await;
    let removed = match session.scope_mode {
        ScopeMode::Shm => ctx.shm_subs.remove(&sub_id).is_some(),
        ScopeMode::Osc => ctx.osc.subs.remove(&sub_id).is_some(),
    };
    if !removed {
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

/// Default-route forwarder. Mode-aware (Phase 36):
///
/// - **SHM mode**: peek `/clock/tick`; on hit, poll SHM for every
///   subscription on this WS and emit 0x03 frames for those whose
///   `_stage` advanced. Other payloads forward as plain OSC.
/// - **OSC mode**: peek `/b_setn` first — if its bufnum matches
///   one of our active subscriptions, intercept (encode 0x03
///   frame, don't forward to WS). Other payloads forward as
///   plain OSC. Peek `/clock/tick`; on hit, issue `/b_getn` for
///   each subscription whose previous read has settled (one
///   outstanding read per sub).
///
/// Both modes forward the original OSC payload to the WS unless
/// it's a chunk we intercepted.
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
                let address = peek_osc_address(&payload);
                let is_tick = address == Some("/clock/tick");

                // Phase 36: in OSC mode, /b_setn replies for our
                // own /b_getn requests get intercepted as chunk
                // frames; everything else (including /b_setn for
                // bufnums we don't own) forwards normally.
                let mut intercepted_chunks: Vec<Vec<u8>> = Vec::new();
                let mut forward_payload = true;
                if session.scope_mode == ScopeMode::Osc
                    && address == Some("/b_setn")
                {
                    match try_intercept_bsetn(&payload, &scope_ctx).await {
                        Some(frame) => {
                            intercepted_chunks.push(frame);
                            forward_payload = false;
                        }
                        None => {
                            // /b_setn for some bufnum we don't own
                            // (or a parse failure). Let it through.
                        }
                    }
                }

                if forward_payload {
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

                // /clock/tick drives the scope poll regardless of
                // mode — but the actual work is mode-dependent.
                if is_tick {
                    let mut chunk_frames = match session.scope_mode {
                        ScopeMode::Shm => {
                            poll_scope_chunks(&scope_ctx, &session).await
                        }
                        ScopeMode::Osc => {
                            // OSC mode: parse the tick index from
                            // the broadcast payload, issue
                            // /b_getn for each subscription whose
                            // previous read has settled. Chunks
                            // arrive later as /b_setn replies and
                            // are intercepted above.
                            issue_bgetn_for_subs(
                                &scope_ctx, &session,
                            )
                            .await;
                            // OSC mode also gets to emit any
                            // pending gap-marker chunks
                            // accumulated since last tick (e.g.
                            // for subs whose previous read timed
                            // out). For now return empty — gap
                            // emission is a follow-up.
                            Vec::new()
                        }
                    };
                    chunk_frames.append(&mut intercepted_chunks);
                    if !chunk_frames.is_empty() {
                        let mut tx_guard = tx.lock().await;
                        for frame in chunk_frames {
                            if let Err(e) = tx_guard
                                .send(Message::Binary(frame.into()))
                                .await
                            {
                                tracing::debug!(
                                    error = %e,
                                    "ws send error sending scope chunk (probably closed)"
                                );
                                return;
                            }
                        }
                    }
                } else if !intercepted_chunks.is_empty() {
                    // Non-tick payload but we intercepted a /b_setn
                    // chunk — flush it to the WS.
                    let mut tx_guard = tx.lock().await;
                    for frame in intercepted_chunks {
                        if let Err(e) = tx_guard
                            .send(Message::Binary(frame.into()))
                            .await
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

/// OSC mode: try to intercept a `/b_setn` broadcast payload. If
/// its bufnum matches one of this WS's active subscriptions,
/// returns an encoded 0x03 chunk frame; the caller suppresses
/// forwarding the original payload to the WS. If no subscription
/// matches (different bufnum, or parse failure), returns `None`
/// and the caller forwards the payload as a normal OSC reply.
async fn try_intercept_bsetn(
    payload: &[u8],
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
) -> Option<Vec<u8>> {
    let parsed = scope_osc::parse_bsetn(payload)?;
    let mut ctx = scope_ctx.lock().await;
    let sub = ctx.osc.find_by_bufnum_mut(parsed.bufnum)?;
    // Only emit if the offset matches the outstanding read.
    // Stale replies (we issued a new /b_getn meanwhile) get
    // discarded — they'd produce a half we already moved past.
    let pending = sub.pending_offset?;
    if pending != parsed.offset as u32 {
        return None;
    }
    let floats = scope_osc::decode_bsetn_floats(parsed.raw_floats)?;
    let frame_count = sub.chunk_size;
    let channels = sub.channels.min(255) as u8;
    let is_gap = sub.last_was_gap;
    sub.pending_offset = None;
    sub.last_was_gap = false;
    sub.tick_index = sub.tick_index.wrapping_add(1);
    Some(scope_osc::encode_chunk(
        sub.sub_id,
        sub.tick_index,
        is_gap,
        channels,
        frame_count,
        &floats,
    ))
}

/// OSC mode: on each `/clock/tick`, issue a fresh `/b_getn` for
/// every subscription whose previous read has settled. Subs with
/// a still-pending read get a gap marker (their next emitted
/// chunk will set `is_gap: true`); we drop the in-flight read so
/// the next tick's read can proceed.
async fn issue_bgetn_for_subs(
    scope_ctx: &Arc<TokioMutex<ScopeContext>>,
    session: &Arc<Session>,
) {
    // Collect the work under the lock, then issue UDP sends after
    // releasing it (so a slow /b_getn doesn't block the recv loop
    // serializing on this Mutex).
    let mut to_send: Vec<Vec<u8>> = Vec::new();
    {
        let mut ctx = scope_ctx.lock().await;
        // We don't have a server tick index in the per-WS state
        // yet — bump a per-sub counter and use it as the tick
        // proxy for `compute_read_window`. Each subscription
        // tracks its own progression independently of the server
        // tick (acceptable for this fallback path; the worker
        // doesn't rely on tick alignment across subscriptions).
        for sub in ctx.osc.subs.values_mut() {
            if sub.pending_offset.is_some() {
                // Previous read still in flight; mark a gap and
                // start fresh this tick.
                sub.last_was_gap = true;
                sub.pending_offset = None;
            }
            // tick_index here is the chunk-counter; we use it as
            // a stand-in for "ticks since this subscription
            // started" to drive ring-half parity. The first call
            // returns 0 → compute_read_window returns None (skip).
            // Real-world this means the first OSC chunk per
            // subscription is dropped — acceptable; the worker
            // synthesises the leading zero as silence in any
            // recording.
            let server_tick_proxy = (sub.tick_index as i64) + 2;
            let Some((offset, count)) =
                scope_osc::compute_read_window(sub, server_tick_proxy)
            else {
                continue;
            };
            sub.pending_offset = Some(offset);
            to_send.push(scope_osc::encode_bgetn_bundle(
                sub.bufnum, offset, count,
            ));
        }
    }
    // Fire all the bundles. Order doesn't matter — they're
    // independent.
    for bundle in to_send {
        if let Err(e) = session.scsynth_socket.send(&bundle).await {
            tracing::warn!(
                error = %e,
                session_id = %session.session_id,
                "udp send error issuing /b_getn for OSC fallback"
            );
            break;
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
    for sub in ctx.shm_subs.values_mut() {
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

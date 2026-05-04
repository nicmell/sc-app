//! Scope-related middleware bodies (Phase 37c).
//!
//! Pre-37 the scope dispatch logic lived inline in
//! `server/ws_bridge.rs`. Phase 37c relocates the bodies here:
//!
//! - [`ScopeContext`] — the per-WS subscription state (SHM
//!   subscriptions + OSC poll state).
//! - [`ws_scope_subscribe`] / [`ws_scope_unsubscribe`] — called
//!   directly by `ws_bridge.rs`'s recv loop on 0x01 / 0x02 binary
//!   frames. Phase 38 will route OSC-format `/scope/subscribe` /
//!   `/scope/unsubscribe` through these same functions via the
//!   outbound middleware registry.
//! - Inbound middlewares: [`inbound_chunk_emit_on_tick`] (SHM mode),
//!   [`inbound_bgetn_issue_on_tick`] (OSC mode),
//!   [`inbound_intercept_bsetn`] (OSC mode). Registered via
//!   [`register_inbound_middlewares`] at WS attach.
//! - [`encode_chunk`] — the 0x03 binary chunk frame producer.
//!   Phase 38 replaces this with an OSC `/scope/chunk` message.

use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;

use crate::scope::osc::{self as scope_osc, OscPollState, OscScopeSubscription};
use crate::scope::shm::{self as scope_shm, ScopeReadResult};
use crate::scope::ScopeMode;
use crate::server::middleware::{
    InboundMiddleware, MiddlewareOutcome, MiddlewareRegistry, WsCtx,
};
use crate::server::session::{ScopeShm, Session};

/// Binary scope wire-format op codes (Phase 35). Phase 38 will
/// retire these in favor of OSC `/scope/{subscribe,unsubscribe,
/// chunk}` messages.
pub const SCOPE_OP_SUBSCRIBE: u8 = 0x01;
pub const SCOPE_OP_UNSUBSCRIBE: u8 = 0x02;
pub const SCOPE_OP_CHUNK: u8 = 0x03;

/// Per-WS scope subscription record (SHM mode). Keyed by the
/// worker-minted `sub_id`. Bridge never interprets `sub_id`
/// beyond echoing it back on chunk frames.
#[derive(Debug)]
pub struct ShmScopeSubscription {
    pub sub_id: u32,
    pub scope_idx: u32,
    pub last_seen_stage: i32,
    /// Tick counter local to this subscription. Bumped on each
    /// emitted chunk; the worker uses it for diagnostics + as a
    /// monotonic ordering signal.
    pub tick_index: u32,
}

/// Per-WS scope context. Owned by the `ws_bridge` session handler;
/// drops on WS close (taking every subscription with it).
///
/// Phase 36: dual-mode. The session's `ScopeMode` decides which
/// branch is populated. Both arms are always allocated (zero-cost
/// when unused — `HashMap::new()` doesn't allocate); only the
/// active path's storage gets entries. A handoff between modes
/// mid-session is unsupported (Session::scope_mode is frozen at
/// create).
pub struct ScopeContext {
    /// SHM mode: lazily-populated session-level mmap. Multiple
    /// WSs on the same session share one mapping (lives on
    /// `Session::scope_shm`).
    pub shm: Option<Arc<ScopeShm>>,
    /// SHM mode: active subscriptions, keyed by `sub_id`.
    pub shm_subs: HashMap<u32, ShmScopeSubscription>,
    /// OSC fallback mode: active subscriptions + ring-half
    /// tracking. Empty in SHM mode.
    pub osc: OscPollState,
}

impl ScopeContext {
    pub fn new() -> Self {
        Self {
            shm: None,
            shm_subs: HashMap::new(),
            osc: OscPollState::default(),
        }
    }

    /// Total subscription count across both modes. Used for the
    /// WS-close cleanup log line.
    pub fn total_subs(&self) -> usize {
        self.shm_subs.len() + self.osc.subs.len()
    }
}

impl Default for ScopeContext {
    fn default() -> Self {
        Self::new()
    }
}

// ===== Subscribe / unsubscribe (called from ws_bridge's recv loop) =====

/// Decode a 0x01 binary subscribe frame and install the
/// subscription on the per-WS [`ScopeContext`]. Phase 37c: the
/// frame layout still mirrors Phase 35's binary wire format
/// `[op | sub_id:u32 | scope:u32 | channels:u32 | chunk:u32]`.
/// Phase 38 will retire the binary format; the parsed parameters
/// will arrive from an OSC message instead, but the body of this
/// function (state mutation on `ScopeContext`) stays the same.
pub async fn ws_scope_subscribe_binary(
    bytes: &[u8],
    scope_ctx: &tokio::sync::Mutex<ScopeContext>,
    session: &Arc<Session>,
) -> Result<()> {
    if bytes.len() < 17 {
        anyhow::bail!("subscribe frame too short ({} < 17)", bytes.len());
    }
    let sub_id = u32::from_le_bytes(bytes[1..5].try_into().unwrap());
    let scope_or_bufnum = u32::from_le_bytes(bytes[5..9].try_into().unwrap());
    let channels = u32::from_le_bytes(bytes[9..13].try_into().unwrap());
    let chunk_size = u32::from_le_bytes(bytes[13..17].try_into().unwrap());
    install_subscription(scope_ctx, session, sub_id, scope_or_bufnum, channels, chunk_size).await
}

/// Decode a 0x02 binary unsubscribe frame and remove the entry
/// from [`ScopeContext`]. Same Phase 37c → 38 migration shape as
/// [`ws_scope_subscribe_binary`].
pub async fn ws_scope_unsubscribe_binary(
    bytes: &[u8],
    scope_ctx: &tokio::sync::Mutex<ScopeContext>,
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

async fn install_subscription(
    scope_ctx: &tokio::sync::Mutex<ScopeContext>,
    session: &Arc<Session>,
    sub_id: u32,
    scope_or_bufnum: u32,
    channels: u32,
    chunk_size: u32,
) -> Result<()> {
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
                OscScopeSubscription::new(sub_id, scope_or_bufnum, channels, chunk_size),
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

// ===== Inbound middleware bodies =====

/// SHM mode: on each `/clock/tick`, poll SHM for every active
/// subscription on this WS and emit a 0x03 chunk frame for those
/// whose `_stage` advanced. Returns `PassThrough` so the tick
/// itself still reaches the worker (the watchdog needs it). Chunks
/// are pushed onto `ctx.ws_extras` for the dispatcher to flush.
fn inbound_chunk_emit_on_tick(ctx: &mut WsCtx<'_>) -> MiddlewareOutcome {
    let scope = &mut *ctx.scope;
    let Some(shm) = scope.shm.clone() else {
        return MiddlewareOutcome::PassThrough; // no subs yet on this WS
    };
    for sub in scope.shm_subs.values_mut() {
        match scope_shm::read_scope_slot(&shm.region, &shm.layout, sub.scope_idx as usize) {
            Ok(ScopeReadResult::Data {
                floats,
                channels,
                frames,
                stage,
            }) => {
                if stage as i32 == sub.last_seen_stage {
                    continue;
                }
                sub.last_seen_stage = stage as i32;
                sub.tick_index = sub.tick_index.wrapping_add(1);
                ctx.ws_extras.push(encode_chunk(
                    sub.sub_id,
                    sub.tick_index,
                    false,
                    channels.min(255) as u8,
                    frames as u32,
                    &floats,
                ));
            }
            Ok(_) => {} // not initialized yet
            Err(e) => {
                tracing::debug!(
                    sub_id = sub.sub_id,
                    scope_idx = sub.scope_idx,
                    error = %e,
                    session_id = %ctx.session.session_id,
                    "scope slot read failed"
                );
            }
        }
    }
    MiddlewareOutcome::PassThrough
}

/// OSC mode: on each `/clock/tick`, issue a fresh `/b_getn` for
/// every subscription whose previous read has settled. Subs with
/// a still-pending read get a gap marker on their next emitted
/// chunk; we drop the in-flight read so the next tick's read can
/// proceed. The bundles are pushed onto `ctx.udp_extras` for the
/// dispatcher to flush via the session's scsynth socket.
fn inbound_bgetn_issue_on_tick(ctx: &mut WsCtx<'_>) -> MiddlewareOutcome {
    let scope = &mut *ctx.scope;
    let scsynth_addr = ctx.session.scsynth_addr;
    for sub in scope.osc.subs.values_mut() {
        if sub.pending_offset.is_some() {
            // Previous read still in flight; mark a gap and start
            // fresh this tick.
            sub.last_was_gap = true;
            sub.pending_offset = None;
        }
        // tick_index here is the chunk-counter; we use it as a
        // stand-in for "ticks since this subscription started" to
        // drive ring-half parity. The first call returns 0 →
        // compute_read_window returns None (skip). Real-world this
        // means the first OSC chunk per subscription is dropped —
        // acceptable; the worker synthesises the leading zero as
        // silence in any recording.
        let server_tick_proxy = (sub.tick_index as i64) + 2;
        let Some((offset, count)) =
            scope_osc::compute_read_window(sub, server_tick_proxy)
        else {
            continue;
        };
        sub.pending_offset = Some(offset);
        ctx.udp_extras.push((
            scsynth_addr,
            scope_osc::encode_bgetn_bundle(sub.bufnum, offset, count),
        ));
    }
    MiddlewareOutcome::PassThrough
}

/// OSC mode: try to intercept a `/b_setn` broadcast payload. If
/// its bufnum matches one of this WS's active subscriptions,
/// returns `ConsumedAndSend(chunk_bytes)` — the bridge swaps the
/// reply for the encoded chunk frame. If no subscription matches
/// (different bufnum, or parse failure), returns `PassThrough`
/// and the original `/b_setn` flows to the WS as a normal OSC
/// reply.
fn inbound_intercept_bsetn(ctx: &mut WsCtx<'_>, payload: &[u8]) -> MiddlewareOutcome {
    let Some(parsed) = scope_osc::parse_bsetn(payload) else {
        return MiddlewareOutcome::PassThrough;
    };
    let scope = &mut *ctx.scope;
    let Some(sub) = scope.osc.find_by_bufnum_mut(parsed.bufnum) else {
        return MiddlewareOutcome::PassThrough;
    };
    let Some(pending) = sub.pending_offset else {
        return MiddlewareOutcome::PassThrough;
    };
    if pending != parsed.offset as u32 {
        // Stale reply (we issued a new /b_getn meanwhile). Drop;
        // the original /b_setn still doesn't get forwarded
        // because matching bufnum + stale offset is bug-territory
        // — the worker would discard it anyway. PassThrough would
        // forward; ConsumedAndSend([]) would suppress. We
        // suppress.
        return MiddlewareOutcome::Consumed;
    }
    let Some(floats) = scope_osc::decode_bsetn_floats(parsed.raw_floats) else {
        return MiddlewareOutcome::PassThrough;
    };
    let frame_count = sub.chunk_size;
    let channels = sub.channels.min(255) as u8;
    let is_gap = sub.last_was_gap;
    sub.pending_offset = None;
    sub.last_was_gap = false;
    sub.tick_index = sub.tick_index.wrapping_add(1);
    let frame = encode_chunk(
        sub.sub_id,
        sub.tick_index,
        is_gap,
        channels,
        frame_count,
        &floats,
    );
    MiddlewareOutcome::ConsumedAndSend(frame)
}

/// Encode one 0x03 chunk frame. See `ws_bridge.rs`'s module docs
/// for the layout (and `src/workers/scopeWire.ts` for the worker
/// decoder). Phase 38 will retire this in favor of an OSC
/// `/scope/chunk` message.
pub fn encode_chunk(
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

// ===== Dispatch entry points (called from server::middleware::invoke_inbound) =====

/// Run an inbound middleware variant. Called by the dispatcher
/// in `server::middleware`. Direct-dispatch via match on the enum
/// variant — no boxing, no `dyn Future`.
pub(crate) fn run_inbound(
    variant: InboundScopeMiddleware,
    ctx: &mut WsCtx<'_>,
    payload: &[u8],
) -> MiddlewareOutcome {
    match variant {
        InboundScopeMiddleware::ChunkEmitOnTick => inbound_chunk_emit_on_tick(ctx),
        InboundScopeMiddleware::BgetnIssueOnTick => inbound_bgetn_issue_on_tick(ctx),
        InboundScopeMiddleware::InterceptBsetn => inbound_intercept_bsetn(ctx, payload),
    }
}

/// Variants of the scope-owned inbound middlewares. Lives in
/// the scope module (not server::middleware) because the bodies
/// are scope-domain logic; the server middleware enum
/// [`InboundMiddleware`] holds one variant carrying this enum.
#[derive(Clone, Copy, Debug)]
pub enum InboundScopeMiddleware {
    /// SHM mode: on /clock/tick, poll SHM for active subs.
    ChunkEmitOnTick,
    /// OSC mode: on /clock/tick, issue /b_getn for active subs.
    BgetnIssueOnTick,
    /// OSC mode: on /b_setn, match by bufnum and emit a chunk.
    InterceptBsetn,
}

/// Register the inbound middlewares appropriate for the
/// session's [`ScopeMode`]. Called once per WS attach.
pub fn register_inbound_middlewares(
    reg: &mut MiddlewareRegistry<InboundMiddleware>,
    mode: ScopeMode,
) {
    match mode {
        ScopeMode::Shm => {
            reg.register(
                r"^/clock/tick$",
                InboundMiddleware::Scope(InboundScopeMiddleware::ChunkEmitOnTick),
            );
        }
        ScopeMode::Osc => {
            reg.register(
                r"^/clock/tick$",
                InboundMiddleware::Scope(InboundScopeMiddleware::BgetnIssueOnTick),
            );
            reg.register(
                r"^/b_setn",
                InboundMiddleware::Scope(InboundScopeMiddleware::InterceptBsetn),
            );
        }
    }
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

        assert_eq!(frame[0], SCOPE_OP_CHUNK);
        assert_eq!(u32::from_le_bytes(frame[1..5].try_into().unwrap()), 7);
        assert_eq!(u32::from_le_bytes(frame[5..9].try_into().unwrap()), 42);
        assert_eq!(frame[9], 0);
        assert_eq!(frame[10], 2);
        assert_eq!(u32::from_le_bytes(frame[11..15].try_into().unwrap()), 2);
        for (i, &f) in payload.iter().enumerate() {
            let off = 15 + i * 4;
            assert_eq!(
                f32::from_le_bytes(frame[off..off + 4].try_into().unwrap()),
                f
            );
        }
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

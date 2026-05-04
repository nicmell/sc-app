//! Scope-related middleware bodies.
//!
//! Pre-37 the scope dispatch logic lived inline in
//! `server/ws_bridge.rs`. Phase 37c relocated the bodies here.
//! Phase 38 retired the binary 0x01/0x02/0x03 wire format —
//! `/scope/{subscribe,unsubscribe,chunk}` are real OSC messages
//! now. This module owns:
//!
//! - [`ScopeContext`] — the per-WS subscription state (SHM
//!   subscriptions + OSC poll state).
//! - Outbound middlewares: [`outbound_scope_subscribe`] /
//!   [`outbound_scope_unsubscribe`] — claim `^/scope/subscribe$`
//!   and `^/scope/unsubscribe$` on the recv path. Parse the OSC
//!   message and mutate `ScopeContext`.
//! - Inbound middlewares: [`inbound_chunk_emit_on_tick`] (SHM mode),
//!   [`inbound_bgetn_issue_on_tick`] (OSC mode),
//!   [`inbound_intercept_bsetn`] (OSC mode). Registered via
//!   [`register_inbound_middlewares`] at WS attach.
//! - [`encode_scope_chunk`] — the `/scope/chunk` OSC reply
//!   producer. Blob-arg payload, big-endian f32.

use std::collections::HashMap;
use std::sync::Arc;

use rosc::{OscMessage, OscPacket, OscType};

use crate::scope::osc::{self as scope_osc, OscPollState, OscScopeSubscription};
use crate::scope::shm::{self as scope_shm, ScopeReadResult};
use crate::scope::ScopeMode;
use crate::server::middleware::{
    InboundMiddleware, MiddlewareOutcome, MiddlewareRegistry, OutboundMiddleware,
    WsCtx,
};
use crate::server::session::ScopeShm;

pub const SCOPE_SUBSCRIBE_ADDRESS: &str = "/scope/subscribe";
pub const SCOPE_UNSUBSCRIBE_ADDRESS: &str = "/scope/unsubscribe";
pub const SCOPE_CHUNK_ADDRESS: &str = "/scope/chunk";

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

// ===== Outbound middlewares: /scope/{subscribe,unsubscribe} =====

/// Decode the OSC payload into a top-level message; non-message
/// payloads (bundles) for scope addresses are not expected and
/// drop with a warn.
fn decode_top_message(payload: &[u8]) -> Option<OscMessage> {
    let pkt = rosc::decoder::decode_udp(payload).ok()?.1;
    match pkt {
        OscPacket::Message(m) => Some(m),
        OscPacket::Bundle(_) => None,
    }
}

fn expect_int(arg: Option<&OscType>) -> Option<i32> {
    match arg? {
        OscType::Int(v) => Some(*v),
        _ => None,
    }
}

/// Outbound `/scope/subscribe` middleware. OSC args:
/// `subId:i, scope:i, channels:i, chunk:i`. The `scope` field is
/// interpreted as a scope_buffer index (SHM mode) or bufnum (OSC
/// fallback mode); the frontend chooses, the bridge interprets
/// per `Session::scope_mode`. Returns `Consumed` — the bridge
/// handles the subscription locally; nothing forwards to UDP.
async fn outbound_scope_subscribe<'a>(
    ctx: &mut WsCtx<'a>,
    payload: &[u8],
) -> MiddlewareOutcome {
    let Some(msg) = decode_top_message(payload) else {
        tracing::warn!(
            session_id = %ctx.session.session_id,
            "outbound /scope/subscribe: malformed OSC payload"
        );
        return MiddlewareOutcome::Consumed;
    };
    let mut args = msg.args.iter();
    let (Some(sub_id), Some(scope_or_bufnum), Some(channels), Some(chunk_size)) = (
        expect_int(args.next()),
        expect_int(args.next()),
        expect_int(args.next()),
        expect_int(args.next()),
    ) else {
        tracing::warn!(
            session_id = %ctx.session.session_id,
            args = ?msg.args,
            "outbound /scope/subscribe: expected (i,i,i,i) args"
        );
        return MiddlewareOutcome::Consumed;
    };
    if let Err(e) = install_subscription(
        ctx,
        sub_id as u32,
        scope_or_bufnum as u32,
        channels as u32,
        chunk_size as u32,
    )
    .await
    {
        tracing::warn!(
            error = %e,
            session_id = %ctx.session.session_id,
            "outbound /scope/subscribe failed"
        );
    }
    MiddlewareOutcome::Consumed
}

/// Outbound `/scope/unsubscribe` middleware. OSC args: `subId:i`.
/// Returns `Consumed`.
async fn outbound_scope_unsubscribe<'a>(
    ctx: &mut WsCtx<'a>,
    payload: &[u8],
) -> MiddlewareOutcome {
    let Some(msg) = decode_top_message(payload) else {
        tracing::warn!(
            session_id = %ctx.session.session_id,
            "outbound /scope/unsubscribe: malformed OSC payload"
        );
        return MiddlewareOutcome::Consumed;
    };
    let Some(sub_id) = expect_int(msg.args.first()) else {
        tracing::warn!(
            session_id = %ctx.session.session_id,
            args = ?msg.args,
            "outbound /scope/unsubscribe: expected (i,) args"
        );
        return MiddlewareOutcome::Consumed;
    };
    let sub_id = sub_id as u32;
    let scope = &mut *ctx.scope;
    let removed = match ctx.session.scope_mode {
        ScopeMode::Shm => scope.shm_subs.remove(&sub_id).is_some(),
        ScopeMode::Osc => scope.osc.subs.remove(&sub_id).is_some(),
    };
    if !removed {
        tracing::debug!(sub_id, "scope unsubscribe for unknown sub_id");
    }
    MiddlewareOutcome::Consumed
}

async fn install_subscription<'a>(
    ctx: &mut WsCtx<'a>,
    sub_id: u32,
    scope_or_bufnum: u32,
    channels: u32,
    chunk_size: u32,
) -> anyhow::Result<()> {
    let session = ctx.session.clone();
    match session.scope_mode {
        ScopeMode::Shm => {
            if ctx.scope.shm.is_none() {
                let shm = session
                    .ensure_scope_shm()
                    .await
                    .map_err(|e| anyhow::anyhow!("ensure_scope_shm failed: {e}"))?;
                ctx.scope.shm = Some(shm);
            }
            let shm = ctx.scope.shm.as_ref().expect("shm just set above");
            if (scope_or_bufnum as usize) >= shm.layout.count {
                anyhow::bail!(
                    "scope index {} out of range (layout count {})",
                    scope_or_bufnum,
                    shm.layout.count
                );
            }
            if let Some(prev) = ctx.scope.shm_subs.insert(
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
            if let Some(prev) = ctx.scope.osc.subs.insert(
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
/// subscription on this WS and emit a `/scope/chunk` OSC reply
/// for those whose `_stage` advanced. Returns `PassThrough` so
/// the tick itself still reaches the worker (the watchdog needs
/// it). Chunks are pushed onto `ctx.ws_extras` for the dispatcher
/// to flush.
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
                ctx.ws_extras.push(encode_scope_chunk(
                    sub.sub_id,
                    sub.tick_index,
                    false,
                    channels as u32,
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
/// reply for the encoded `/scope/chunk` OSC message. If no
/// subscription matches (different bufnum, or parse failure),
/// returns `PassThrough` and the original `/b_setn` flows to the
/// WS as a normal OSC reply.
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
        // — the worker would discard it anyway.
        return MiddlewareOutcome::Consumed;
    }
    let Some(floats) = scope_osc::decode_bsetn_floats(parsed.raw_floats) else {
        return MiddlewareOutcome::PassThrough;
    };
    let frame_count = sub.chunk_size;
    let channels = sub.channels;
    let is_gap = sub.last_was_gap;
    sub.pending_offset = None;
    sub.last_was_gap = false;
    sub.tick_index = sub.tick_index.wrapping_add(1);
    let frame = encode_scope_chunk(
        sub.sub_id,
        sub.tick_index,
        is_gap,
        channels,
        frame_count,
        &floats,
    );
    MiddlewareOutcome::ConsumedAndSend(frame)
}

/// Encode one `/scope/chunk` OSC message. Args:
///   `subId:i, tick:i, isGap:i, channels:i, data:b`.
/// `data` is a blob of `frame_count × channels × 4` bytes of
/// **big-endian** IEEE-754 float32, channel-interleaved. BE for
/// consistency with OSC's `,f` type — pinned by
/// `encode_scope_chunk_endianness_pin` test.
pub fn encode_scope_chunk(
    sub_id: u32,
    tick_index: u32,
    is_gap: bool,
    channels: u32,
    frame_count: u32,
    interleaved_floats: &[f32],
) -> Vec<u8> {
    debug_assert_eq!(
        interleaved_floats.len(),
        (frame_count as usize) * (channels as usize),
        "encode_scope_chunk: floats len ({}) != frame_count ({}) * channels ({})",
        interleaved_floats.len(),
        frame_count,
        channels,
    );
    let mut blob = Vec::with_capacity(interleaved_floats.len() * 4);
    for &f in interleaved_floats {
        blob.extend_from_slice(&f.to_be_bytes());
    }
    let msg = OscMessage {
        addr: SCOPE_CHUNK_ADDRESS.into(),
        args: vec![
            OscType::Int(sub_id as i32),
            OscType::Int(tick_index as i32),
            OscType::Int(if is_gap { 1 } else { 0 }),
            OscType::Int(channels as i32),
            OscType::Blob(blob),
        ],
    };
    rosc::encoder::encode(&OscPacket::Message(msg))
        .expect("encode_scope_chunk: rosc encoder failure (BUG)")
}

// ===== Dispatch entry points (called from server::middleware::invoke_*) =====

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

/// Run an outbound middleware variant. Called by the dispatcher
/// in `server::middleware`.
pub(crate) async fn run_outbound<'a>(
    variant: OutboundScopeMiddleware,
    ctx: &mut WsCtx<'a>,
    payload: &[u8],
) -> MiddlewareOutcome {
    match variant {
        OutboundScopeMiddleware::Subscribe => outbound_scope_subscribe(ctx, payload).await,
        OutboundScopeMiddleware::Unsubscribe => outbound_scope_unsubscribe(ctx, payload).await,
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

/// Variants of the scope-owned outbound middlewares.
#[derive(Clone, Copy, Debug)]
pub enum OutboundScopeMiddleware {
    /// Claims `/scope/subscribe` on the recv path.
    Subscribe,
    /// Claims `/scope/unsubscribe` on the recv path.
    Unsubscribe,
}

/// Register the outbound middlewares (mode-independent — the
/// scope module handles both SHM and OSC under the same
/// addresses; the per-mode branching happens in
/// `install_subscription`). Called once per WS attach.
pub fn register_outbound_middlewares(
    reg: &mut MiddlewareRegistry<OutboundMiddleware>,
) {
    reg.register(
        r"^/scope/subscribe$",
        OutboundMiddleware::Scope(OutboundScopeMiddleware::Subscribe),
    );
    reg.register(
        r"^/scope/unsubscribe$",
        OutboundMiddleware::Scope(OutboundScopeMiddleware::Unsubscribe),
    );
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

    /// Round-trip: encode a chunk via `encode_scope_chunk`, decode
    /// with rosc, assert the args match. Covers the wire shape
    /// the worker expects.
    #[test]
    fn encode_scope_chunk_round_trip() {
        let payload = [0.5_f32, -0.25_f32, 1.0_f32, -1.0_f32];
        let bytes = encode_scope_chunk(7, 42, false, 2, 2, &payload);

        let (_, packet) = rosc::decoder::decode_udp(&bytes).expect("decode");
        let OscPacket::Message(msg) = packet else {
            panic!("expected Message, got Bundle");
        };
        assert_eq!(msg.addr, SCOPE_CHUNK_ADDRESS);
        assert_eq!(msg.args.len(), 5);
        assert!(matches!(msg.args[0], OscType::Int(7)));
        assert!(matches!(msg.args[1], OscType::Int(42)));
        assert!(matches!(msg.args[2], OscType::Int(0)));
        assert!(matches!(msg.args[3], OscType::Int(2)));
        let OscType::Blob(ref blob) = msg.args[4] else {
            panic!("expected Blob arg, got {:?}", msg.args[4]);
        };
        assert_eq!(blob.len(), payload.len() * 4);
        for (i, &f) in payload.iter().enumerate() {
            // Big-endian bytes inside the blob (Phase 38 invariant).
            let chunk: [u8; 4] = blob[i * 4..i * 4 + 4].try_into().unwrap();
            assert_eq!(f32::from_be_bytes(chunk), f);
        }
    }

    /// Endianness pin — a known float must produce a known byte
    /// sequence in the blob payload. Catches accidental host-
    /// native or little-endian regressions on either side of the
    /// wire (bridge encoder, worker decoder).
    #[test]
    fn encode_scope_chunk_endianness_pin() {
        // 1.0_f32 in IEEE-754 = 0x3F800000 (big-endian bytes).
        let bytes = encode_scope_chunk(0, 0, false, 1, 1, &[1.0_f32]);
        let (_, packet) = rosc::decoder::decode_udp(&bytes).unwrap();
        let OscPacket::Message(msg) = packet else {
            panic!()
        };
        let OscType::Blob(ref blob) = msg.args[4] else {
            panic!()
        };
        assert_eq!(blob.as_slice(), &[0x3F, 0x80, 0x00, 0x00]);
    }

    #[test]
    fn encode_scope_chunk_is_gap_flag() {
        let bytes = encode_scope_chunk(0, 0, true, 1, 0, &[]);
        let (_, packet) = rosc::decoder::decode_udp(&bytes).unwrap();
        let OscPacket::Message(msg) = packet else {
            panic!()
        };
        assert!(matches!(msg.args[2], OscType::Int(1)));
    }
}

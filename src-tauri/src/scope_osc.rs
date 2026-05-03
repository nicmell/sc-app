//! Phase 36 — OSC `/b_getn` fallback for scope data.
//!
//! When SHM isn't accessible (remote scsynth, exotic deployment,
//! `--no-shm` flag) the bridge falls back to the pre-Phase-31
//! pattern: poll scsynth via `/b_getn` on each observed
//! `/clock/tick`, intercept the matching `/b_setn` replies from
//! the broadcast stream, encode chunk frames identically to the
//! SHM path. The worker doesn't see the difference — same 0x03
//! wire format on the main /ws.
//!
//! ## Per-subscription state
//!
//! Each subscription is keyed by `sub_id` (worker-minted) like
//! the SHM path. In OSC mode the `scope_idx` field is reused as
//! `bufnum` (a regular SC buffer number from `/b_alloc`, written
//! to by the OSC tap synth's `BufWr.ar`).
//!
//! Buffer layout: `2 × chunkSize` frames, `channels` channels per
//! frame, channel-interleaved. The OSC tap synth uses a
//! `clockBus`-driven `Phasor.ar` for the writeIdx, so half
//! boundaries are sample-aligned with global tick parity.
//!
//! Tick parity → which-half-just-completed:
//!
//! - Impulse.kr fires at `t=0` (per CLAUDE.md), so tick `N`
//!   corresponds to audio frame `(N-1) × chunkSize`.
//! - At tick `N`, the writer's writeIdx is at frame
//!   `(N-1) × chunkSize` → half `((N-1) % 2)`. The half just
//!   completed is `((N-2) % 2)`.
//! - Tick 1 (the very first one): no half has been written yet;
//!   skip.
//! - From tick 2 onward, read half `((N-2) % 2) × chunkSize ×
//!   channels` (in raw-sample offset).
//!
//! ## Read serialization
//!
//! At most one `/b_getn` outstanding per subscription. If a tick
//! fires while we're still waiting on the previous reply, we
//! mark a gap (emit `is_gap: true` chunk on next reply matching
//! that subscription, OR drop the in-flight read and start
//! fresh). The choice: simpler to drop in-flight + emit an
//! explicit gap chunk so the recording side sees the discontinuity.
//!
//! Pre-31 the TS worker used a `pendingByOffset: Map<offset,
//! pending>` to handle late replies arriving out of order at high
//! tick rates. Bridge-side at the same rate (~250 Hz cap) the
//! round-trip is sub-millisecond on loopback; serializing one
//! request per subscription is fine. If we ever need higher tick
//! rates over OSC fallback (LAN deployment), revisit.
//!
//! ## kr/ar slop budget
//!
//! `/b_getn` is wrapped in an `OSC.Bundle` with
//! `timetag = Date.now() + READ_DELAY_MS` (5 ms — same constant
//! as pre-31 in `src/config/clockConfig.ts`). scsynth's
//! scheduler holds the read past the kr-fire-vs-ar-write
//! quantization slop so we don't read mid-half. The 5 ms budget
//! is what historically capped the practical tick rate at
//! ~250 Hz (= 4 ms tickInterval, smaller than `READ_DELAY_MS`).

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

const SCOPE_OP_CHUNK: u8 = 0x03;

/// Mirrors pre-31's `READ_DELAY_MS = 5 ms`. Bundle timetag
/// shifts the `/b_getn` execution past kr/ar quantization slop.
const READ_DELAY_MS: u64 = 5;

/// NTP epoch starts 1900-01-01; UNIX_EPOCH is 1970-01-01.
const NTP_UNIX_OFFSET: u64 = 2_208_988_800;

/// Per-WS, per-subscription OSC fallback state. Mirrors
/// `ScopeSubscription` from `ws_bridge.rs`'s SHM path but with
/// bufnum + ring-half tracking.
#[derive(Debug)]
pub struct OscScopeSubscription {
    pub sub_id: u32,
    /// Buffer number (`/b_alloc`'d by the frontend in OSC mode).
    /// Encoded as the `scope` field of the 0x01 subscribe frame.
    pub bufnum: u32,
    pub channels: u32,
    pub chunk_size: u32,
    /// Tick counter for outbound chunk frames. Bumped on each
    /// emitted chunk. Decoupled from server `/clock/tick`
    /// numbering — gaps are visible as skipped values here.
    pub tick_index: u32,
    /// Currently outstanding read, if any. The bufnum-and-offset
    /// pair the bridge is waiting on. `None` means we can issue
    /// the next `/b_getn` on the upcoming tick.
    pub pending_offset: Option<u32>,
    /// Whether the last attempted read was a gap (timed out /
    /// dropped). Drives `is_gap` on the next emitted chunk so
    /// the recorder can mark the boundary.
    pub last_was_gap: bool,
}

impl OscScopeSubscription {
    pub fn new(sub_id: u32, bufnum: u32, channels: u32, chunk_size: u32) -> Self {
        Self {
            sub_id,
            bufnum,
            channels,
            chunk_size,
            tick_index: 0,
            pending_offset: None,
            last_was_gap: false,
        }
    }
}

/// Compute which `(offset, count)` to /b_getn at this tick.
/// Returns `None` if the tick is too early (no half has been
/// written yet — `tick_index <= 1`).
pub fn compute_read_window(
    sub: &OscScopeSubscription,
    server_tick_index: i64,
) -> Option<(u32, u32)> {
    // Tick 1 fires at audio frame 0; nothing written yet. Skip.
    if server_tick_index < 2 {
        return None;
    }
    let half = ((server_tick_index - 2).rem_euclid(2)) as u32;
    let offset = half * sub.chunk_size * sub.channels;
    let count = sub.chunk_size * sub.channels;
    Some((offset, count))
}

/// Encode a `/b_getn` OSC message wrapped in a bundle with
/// `timetag = now + READ_DELAY_MS`. Bytes are big-endian per OSC
/// spec.
pub fn encode_bgetn_bundle(bufnum: u32, offset: u32, count: u32) -> Vec<u8> {
    let timetag = ntp_timetag_in_future(READ_DELAY_MS);
    let inner = encode_bgetn_message(bufnum, offset, count);
    encode_bundle(timetag, &inner)
}

/// Wrap `inner_msg` in an OSC bundle with a single element.
/// Layout: `"#bundle\0" + timetag:u64_be + size:u32_be + inner_msg`.
fn encode_bundle(timetag: u64, inner_msg: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(8 + 8 + 4 + inner_msg.len());
    // "#bundle\0" — 8 bytes, already aligned.
    out.extend_from_slice(b"#bundle\0");
    // Timetag — 64-bit NTP, big-endian.
    out.extend_from_slice(&timetag.to_be_bytes());
    // Size of the inner message, big-endian u32.
    out.extend_from_slice(&(inner_msg.len() as u32).to_be_bytes());
    out.extend_from_slice(inner_msg);
    out
}

/// Encode a bare `/b_getn bufnum offset count` OSC message.
/// Layout: address (null-padded to 4-byte boundary) + type tag
/// (",iii\0\0\0\0") + 3 × i32_be.
fn encode_bgetn_message(bufnum: u32, offset: u32, count: u32) -> Vec<u8> {
    let mut out = Vec::with_capacity(8 + 8 + 12);
    // "/b_getn" + null = 8 bytes, already aligned.
    out.extend_from_slice(b"/b_getn\0");
    // Type tag ",iii" + null + 3 padding bytes = 8 bytes.
    out.extend_from_slice(b",iii\0\0\0\0");
    out.extend_from_slice(&(bufnum as i32).to_be_bytes());
    out.extend_from_slice(&(offset as i32).to_be_bytes());
    out.extend_from_slice(&(count as i32).to_be_bytes());
    out
}

fn ntp_timetag_in_future(ms_ahead: u64) -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let target = now + std::time::Duration::from_millis(ms_ahead);
    let secs = target.as_secs() + NTP_UNIX_OFFSET;
    // 32-bit fractional seconds in the lower half of the NTP
    // timestamp. `subsec_nanos / 1e9 × 2^32 ≈ subsec_nanos × 4.295`.
    let frac = ((target.subsec_nanos() as u64) * (1u64 << 32)) / 1_000_000_000;
    (secs << 32) | (frac & 0xFFFF_FFFF)
}

/// Parsed `/b_setn bufnum offset count v0..vN-1` reply. Returns
/// `None` if the payload doesn't look like a `/b_setn` (we got
/// passed a different OSC reply by mistake).
pub struct BSetnReply<'a> {
    pub bufnum: i32,
    pub offset: i32,
    pub count: i32,
    /// Slice into the original payload — contains `count` × 4
    /// bytes of big-endian f32.
    pub raw_floats: &'a [u8],
}

/// Try to parse an inbound `/b_setn` payload. Returns `None` if
/// the bytes aren't a `/b_setn` (caller should let the broadcast
/// payload through to the WS as a normal OSC reply).
///
/// Strict OSC 1.0 alignment: each string null-terminates and
/// pads to the next 4-byte boundary; integers and floats are
/// 4-byte aligned, big-endian.
pub fn parse_bsetn(payload: &[u8]) -> Option<BSetnReply<'_>> {
    if !payload.starts_with(b"/b_setn\0") {
        return None;
    }
    // Address null is at byte 7; +1 for the null = 8 bytes
    // total. 8 is already 4-aligned, no extra padding required.
    let cursor = osc_align(b"/b_setn\0".len());

    // Type tag starts with ",iii" (bufnum, offset, count); can
    // carry trailing 'f' chars for the float payload.
    if payload.len() < cursor + 4 || !payload[cursor..].starts_with(b",iii") {
        return None;
    }
    let typetag_start = cursor;
    let mut typetag_end = cursor;
    while typetag_end < payload.len() && payload[typetag_end] != 0 {
        typetag_end += 1;
    }
    if typetag_end >= payload.len() {
        return None;
    }
    let typetag_len_with_null = typetag_end - typetag_start + 1;
    let cursor = typetag_start + osc_align(typetag_len_with_null);

    // 3 × i32 for bufnum, offset, count.
    if payload.len() < cursor + 12 {
        return None;
    }
    let bufnum =
        i32::from_be_bytes(payload[cursor..cursor + 4].try_into().ok()?);
    let offset =
        i32::from_be_bytes(payload[cursor + 4..cursor + 8].try_into().ok()?);
    let count =
        i32::from_be_bytes(payload[cursor + 8..cursor + 12].try_into().ok()?);
    let cursor = cursor + 12;

    if count < 0 {
        return None;
    }
    let needed = count as usize * 4;
    if payload.len() < cursor + needed {
        return None;
    }
    let raw_floats = &payload[cursor..cursor + needed];

    Some(BSetnReply {
        bufnum,
        offset,
        count,
        raw_floats,
    })
}

/// Round `n` up to the next multiple of 4 (OSC's alignment unit).
fn osc_align(n: usize) -> usize {
    (n + 3) & !3
}

/// Decode a `/b_setn` reply's float payload (big-endian on the
/// wire) into a `Vec<f32>`. Returns `None` if the byte count
/// isn't a multiple of 4.
pub fn decode_bsetn_floats(raw_floats: &[u8]) -> Option<Vec<f32>> {
    if raw_floats.len() % 4 != 0 {
        return None;
    }
    let mut out = Vec::with_capacity(raw_floats.len() / 4);
    for chunk in raw_floats.chunks_exact(4) {
        out.push(f32::from_be_bytes(chunk.try_into().ok()?));
    }
    Some(out)
}

/// Encode a 0x03 chunk frame for the OSC fallback path. Wire
/// format identical to the SHM path's `encode_chunk` in
/// `ws_bridge.rs` — the worker doesn't distinguish.
pub fn encode_chunk(
    sub_id: u32,
    tick_index: u32,
    is_gap: bool,
    channels: u8,
    frame_count: u32,
    interleaved_floats: &[f32],
) -> Vec<u8> {
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

/// Per-WS poll context for OSC mode. Lives alongside the SHM
/// `ScopeContext` in `ws_bridge.rs`'s `ScopeContext`. Wrapped in
/// the same Arc<TokioMutex> so the recv loop and the
/// default-route forwarder share access.
#[derive(Default)]
pub struct OscPollState {
    /// Active subscriptions keyed by `sub_id`. The bridge looks
    /// up by sub_id on subscribe/unsubscribe and by bufnum on
    /// /b_setn intercept.
    pub subs: HashMap<u32, OscScopeSubscription>,
}

impl OscPollState {
    /// Find the subscription whose bufnum matches `target`.
    /// O(N) over active subscriptions — fine for typical N=1..4.
    pub fn find_by_bufnum_mut(
        &mut self,
        target: i32,
    ) -> Option<&mut OscScopeSubscription> {
        if target < 0 {
            return None;
        }
        let target = target as u32;
        self.subs.values_mut().find(|s| s.bufnum == target)
    }
}

/// Try to extract the tick index (PulseCount value) from a
/// `/clock/tick` OSC payload. Wire shape is
/// `/clock/tick nodeID:i32 replyID:i32 count:i32` (SendReply
/// format with default replyID = -1). Returns `None` on parse
/// failure.
pub fn parse_clock_tick_index(payload: &[u8]) -> Option<i64> {
    if !payload.starts_with(b"/clock/tick\0") {
        return None;
    }
    // "/clock/tick\0" is 12 bytes (= 3 × 4); already 4-aligned,
    // no extra padding under OSC 1.0.
    let cursor = osc_align(b"/clock/tick\0".len());
    if payload.len() < cursor + 4 || payload[cursor] != b',' {
        return None;
    }
    let typetag_start = cursor;
    let mut typetag_end = cursor;
    while typetag_end < payload.len() && payload[typetag_end] != 0 {
        typetag_end += 1;
    }
    if typetag_end >= payload.len() {
        return None;
    }
    let cursor = typetag_start + osc_align(typetag_end - typetag_start + 1);

    // Skip nodeID + replyID (2 × 4 bytes).
    let cursor = cursor + 8;

    // Read count as either i32 or f32 depending on the third
    // type tag character. SendReply.kr emits ",iif" when the
    // value is float-typed and ",iii" when it's int-typed —
    // PulseCount.kr's output is integer-valued but osc-js can
    // serialize it either way depending on whether scsynth's UGen
    // produces ar or kr int.
    if typetag_end - typetag_start < 4 {
        return None;
    }
    let third_tag = payload[typetag_start + 3];
    if payload.len() < cursor + 4 {
        return None;
    }
    let raw = &payload[cursor..cursor + 4];
    let val: i64 = match third_tag {
        b'i' => i32::from_be_bytes(raw.try_into().ok()?) as i64,
        b'f' => f32::from_be_bytes(raw.try_into().ok()?) as i64,
        _ => return None,
    };
    Some(val)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_window_skips_first_tick() {
        let sub = OscScopeSubscription::new(1, 100, 2, 1024);
        assert_eq!(compute_read_window(&sub, 0), None);
        assert_eq!(compute_read_window(&sub, 1), None);
    }

    #[test]
    fn read_window_picks_correct_half() {
        let sub = OscScopeSubscription::new(1, 100, 2, 1024);
        // Tick 2 → just-completed half = (2-2)%2 = 0 → offset 0
        assert_eq!(compute_read_window(&sub, 2), Some((0, 2048)));
        // Tick 3 → just-completed half = (3-2)%2 = 1 → offset chunk*ch
        assert_eq!(compute_read_window(&sub, 3), Some((2048, 2048)));
        // Tick 4 → half 0 again
        assert_eq!(compute_read_window(&sub, 4), Some((0, 2048)));
        // Tick 5 → half 1
        assert_eq!(compute_read_window(&sub, 5), Some((2048, 2048)));
    }

    #[test]
    fn bgetn_message_layout() {
        let bytes = encode_bgetn_message(7, 1024, 2048);
        // Address.
        assert_eq!(&bytes[0..8], b"/b_getn\0");
        // Type tag.
        assert_eq!(&bytes[8..16], b",iii\0\0\0\0");
        // Args (big-endian).
        assert_eq!(i32::from_be_bytes(bytes[16..20].try_into().unwrap()), 7);
        assert_eq!(i32::from_be_bytes(bytes[20..24].try_into().unwrap()), 1024);
        assert_eq!(i32::from_be_bytes(bytes[24..28].try_into().unwrap()), 2048);
        assert_eq!(bytes.len(), 28);
    }

    #[test]
    fn bgetn_bundle_layout() {
        let bytes = encode_bgetn_bundle(7, 0, 4);
        // "#bundle\0".
        assert_eq!(&bytes[0..8], b"#bundle\0");
        // Timetag (8 bytes; we don't assert the value, just that
        // it's not zero — it should be in the future).
        let timetag =
            u64::from_be_bytes(bytes[8..16].try_into().unwrap());
        assert!(timetag > 0);
        // Inner message size (big-endian u32).
        let size =
            u32::from_be_bytes(bytes[16..20].try_into().unwrap());
        assert_eq!(size, 28); // bare /b_getn message length
        // Inner message bytes start at offset 20.
        assert_eq!(&bytes[20..28], b"/b_getn\0");
    }

    #[test]
    fn bsetn_parse_round_trip() {
        // Build a synthetic /b_setn payload by hand and parse it.
        let mut payload = Vec::new();
        payload.extend_from_slice(b"/b_setn\0");
        payload.extend_from_slice(b",iiifff\0"); // 8 bytes (4-aligned)
        payload.extend_from_slice(&7_i32.to_be_bytes());
        payload.extend_from_slice(&100_i32.to_be_bytes());
        payload.extend_from_slice(&3_i32.to_be_bytes());
        payload.extend_from_slice(&0.5_f32.to_be_bytes());
        payload.extend_from_slice(&(-0.25_f32).to_be_bytes());
        payload.extend_from_slice(&1.0_f32.to_be_bytes());

        let parsed = parse_bsetn(&payload).expect("should parse");
        assert_eq!(parsed.bufnum, 7);
        assert_eq!(parsed.offset, 100);
        assert_eq!(parsed.count, 3);
        let floats = decode_bsetn_floats(parsed.raw_floats).unwrap();
        assert_eq!(floats, vec![0.5, -0.25, 1.0]);
    }

    #[test]
    fn bsetn_rejects_other_addresses() {
        let mut payload = Vec::new();
        payload.extend_from_slice(b"/dirt/sample\0\0\0\0");
        payload.extend_from_slice(b",is\0");
        payload.extend_from_slice(&1_i32.to_be_bytes());
        payload.extend_from_slice(b"hi\0\0");
        assert!(parse_bsetn(&payload).is_none());
    }

    #[test]
    fn clock_tick_index_parse_int_typetag() {
        // /clock/tick nodeID:i32 replyID:i32 count:i32
        // "/clock/tick\0" = 12 bytes (already 4-aligned).
        let mut payload = Vec::new();
        payload.extend_from_slice(b"/clock/tick\0");
        // ",iii\0" = 5 bytes → padded to 8.
        payload.extend_from_slice(b",iii\0\0\0\0");
        payload.extend_from_slice(&999_i32.to_be_bytes()); // nodeID
        payload.extend_from_slice(&(-1_i32).to_be_bytes()); // replyID
        payload.extend_from_slice(&42_i32.to_be_bytes()); // count
        assert_eq!(parse_clock_tick_index(&payload), Some(42));
    }

    #[test]
    fn clock_tick_index_parse_float_typetag() {
        // SendReply.kr can emit ",iif" depending on PulseCount's
        // representation in the UGen graph.
        let mut payload = Vec::new();
        payload.extend_from_slice(b"/clock/tick\0");
        payload.extend_from_slice(b",iif\0\0\0\0");
        payload.extend_from_slice(&999_i32.to_be_bytes());
        payload.extend_from_slice(&(-1_i32).to_be_bytes());
        payload.extend_from_slice(&42.0_f32.to_be_bytes());
        assert_eq!(parse_clock_tick_index(&payload), Some(42));
    }

    #[test]
    fn osc_align_rounds_up() {
        assert_eq!(osc_align(0), 0);
        assert_eq!(osc_align(1), 4);
        assert_eq!(osc_align(4), 4);
        assert_eq!(osc_align(5), 8);
        assert_eq!(osc_align(7), 8);
        assert_eq!(osc_align(8), 8);
    }

    #[test]
    fn find_by_bufnum() {
        let mut state = OscPollState::default();
        state.subs.insert(1, OscScopeSubscription::new(1, 100, 2, 1024));
        state.subs.insert(2, OscScopeSubscription::new(2, 200, 1, 512));

        assert!(state.find_by_bufnum_mut(100).is_some());
        assert_eq!(
            state.find_by_bufnum_mut(100).unwrap().sub_id,
            1
        );
        assert!(state.find_by_bufnum_mut(200).is_some());
        assert!(state.find_by_bufnum_mut(999).is_none());
        assert!(state.find_by_bufnum_mut(-1).is_none());
    }

    #[test]
    fn chunk_frame_layout_matches_shm_path() {
        // Cross-check: encode_chunk here must produce identical
        // wire bytes to ws_bridge::encode_chunk. Both are 0x03
        // frames; the worker doesn't know which path produced it.
        let payload = [0.5_f32, -0.25_f32];
        let frame = encode_chunk(7, 42, false, 1, 2, &payload);
        assert_eq!(frame[0], SCOPE_OP_CHUNK);
        assert_eq!(u32::from_le_bytes(frame[1..5].try_into().unwrap()), 7);
        assert_eq!(u32::from_le_bytes(frame[5..9].try_into().unwrap()), 42);
        assert_eq!(frame[9], 0);
        assert_eq!(frame[10], 1);
        assert_eq!(u32::from_le_bytes(frame[11..15].try_into().unwrap()), 2);
        // Total length = 15-byte header + 2 × 4 bytes float payload
        assert_eq!(frame.len(), 15 + 2 * 4);
    }
}

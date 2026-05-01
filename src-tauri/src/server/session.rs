//! Per-WS-session OSC state + Phase 22 disconnect cleanup.
//!
//! Owns the bits of state the bridge has to keep across datagrams:
//! - `client_id` from `/done /notify` (captured by [`Session::snoop`]
//!   on the inbound stream) — used to derive the parent group ID.
//! - `frontend_clean` flag (set by [`Session::snoop_outbound`] when
//!   it sees `/notify 0` flying outbound) — signals that the
//!   frontend ran its own teardown, so the bridge cleanup tail can
//!   be skipped.
//!
//! Hot path: `snoop` and `snoop_outbound` are called for every UDP
//! datagram (in / out). Both short-circuit on a cheap byte-prefix
//! / -window check before touching the rosc decoder.
//!
//! Cleanup bundle (fired on WS close iff `client_id` was captured
//! AND `frontend_clean` is `false`):
//!
//!   /g_freeAll <parentGroupId>
//!   /n_free    <parentGroupId>
//!   /notify    0
//!
//! `parentGroupId = clientId * 100` (with `0 → 100` fallback to
//! match `src/AppShell.tsx`). Wrapped in a bundle with the OSC
//! "immediate" timetag so scsynth processes the three messages
//! atomically.
//!
//! Skipping when `frontend_clean = true` avoids the noisy
//! `FAILURE IN SERVER /g_freeAll Group N not found` lines on the
//! scsynth console for normal disconnects (Disconnect button,
//! `pagehide`) — the targets are already gone. The cleanup tail
//! still runs for genuinely ungraceful disconnects (browser crash,
//! TCP RST), where `/notify 0` never made it to the wire.

use std::time::Duration;

use anyhow::{Context, Result};
use rosc::{OscBundle, OscMessage, OscPacket, OscTime, OscType};
use tokio::net::UdpSocket;
use tokio::sync::Mutex;

/// Hold the socket open briefly after firing cleanup so kernel-queued
/// datagrams flush on loopback before we drop it.
const CLEANUP_FLUSH_DELAY: Duration = Duration::from_millis(50);

/// scsynth's `clientId = 0` is the single-client default; `0 * 100 = 0`
/// would clash with the root group, so we fall back to `100`. Mirrors
/// the same fallback in `src/AppShell.tsx`.
const FALLBACK_PARENT_GROUP_ID: i32 = 100;

/// Wire bytes for the OSC message `/notify 0`:
/// - Address `/notify\0` padded to 8 bytes.
/// - Typetag `,i\0\0` (4 bytes — int32 arg).
/// - Int32 `0` big-endian (4 bytes).
///
/// We `memmem` for this exact 16-byte pattern in outbound payloads.
/// It works whether the frontend sent `/notify 0` as a bare message
/// or wrapped inside a bundle (the bytes still appear verbatim
/// inside the bundle's element). Conservative match — extra args
/// or non-zero values won't trigger a false positive.
const NOTIFY_ZERO_BYTES: &[u8] = b"/notify\0,i\0\0\x00\x00\x00\x00";

#[derive(Default)]
struct State {
    /// Captured from the `/done /notify` reply when the frontend
    /// completes its `/notify 1` handshake. `None` until then —
    /// pre-handshake disconnects skip cleanup.
    client_id: Option<i32>,
    /// `true` once we've seen `/notify 0` on the outbound stream.
    /// Indicates the frontend ran its own teardown; the bridge
    /// cleanup tail no-ops when this is set.
    frontend_clean: bool,
}

impl State {
    fn parent_group_id(&self) -> Option<i32> {
        self.client_id.map(|id| {
            if id > 0 {
                id * 100
            } else {
                FALLBACK_PARENT_GROUP_ID
            }
        })
    }
}

/// Per-WS-session handle. Cheap to clone via `Arc<Session>` so the
/// inbound spawn task and the cleanup tail can share it.
#[derive(Default)]
pub struct Session {
    state: Mutex<State>,
}

impl Session {
    pub fn new() -> Self {
        Self::default()
    }

    /// Inspect an inbound UDP datagram. If it's a `/done /notify`
    /// reply, capture the `clientId`. No-op for everything else —
    /// the prefix check is cheap enough to call on every datagram.
    pub async fn snoop(&self, payload: &[u8]) {
        let Some(client_id) = snoop_notify_reply(payload) else {
            return;
        };
        let mut state = self.state.lock().await;
        if state.client_id.is_none() {
            let parent = if client_id > 0 {
                client_id * 100
            } else {
                FALLBACK_PARENT_GROUP_ID
            };
            tracing::info!(
                client_id,
                parent_group = parent,
                "notify handshake captured"
            );
        }
        state.client_id = Some(client_id);
    }

    /// Inspect an outbound UDP datagram (frontend → scsynth). If we
    /// see `/notify 0` (the frontend's deregistration signal), mark
    /// the session as cleanly torn down. The cleanup tail will then
    /// no-op.
    ///
    /// Once `frontend_clean` is set we don't need to keep scanning,
    /// so we short-circuit on the lock-held flag check.
    pub async fn snoop_outbound(&self, payload: &[u8]) {
        // Cheap byte-window check first: skip the lock entirely if
        // the magic bytes aren't present.
        if !contains_notify_zero(payload) {
            return;
        }
        let mut state = self.state.lock().await;
        if !state.frontend_clean {
            state.frontend_clean = true;
            tracing::debug!("frontend sent /notify 0; bridge cleanup will skip");
        }
    }

    /// Phase 22 cleanup. Fires the free-group bundle if we captured
    /// a `clientId` AND the frontend didn't already deregister
    /// itself. Best-effort — scsynth may already be dead, UDP
    /// doesn't error on send to a non-listening peer, and we never
    /// read the reply.
    pub async fn cleanup(&self, sock: &UdpSocket) {
        let (parent_group_id, frontend_clean) = {
            let state = self.state.lock().await;
            (state.parent_group_id(), state.frontend_clean)
        };
        let Some(group_id) = parent_group_id else {
            tracing::debug!("session closed pre-notify; no cleanup");
            return;
        };
        if frontend_clean {
            tracing::debug!(
                parent_group = group_id,
                "frontend cleanup observed; skipping bridge cleanup"
            );
            return;
        }
        match send_cleanup(sock, group_id).await {
            Ok(()) => {
                tracing::info!(parent_group = group_id, "cleanup bundle sent");
                tokio::time::sleep(CLEANUP_FLUSH_DELAY).await;
            }
            Err(e) => {
                tracing::warn!(error = %e, "cleanup encode/send failed");
            }
        }
    }
}

/// Cheap prefix check + full decode of `/done /notify <clientId>
/// [maxLogins]` replies. Returns `Some(clientId)` if matched, `None`
/// for anything else. The prefix gate skips the rosc decoder on the
/// hot inbound path (every `/b_setn` for buffer-chunk subscriptions).
fn snoop_notify_reply(bytes: &[u8]) -> Option<i32> {
    // OSC address pattern is null-terminated and 4-byte aligned.
    // `/done\0\0\0` is 8 bytes — fits inside any non-empty packet.
    if !bytes.starts_with(b"/done\0\0\0") {
        return None;
    }

    let packet = rosc::decoder::decode_udp(bytes).ok()?.1;
    let msg = match packet {
        OscPacket::Message(m) => m,
        OscPacket::Bundle(_) => return None,
    };
    if msg.addr != "/done" {
        return None;
    }
    let mut args = msg.args.into_iter();
    let cmd = args.next()?;
    let OscType::String(s) = cmd else { return None };
    if s != "/notify" {
        return None;
    }
    let cid = args.next()?;
    let OscType::Int(id) = cid else { return None };
    Some(id)
}

/// Byte-window scan for the wire bytes of `/notify 0`. Works for
/// both bare-message and bundle-wrapped payloads (the bundle's
/// element-content slot contains the message verbatim).
fn contains_notify_zero(bytes: &[u8]) -> bool {
    if bytes.len() < NOTIFY_ZERO_BYTES.len() {
        return false;
    }
    bytes
        .windows(NOTIFY_ZERO_BYTES.len())
        .any(|w| w == NOTIFY_ZERO_BYTES)
}

async fn send_cleanup(sock: &UdpSocket, parent_group_id: i32) -> Result<()> {
    let bundle = OscPacket::Bundle(OscBundle {
        // OSC "immediate" timetag = (0, 1). scsynth's scheduler
        // bypasses the timetag queue and runs it inline.
        timetag: OscTime {
            seconds: 0,
            fractional: 1,
        },
        content: vec![
            OscPacket::Message(OscMessage {
                addr: "/g_freeAll".into(),
                args: vec![OscType::Int(parent_group_id)],
            }),
            OscPacket::Message(OscMessage {
                addr: "/n_free".into(),
                args: vec![OscType::Int(parent_group_id)],
            }),
            OscPacket::Message(OscMessage {
                addr: "/notify".into(),
                args: vec![OscType::Int(0)],
            }),
        ],
    });

    let bytes = rosc::encoder::encode(&bundle).context("encode cleanup bundle")?;
    sock.send(&bytes).await.context("send cleanup bundle")?;
    Ok(())
}

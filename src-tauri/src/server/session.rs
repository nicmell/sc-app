//! Per-WS-session OSC state + Phase 22 disconnect cleanup.
//!
//! Owns the bits of state that the bridge has to keep across
//! datagrams — currently just the `clientId` from `/done /notify` —
//! and the cleanup bundle we fire on WS close.
//!
//! Hot path: `Session::snoop` is called for every inbound UDP
//! datagram, so the body short-circuits on a cheap byte-prefix check
//! before touching the rosc decoder.
//!
//! Cleanup bundle (fired on WS close iff `clientId` was captured):
//!
//!   /g_freeAll <parentGroupId>
//!   /n_free    <parentGroupId>
//!   /notify    0
//!
//! `parentGroupId = clientId * 100` (with `0 → 100` fallback to match
//! `src/AppShell.tsx`). Wrapped in a bundle with the OSC "immediate"
//! timetag so scsynth processes the three messages atomically.
//!
//! Idempotent against the frontend's own `handleDisconnect` /
//! `pagehide` cleanup — scsynth no-ops the redundant frees and
//! returns `/fail /notify` for the second `/notify 0`. We don't read
//! the reply.

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

#[derive(Default)]
struct State {
    /// Captured from the `/done /notify` reply when the frontend
    /// completes its `/notify 1` handshake. `None` until then —
    /// pre-handshake disconnects skip cleanup.
    client_id: Option<i32>,
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

    /// Phase 22 cleanup. Fires the free-group bundle if we captured a
    /// `clientId`; no-op if the session disconnected pre-handshake.
    /// Best-effort — scsynth may already be dead, UDP doesn't error
    /// on send to a non-listening peer, and we never read the reply.
    pub async fn cleanup(&self, sock: &UdpSocket) {
        let parent_group_id = self.state.lock().await.parent_group_id();
        let Some(group_id) = parent_group_id else {
            tracing::debug!("session closed pre-notify; no cleanup");
            return;
        };
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

//! Phase 0 — per-session WebSocket ↔ UDP bridge.
//! Phase 22 — bridge-side cleanup on ungraceful WS close.
//!
//! Each WebSocket connection gets an ephemeral UDP socket. Binary frames
//! from the client are forwarded as UDP datagrams to scsynth; incoming
//! UDP datagrams are forwarded back as binary WS frames. Text, ping and
//! pong frames are ignored.
//!
//! scsynth replies to the socket that sent the command, so isolating
//! each session on its own UDP socket prevents cross-client reply
//! contamination — and means two connections can target two different
//! scsynth instances concurrently with no cross-talk.
//!
//! ## Phase 22 — disconnect cleanup
//!
//! The bridge snoops the inbound (UDP→WS) reply stream for the
//! `/done /notify` reply that scsynth sends back when the frontend
//! issues `/notify 1`. We extract `clientId` from `args[1]` and stash
//! it in the per-session state. On WS close (clean or ungraceful), we
//! fire a cleanup bundle to scsynth before dropping the UDP socket:
//!
//!   /g_freeAll <parentGroupId>
//!   /n_free    <parentGroupId>
//!   /notify    0
//!
//! `parentGroupId = clientId * 100` (with `0 → 100` fallback to match
//! the frontend's derivation in `AppShell.handleConnect`).
//!
//! This is a *safety net* — the frontend's `handleDisconnect` and
//! `pagehide` paths still fire eagerly and are usually faster. The
//! bridge cleanup catches the cases the frontend can't:
//!   - Browser crashes / SIGKILL
//!   - Network drops with TCP RST (cable yank with kernel-level reset)
//!   - Forced tab kill before pagehide flushes
//!
//! Idempotent: if the frontend cleanup already freed the group,
//! scsynth no-ops the redundant frees and returns `/fail /notify` for
//! the second `/notify 0`. We don't read the reply — fire-and-forget
//! over UDP, then sleep ~50ms so datagrams flush before we drop the
//! socket.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use rosc::{OscBundle, OscMessage, OscPacket, OscTime, OscType};
use tokio::net::UdpSocket;
use tokio::sync::Mutex;

/// How long to wait between firing the cleanup bundle and dropping
/// the local UDP socket. Generous on localhost — UDP datagrams flush
/// in microseconds — but harmless slack against any kernel-level
/// queueing on the loopback path.
const CLEANUP_FLUSH_DELAY: Duration = Duration::from_millis(50);

/// scsynth's `clientId = 0` is the single-client default; the matching
/// parent group `0 * 100 = 0` would clash with the root group, so we
/// fall back to `100`. Mirrors `FALLBACK_PARENT_GROUP_ID` in
/// `src/AppShell.tsx`.
const FALLBACK_PARENT_GROUP_ID: i32 = 100;

/// Per-session state. Lives in the WS task; drops with the task.
#[derive(Default)]
struct SessionState {
    /// Captured from the `/done /notify` reply when the frontend
    /// completes its `/notify 1` handshake. `None` until then —
    /// pre-handshake disconnects skip cleanup (nothing to clean).
    client_id: Option<i32>,
}

impl SessionState {
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

/// Bridge a single WebSocket session to a UDP socket connected to
/// `scsynth`. Returns when either side closes or errors. Fires the
/// Phase 22 cleanup bundle on the way out.
pub async fn handle_ws(ws: WebSocket, scsynth: SocketAddr) -> Result<()> {
    let (mut tx, mut rx) = ws.split();

    // Ephemeral port; `connect` pins the peer so subsequent `send` /
    // `recv` don't need the address each call.
    let sock = Arc::new(
        UdpSocket::bind("0.0.0.0:0")
            .await
            .context("bind ephemeral UDP socket")?,
    );
    sock.connect(scsynth)
        .await
        .with_context(|| format!("udp connect to {scsynth}"))?;

    let session = Arc::new(Mutex::new(SessionState::default()));

    // UDP → WS task. Snoops `/done /notify` replies for `clientId`,
    // forwards every datagram to the WS unchanged. Terminates on any
    // error; the WS half then shuts down naturally.
    let sock_recv = sock.clone();
    let session_recv = session.clone();
    let recv_task = tokio::spawn(async move {
        let mut buf = vec![0u8; 65_536];
        loop {
            match sock_recv.recv(&mut buf).await {
                Ok(n) => {
                    let payload = &buf[..n];
                    if let Some(client_id) = snoop_notify_reply(payload) {
                        let mut state = session_recv.lock().await;
                        if state.client_id.is_none() {
                            eprintln!(
                                "[ws_bridge] notify clientId={client_id} (parent group \
                                 {})",
                                if client_id > 0 {
                                    client_id * 100
                                } else {
                                    FALLBACK_PARENT_GROUP_ID
                                }
                            );
                        }
                        state.client_id = Some(client_id);
                    }
                    if let Err(e) = tx.send(Message::Binary(payload.to_vec().into())).await
                    {
                        eprintln!("ws send error: {e}");
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("udp recv error: {e}");
                    break;
                }
            }
        }
    });

    // WS → UDP loop. Returns on Close, error, or stream end (TCP
    // half-open / RST). The match-on-msg pattern is unchanged from
    // Phase 0 — Phase 22's contribution is what happens AFTER the
    // loop exits, in the cleanup tail below.
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Binary(bytes)) => {
                if let Err(e) = sock.send(&bytes).await {
                    eprintln!("udp send error: {e}");
                    break;
                }
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => {} // ignore text / ping / pong
            Err(e) => {
                eprintln!("ws recv error: {e}");
                break;
            }
        }
    }

    // ── Phase 22: cleanup tail ────────────────────────────────────────
    // Fire the cleanup bundle if we know the parent group. Best-effort
    // — UDP doesn't error on send to a non-listening peer (scsynth may
    // already be dead in some failure modes), and we never read the
    // reply anyway.
    let parent_group_id = session.lock().await.parent_group_id();
    if let Some(group_id) = parent_group_id {
        match send_cleanup(&sock, group_id).await {
            Ok(()) => {
                eprintln!("[ws_bridge] cleanup sent for clientId group {group_id}");
                // Hold the socket open briefly so kernel-side queued
                // datagrams flush before we drop it. Without this, the
                // /notify 0 occasionally races the WS close on Linux.
                tokio::time::sleep(CLEANUP_FLUSH_DELAY).await;
            }
            Err(e) => {
                eprintln!("[ws_bridge] cleanup encode/send failed: {e:#}");
            }
        }
    } else {
        // Disconnect before /done /notify arrived — frontend never
        // allocated anything (no clientId yet), so no cleanup needed.
        eprintln!("[ws_bridge] session closed pre-notify; no cleanup");
    }

    recv_task.abort();
    Ok(())
}

/// Cheap prefix check + full decode of `/done /notify <clientId>
/// [maxLogins]` replies. Returns `Some(clientId)` if matched, `None`
/// for anything else. The prefix check skips the full rosc decoder
/// for every non-`/done` reply on the hot inbound path (every
/// `/b_setn` for buffer-chunk subscriptions, etc.).
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

/// Encode + send the cleanup bundle: `/g_freeAll <parentGroupId>`,
/// `/n_free <parentGroupId>`, `/notify 0`. Wrapped in an OSC bundle
/// with `immediate` timetag so scsynth processes them atomically in
/// order.
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

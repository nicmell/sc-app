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
//! The bridge stays minimally OSC-aware: it forwards bytes verbatim
//! and delegates `/done /notify` snooping (inbound), `/notify 0`
//! snooping (outbound), and WS-close cleanup to
//! [`super::session::Session`]. The cleanup catches the cases the
//! frontend can't (browser crash, TCP RST, forced tab kill before
//! `pagehide` flushes); the eager frontend `handleDisconnect` /
//! `pagehide` paths still run first in normal use.
//!
//! ## WS-close cleanup ordering
//!
//! When the WS→UDP loop exits we:
//!
//! 1. Abort the `recv_task` *first*. Otherwise scsynth's `/fail`
//!    replies to our cleanup bundle (when one is sent) get picked up
//!    by `recv_task` and forwarded to the closed WS, producing a
//!    "Sending after closing" warning per reply. Aborting first lets
//!    those datagrams hit a closed UDP socket and the kernel drops
//!    them silently.
//! 2. Run `session.cleanup()` — which itself no-ops if the frontend
//!    already deregistered (we observed `/notify 0` outbound).

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::net::UdpSocket;

use super::session::Session;

/// Bridge a single WebSocket session to a UDP socket connected to
/// `scsynth`. Returns when either side closes or errors. Fires the
/// Phase 22 cleanup bundle on the way out (unless the frontend
/// already cleaned up).
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

    let session = Arc::new(Session::new());

    // UDP → WS task. Snoops state-relevant replies via `Session`,
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
                    session_recv.snoop(payload).await;
                    if let Err(e) = tx.send(Message::Binary(payload.to_vec().into())).await
                    {
                        tracing::warn!(error = %e, "ws send error");
                        break;
                    }
                }
                Err(e) => {
                    tracing::warn!(error = %e, "udp recv error");
                    break;
                }
            }
        }
    });

    // WS → UDP loop. Returns on Close, error, or stream end (TCP
    // half-open / RST). Each binary frame is snooped for `/notify 0`
    // before being forwarded — when seen, it flips the
    // `frontend_clean` flag so the cleanup tail skips its bundle.
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Binary(bytes)) => {
                session.snoop_outbound(&bytes).await;
                if let Err(e) = sock.send(&bytes).await {
                    tracing::warn!(error = %e, "udp send error");
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

    // Abort the recv task BEFORE running cleanup, so scsynth's
    // (potential) `/fail` replies to our cleanup bundle don't get
    // forwarded to a closed WS. See module-level comment.
    recv_task.abort();
    session.cleanup(&sock).await;
    Ok(())
}

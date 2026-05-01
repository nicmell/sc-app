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
//! and delegates `/done /notify` snooping + WS-close cleanup to
//! [`super::session::Session`]. The cleanup catches the cases the
//! frontend can't (browser crash, TCP RST, forced tab kill before
//! `pagehide` flushes); the eager frontend `handleDisconnect` /
//! `pagehide` paths still run first in normal use.

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::net::UdpSocket;

use super::session::Session;

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
    // half-open / RST).
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Binary(bytes)) => {
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

    session.cleanup(&sock).await;
    recv_task.abort();
    Ok(())
}

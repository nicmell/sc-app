//! Phase 0 — per-session WebSocket ↔ UDP bridge.
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

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::net::UdpSocket;

/// Bridge a single WebSocket session to a UDP socket connected to
/// `scsynth`. Returns when either side closes or errors.
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

    // UDP → WS task. Terminates on any error; the WS half will then
    // shut down naturally as the socket pair drops.
    let sock_recv = sock.clone();
    let recv_task = tokio::spawn(async move {
        let mut buf = vec![0u8; 65_536];
        loop {
            match sock_recv.recv(&mut buf).await {
                Ok(n) => {
                    let payload = buf[..n].to_vec();
                    if let Err(e) = tx.send(Message::Binary(payload.into())).await {
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

    // WS → UDP loop.
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

    recv_task.abort();
    Ok(())
}

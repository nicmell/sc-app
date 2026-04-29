//! Phase 25a — per-session WebSocket ↔ UDP bridge for SuperDirt.
//!
//! Mirrors [`ws_bridge`](super::ws_bridge) but with the UDP peer fully
//! driven by the WS query params (no default — SuperDirt is opt-in,
//! enabled per connection by the browser-side Dirt panel). Each
//! connection gets its own ephemeral local UDP socket connected to
//! `host:port`. Lifecycle ends on WS close (any reason): UDP socket
//! drops, recv task aborts.
//!
//! Why a separate file: the scsynth bridge is on the buffer-chunk hot
//! path (`/b_setn` at 48+ Hz). Dirt traffic is sparse and small. They
//! share the same shape today but their concerns may diverge — keep
//! them disjoint so changes to one don't ripple into the other.

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::net::UdpSocket;

/// Bridge a single WebSocket session to a UDP socket connected to a
/// SuperDirt instance at `dirt`. Returns when either side closes or
/// errors.
pub async fn handle_ws(ws: WebSocket, dirt: SocketAddr) -> Result<()> {
    let (mut tx, mut rx) = ws.split();

    let sock = Arc::new(
        UdpSocket::bind("0.0.0.0:0")
            .await
            .context("bind ephemeral UDP socket")?,
    );
    sock.connect(dirt)
        .await
        .with_context(|| format!("udp connect to {dirt}"))?;

    // UDP → WS task. Terminates on any error; the WS half then shuts
    // down naturally as the socket pair drops.
    let sock_recv = sock.clone();
    let recv_task = tokio::spawn(async move {
        let mut buf = vec![0u8; 65_536];
        loop {
            match sock_recv.recv(&mut buf).await {
                Ok(n) => {
                    let payload = buf[..n].to_vec();
                    if let Err(e) = tx.send(Message::Binary(payload.into())).await {
                        eprintln!("ws_dirt: ws send error: {e}");
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("ws_dirt: udp recv error: {e}");
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
                    eprintln!("ws_dirt: udp send error: {e}");
                    break;
                }
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => {} // ignore text / ping / pong
            Err(e) => {
                eprintln!("ws_dirt: ws recv error: {e}");
                break;
            }
        }
    }

    recv_task.abort();
    Ok(())
}

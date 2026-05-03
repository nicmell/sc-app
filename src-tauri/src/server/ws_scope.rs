//! Phase 31 (post-shipping): per-scope WebSocket endpoint.
//!
//! Each scope subscription opens its own WS at
//! `/ws/scope?session=<uuid>&scope=<idx>&channels=<n>&chunkSize=<m>&bufferId=<id>`.
//! The handler:
//!
//! 1. Validates the session UUID and looks up the [`Session`].
//! 2. Lazily opens (via [`Session::ensure_scope_shm`]) the SHM
//!    scope-buffer pool. Multiple scope WSs on the same Session
//!    share one mapping.
//! 3. Subscribes to the session's default-route broadcast channel.
//!    On every observed `/clock/tick` reply, polls SHM for THIS
//!    subscription's `scope_idx` and pushes a binary frame to the
//!    WS if `_stage` advanced since last poll.
//! 4. Closes cleanly when the WS closes (drops the broadcast
//!    subscription, exits).
//!
//! Wire format per scope-WS message (one chunk per frame):
//!
//! ```text
//! [tick_index:u32_le | is_gap:u8 | channels:u8 | frame_count:u32_le | float32_le payload]
//! ```
//!
//! Total fixed header = 10 bytes. Payload = `frame_count × channels × 4` bytes
//! (interleaved float32 little-endian). `bufferId` is implicit (one per WS,
//! known to both endpoints from the URL); not in the frame.

use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use futures_util::stream::StreamExt;
use futures_util::SinkExt;
use serde::Deserialize;
use tokio::sync::broadcast;
use uuid::Uuid;

use super::routing::peek_osc_address;
use super::AppState;
use crate::scope_shm::{self, ScopeReadResult};

/// Query parameters for `/ws/scope`. Captured before the WS
/// upgrade; if anything is missing or malformed the upgrade
/// rejects with a clear 400.
#[derive(Debug, Deserialize)]
pub struct ScopeWsQuery {
    pub session: Uuid,
    pub scope: u32,
    pub channels: u32,
    #[serde(rename = "chunkSize")]
    pub chunk_size: u32,
    #[serde(rename = "bufferId")]
    pub buffer_id: String,
}

pub(crate) async fn ws_scope_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(q): Query<ScopeWsQuery>,
    headers: HeaderMap,
) -> Response {
    // Phase 34: same loopback-Origin check as the main /ws
    // upgrade — WS upgrades aren't subject to SOP the way `fetch`
    // is, so a hostile site could otherwise open a /ws/scope
    // connection directly.
    if let Err((status, msg)) = super::security::check_ws_origin(&headers) {
        return (status, msg).into_response();
    }
    let session = match state.sessions.get_and_touch(&q.session).await {
        Some(s) => s,
        None => {
            tracing::warn!(
                session_id = %q.session,
                "ws/scope: unknown session id"
            );
            return axum::http::StatusCode::NOT_FOUND.into_response();
        }
    };

    ws.on_upgrade(move |socket| async move {
        if let Err(e) = run_scope_ws(socket, session, q).await {
            tracing::warn!(error = %e, "ws/scope task ended with error");
        }
    })
}

async fn run_scope_ws(
    ws: WebSocket,
    session: Arc<super::session::Session>,
    q: ScopeWsQuery,
) -> Result<()> {
    let shm = session
        .ensure_scope_shm()
        .await
        .with_context(|| "ensure_scope_shm")?;
    let layout = &shm.layout;
    if (q.scope as usize) >= layout.count {
        return Err(anyhow!(
            "scope index {} out of range (layout count {})",
            q.scope,
            layout.count
        ));
    }

    let receiver = session
        .broadcast_senders
        .get(&session.scsynth_addr)
        .ok_or_else(|| anyhow!("default-route broadcast channel missing"))?
        .subscribe();

    tracing::debug!(
        session_id = %session.session_id,
        buffer_id = %q.buffer_id,
        scope_idx = q.scope,
        channels = q.channels,
        chunk_size = q.chunk_size,
        "ws/scope subscription established"
    );

    let (mut tx, mut rx) = ws.split();
    let mut last_seen_stage: i32 = -1;
    let mut tick_index: u32 = 0;
    let mut receiver = receiver;

    loop {
        tokio::select! {
            // Watch for client close so we exit promptly.
            ws_msg = rx.next() => {
                match ws_msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {} // ignore client → server traffic
                    Some(Err(e)) => {
                        tracing::debug!(error = %e, "ws/scope client recv error");
                        break;
                    }
                }
            }
            // Pump the broadcast stream looking for /clock/tick.
            recv = receiver.recv() => {
                let payload = match recv {
                    Ok(p) => p,
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        tracing::warn!(
                            skipped,
                            buffer_id = %q.buffer_id,
                            "ws/scope broadcast lagged; some ticks dropped"
                        );
                        continue;
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                };
                if peek_osc_address(&payload) != Some("/clock/tick") {
                    continue;
                }
                tick_index = tick_index.wrapping_add(1);

                let result = scope_shm::read_scope_slot(
                    &shm.region,
                    &shm.layout,
                    q.scope as usize,
                );
                let (data, channels, frames, stage) = match result {
                    Ok(ScopeReadResult::Data { floats, channels, frames, stage }) => {
                        (floats, channels, frames, stage)
                    }
                    Ok(_) => continue,
                    Err(e) => {
                        tracing::debug!(
                            error = %e,
                            buffer_id = %q.buffer_id,
                            "ws/scope slot read failed"
                        );
                        continue;
                    }
                };
                if stage as i32 == last_seen_stage {
                    continue; // writer hasn't advanced since last poll
                }
                last_seen_stage = stage as i32;

                let frame = encode_scope_frame(
                    tick_index,
                    false,
                    channels.min(255) as u8,
                    frames as u32,
                    &data,
                );
                if let Err(e) = tx.send(Message::Binary(frame.into())).await {
                    tracing::debug!(error = %e, "ws/scope send failed (closed?)");
                    break;
                }
            }
        }
    }

    tracing::debug!(
        session_id = %session.session_id,
        buffer_id = %q.buffer_id,
        "ws/scope subscription ended"
    );
    Ok(())
}

/// Encode one scope chunk frame for the per-scope WS. See
/// module-level docs for the wire layout.
fn encode_scope_frame(
    tick_index: u32,
    is_gap: bool,
    channels: u8,
    frame_count: u32,
    interleaved_floats: &[f32],
) -> Vec<u8> {
    let mut out = Vec::with_capacity(10 + interleaved_floats.len() * 4);
    out.extend_from_slice(&tick_index.to_le_bytes());
    out.push(if is_gap { 1 } else { 0 });
    out.push(channels);
    out.extend_from_slice(&frame_count.to_le_bytes());
    for &f in interleaved_floats {
        out.extend_from_slice(&f.to_le_bytes());
    }
    out
}


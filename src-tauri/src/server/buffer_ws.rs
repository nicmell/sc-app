use crate::ipc::buffer::{BufferStreamState, WsSink};
use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use http_body_util::Full;
use hyper::body::Incoming;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

pub fn handle_ws_upgrade(
    req: Request<Incoming>,
    bufnum: i32,
    scsynth_addr: &str,
    state: Arc<BufferStreamState>,
) -> Response<Full<Bytes>> {
    let key = match req.headers().get("sec-websocket-key") {
        Some(k) => k.as_bytes().to_vec(),
        None => {
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header("content-type", "text/plain")
                .body(Full::new(Bytes::from("Missing Sec-WebSocket-Key")))
                .unwrap()
        }
    };

    let accept = tokio_tungstenite::tungstenite::handshake::derive_accept_key(&key);
    let addr = scsynth_addr.to_string();

    tokio::spawn(async move {
        match hyper::upgrade::on(req).await {
            Ok(upgraded) => handle_ws_connection(upgraded, bufnum, addr, state).await,
            Err(e) => eprintln!("Buffer WS upgrade error: {e}"),
        }
    });

    Response::builder()
        .status(StatusCode::SWITCHING_PROTOCOLS)
        .header("upgrade", "websocket")
        .header("connection", "Upgrade")
        .header("sec-websocket-accept", accept)
        .body(Full::new(Bytes::new()))
        .unwrap()
}

async fn handle_ws_connection(
    upgraded: hyper::upgrade::Upgraded,
    bufnum: i32,
    scsynth_addr: String,
    state: Arc<BufferStreamState>,
) {
    let ws = tokio_tungstenite::WebSocketStream::from_raw_socket(
        TokioIo::new(upgraded),
        tokio_tungstenite::tungstenite::protocol::Role::Server,
        None,
    )
    .await;

    let (mut ws_sink, mut ws_stream) = ws.split();

    // Wait for initial config frame: [bufnum i32 LE, chunk i32 LE, frames i32 LE]
    let config = match ws_stream.next().await {
        Some(Ok(Message::Binary(data))) if data.len() >= 12 => data,
        _ => return,
    };
    let client_bufnum = i32::from_le_bytes(config[0..4].try_into().unwrap());
    let chunk = i32::from_le_bytes(config[4..8].try_into().unwrap());
    let frames = i32::from_le_bytes(config[8..12].try_into().unwrap());

    if client_bufnum != bufnum {
        eprintln!("Buffer WS: bufnum mismatch (url {bufnum}, config {client_bufnum})");
        return;
    }

    let (tx, mut rx) = mpsc::channel::<Message>(4);
    let sink = Box::new(WsSink { tx });
    let sub_id = match state.subscribe(bufnum, frames, chunk, &scsynth_addr, sink).await {
        Ok(id) => id,
        Err(e) => {
            eprintln!("Buffer WS subscribe failed: {e}");
            return;
        }
    };

    // Forward outbound ticks from the reader to the WS client.
    let mut pump = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sink.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Drain inbound frames; exit when the client closes.
    let mut drain = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_stream.next().await {
            if matches!(msg, Message::Close(_)) {
                break;
            }
        }
    });

    tokio::select! {
        _ = &mut pump => drain.abort(),
        _ = &mut drain => pump.abort(),
    }

    state.unsubscribe(sub_id).await;
}

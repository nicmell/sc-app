use crate::ipc::buffer::WsSink;
use crate::recording::state::RecordingState;
use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use http_body_util::Full;
use hyper::body::Incoming;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

pub fn handle_ws_upgrade(
    req: Request<Incoming>,
    id: String,
    data_dir: PathBuf,
    state: Arc<RecordingState>,
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

    tokio::spawn(async move {
        match hyper::upgrade::on(req).await {
            Ok(upgraded) => handle_ws_connection(upgraded, id, data_dir, state).await,
            Err(e) => eprintln!("Recording WS upgrade error: {e}"),
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
    id: String,
    data_dir: PathBuf,
    state: Arc<RecordingState>,
) {
    let ws = tokio_tungstenite::WebSocketStream::from_raw_socket(
        TokioIo::new(upgraded),
        tokio_tungstenite::tungstenite::protocol::Role::Server,
        None,
    )
    .await;

    let (mut ws_sink, mut ws_stream) = ws.split();

    let (tx, mut rx) = mpsc::channel::<Message>(4);
    let sink = Box::new(WsSink { tx });
    if let Err(e) = state.start_tail(&data_dir, &id, sink).await {
        eprintln!("recording tail start failed ({id}): {e}");
        return;
    }

    let mut pump = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sink.send(msg).await.is_err() {
                break;
            }
        }
    });

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

    state.stop_tail(&id).await;
}

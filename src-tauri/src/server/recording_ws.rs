use crate::ipc::buffer::{BufferStreamState, WsSink};
use crate::recording;
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
    scsynth_addr: String,
    buffer_state: Arc<BufferStreamState>,
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
            Ok(upgraded) => {
                handle_ws_connection(upgraded, id, data_dir, scsynth_addr, buffer_state).await
            }
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
    scsynth_addr: String,
    buffer_state: Arc<BufferStreamState>,
) {
    let ws = tokio_tungstenite::WebSocketStream::from_raw_socket(
        TokioIo::new(upgraded),
        tokio_tungstenite::tungstenite::protocol::Role::Server,
        None,
    )
    .await;

    let (mut ws_sink, mut ws_stream) = ws.split();

    // Config header: [bufnum i32, chunk i32, frames i32, sampleRate i32, channels i32] (20 bytes LE).
    let config = match ws_stream.next().await {
        Some(Ok(Message::Binary(data))) if data.len() >= 20 => data,
        _ => return,
    };
    let bufnum = i32::from_le_bytes(config[0..4].try_into().unwrap());
    let chunk = i32::from_le_bytes(config[4..8].try_into().unwrap());
    let frames = i32::from_le_bytes(config[8..12].try_into().unwrap());
    let sample_rate = i32::from_le_bytes(config[12..16].try_into().unwrap()).max(0) as u32;
    let channels = i32::from_le_bytes(config[16..20].try_into().unwrap()).max(1) as u16;

    let (tx, mut rx) = mpsc::channel::<Message>(4);
    let inner: Box<dyn crate::ipc::buffer::BufferSink> = Box::new(WsSink { tx });
    let sub_id = match recording::state::start_stream(
        &data_dir,
        &id,
        bufnum,
        frames,
        chunk,
        sample_rate,
        channels,
        &scsynth_addr,
        inner,
        &buffer_state,
    )
    .await
    {
        Ok(id) => id,
        Err(e) => {
            eprintln!("recording WS start failed ({id}): {e}");
            return;
        }
    };

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

    buffer_state.unsubscribe(sub_id).await;
}

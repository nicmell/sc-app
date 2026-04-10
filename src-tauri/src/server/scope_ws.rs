//! WebSocket endpoint for real-time scope buffer reads.
//!
//! Protocol (binary):
//!   Request:  [bufnum: i32 LE, count: i32 LE]  (8 bytes)
//!   Response: [f32 LE, f32 LE, ...]             (count * 4 bytes)
//!
//! Used by both the standalone HTTP server (via hyper upgrade) and the
//! embedded Tauri scope server (via raw TcpStream).

use crate::ipc::buf_reader;
use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use http_body_util::Full;
use hyper::body::Incoming;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::Message;

/// Start a standalone scope WebSocket server on an ephemeral port.
/// Returns the bound port. The server runs in the background.
pub async fn start_server(scsynth_addr: String) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind scope WS server: {e}"))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local addr: {e}"))?
        .port();

    tokio::spawn(async move {
        loop {
            if let Ok((stream, _)) = listener.accept().await {
                let addr = scsynth_addr.clone();
                tokio::spawn(async move {
                    accept_tcp(stream, addr).await;
                });
            }
        }
    });

    Ok(port)
}

/// Accept a raw TCP connection and upgrade to WebSocket.
async fn accept_tcp(stream: TcpStream, scsynth_addr: String) {
    let ws = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("Scope WS accept error: {e}");
            return;
        }
    };

    run_scope_loop(ws, scsynth_addr).await;
}

/// Handle a hyper HTTP upgrade to WebSocket (used by the standalone server).
pub fn handle_ws_upgrade(
    req: Request<Incoming>,
    scsynth_addr: &str,
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
    let scsynth_addr = scsynth_addr.to_string();

    tokio::spawn(async move {
        match hyper::upgrade::on(req).await {
            Ok(upgraded) => {
                let ws = tokio_tungstenite::WebSocketStream::from_raw_socket(
                    TokioIo::new(upgraded),
                    tokio_tungstenite::tungstenite::protocol::Role::Server,
                    None,
                )
                .await;
                run_scope_loop(ws, scsynth_addr).await;
            }
            Err(e) => eprintln!("Scope WS upgrade error: {e}"),
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

/// Core scope read loop — shared by both TCP accept and hyper upgrade paths.
async fn run_scope_loop<S>(ws: tokio_tungstenite::WebSocketStream<S>, scsynth_addr: String)
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    let (mut sink, mut stream) = ws.split();

    while let Some(Ok(msg)) = stream.next().await {
        let data = match msg {
            Message::Binary(d) => d,
            Message::Close(_) => break,
            _ => continue,
        };

        if data.len() < 8 {
            continue;
        }
        let bufnum = i32::from_le_bytes([data[0], data[1], data[2], data[3]]);
        let count = i32::from_le_bytes([data[4], data[5], data[6], data[7]]);

        let bytes = match buf_reader::read_buffer(&scsynth_addr, bufnum, 0, count).await {
            Ok(floats) => {
                let mut buf = Vec::with_capacity(floats.len() * 4);
                for f in &floats {
                    buf.extend_from_slice(&f.to_le_bytes());
                }
                buf
            }
            Err(_) => Vec::new(),
        };

        if sink.send(Message::Binary(bytes.into())).await.is_err() {
            break;
        }
    }
}

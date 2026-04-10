use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use http_body_util::Full;
use hyper::body::Incoming;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio_tungstenite::tungstenite::Message;

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
                handle_ws_connection(upgraded, scsynth_addr).await;
            }
            Err(e) => eprintln!("WebSocket upgrade error: {e}"),
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

async fn handle_ws_connection(upgraded: hyper::upgrade::Upgraded, scsynth_addr: String) {
    let ws = tokio_tungstenite::WebSocketStream::from_raw_socket(
        TokioIo::new(upgraded),
        tokio_tungstenite::tungstenite::protocol::Role::Server,
        None,
    )
    .await;

    let udp = match UdpSocket::bind("0.0.0.0:0").await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to bind UDP socket: {e}");
            return;
        }
    };

    if let Err(e) = udp.connect(&scsynth_addr).await {
        eprintln!("Failed to connect UDP to {scsynth_addr}: {e}");
        return;
    }

    let udp = Arc::new(udp);
    let (mut ws_sink, mut ws_stream) = ws.split();

    // WS → UDP
    let udp_send = udp.clone();
    let mut ws_to_udp = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_stream.next().await {
            match msg {
                Message::Binary(data) => {
                    if let Err(e) = udp_send.send(&data).await {
                        eprintln!("UDP send error: {e}");
                        break;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // UDP → WS
    let udp_recv = udp.clone();
    let mut udp_to_ws = tokio::spawn(async move {
        let mut buf = [0u8; 65536];
        loop {
            match udp_recv.recv(&mut buf).await {
                Ok(n) => {
                    if ws_sink
                        .send(Message::Binary(buf[..n].to_vec().into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("UDP recv error: {e}");
                    break;
                }
            }
        }
    });

    tokio::select! {
        _ = &mut ws_to_udp => { udp_to_ws.abort(); }
        _ = &mut udp_to_ws => { ws_to_udp.abort(); }
    }
}

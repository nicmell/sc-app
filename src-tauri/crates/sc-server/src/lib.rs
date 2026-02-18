use futures_util::{SinkExt, StreamExt};
use http_body_util::Full;
use hyper::body::{Bytes, Incoming};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use sc_plugin::plugin_server::read_plugin_file;
use sc_plugin::validation::{validate_plugin, PluginInfo};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::net::{TcpListener, UdpSocket};
use tokio_tungstenite::tungstenite::Message;

pub struct ServeConfig {
    pub dist_dir: PathBuf,
    pub port: u16,
    pub host: String,
    pub scsynth_addr: String,
}

struct AppState {
    dist_dir: PathBuf,
    scsynth_addr: String,
    data_dir: PathBuf,
}

pub async fn run(config: ServeConfig) -> Result<(), String> {
    let data_dir = data_dir()?;

    let state = Arc::new(AppState {
        dist_dir: config.dist_dir,
        scsynth_addr: config.scsynth_addr,
        data_dir,
    });

    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .map_err(|e| format!("Invalid address: {e}"))?;

    let listener = TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind {addr}: {e}"))?;

    println!("Serving on http://{addr}");

    loop {
        let (stream, _) = listener
            .accept()
            .await
            .map_err(|e| format!("Accept failed: {e}"))?;

        let io = TokioIo::new(stream);
        let state = state.clone();

        tokio::spawn(async move {
            let service = service_fn(move |req| {
                let state = state.clone();
                async move { handle_request(req, &state).await }
            });
            if let Err(e) = http1::Builder::new()
                .serve_connection(io, service)
                .with_upgrades()
                .await
            {
                if !e.is_incomplete_message() {
                    eprintln!("Connection error: {e}");
                }
            }
        });
    }
}

async fn handle_request(
    req: Request<Incoming>,
    state: &AppState,
) -> Result<Response<Full<Bytes>>, hyper::Error> {
    let path = req.uri().path().to_string();

    // WebSocket upgrade — check for upgrade header on any path
    let is_ws_upgrade = req
        .headers()
        .get("upgrade")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.eq_ignore_ascii_case("websocket"))
        .unwrap_or(false);

    if is_ws_upgrade {
        return Ok(handle_ws_upgrade(req, state));
    }

    // Collect body for non-WS requests
    let method = req.method().clone();

    match (&method, path.as_str()) {
        (&Method::GET, p) if p.starts_with("/plugins/") => {
            Ok(handle_plugin_file(p, state))
        }
        (&Method::GET, "/api/config") => Ok(handle_get_config(state)),
        (&Method::POST, "/api/config") => {
            let body = collect_body(req).await;
            Ok(handle_post_config(state, &body))
        }
        (&Method::POST, "/api/plugins") => {
            let body = collect_body(req).await;
            Ok(handle_add_plugin(state, &body))
        }
        (&Method::DELETE, p) if p.starts_with("/api/plugins/") => {
            Ok(handle_remove_plugin(p, state))
        }
        (&Method::GET, _) => Ok(serve_static(&path, state)),
        _ => Ok(json_response(StatusCode::METHOD_NOT_ALLOWED, r#"{"error":"method not allowed"}"#)),
    }
}

// --- WebSocket handler ---

fn handle_ws_upgrade(
    req: Request<Incoming>,
    state: &AppState,
) -> Response<Full<Bytes>> {
    let key = match req.headers().get("sec-websocket-key") {
        Some(k) => k.as_bytes().to_vec(),
        None => return text_response(StatusCode::BAD_REQUEST, "Missing Sec-WebSocket-Key"),
    };

    let accept = tokio_tungstenite::tungstenite::handshake::derive_accept_key(&key);
    let scsynth_addr = state.scsynth_addr.clone();

    // Spawn task to handle the upgraded connection
    tokio::spawn(async move {
        match hyper::upgrade::on(req).await {
            Ok(upgraded) => {
                handle_websocket_connection(upgraded, scsynth_addr).await;
            }
            Err(e) => eprintln!("WebSocket upgrade error: {e}"),
        }
    });

    // Return 101 Switching Protocols
    Response::builder()
        .status(StatusCode::SWITCHING_PROTOCOLS)
        .header("upgrade", "websocket")
        .header("connection", "Upgrade")
        .header("sec-websocket-accept", accept)
        .body(Full::new(Bytes::new()))
        .unwrap()
}

async fn handle_websocket_connection(
    upgraded: hyper::upgrade::Upgraded,
    scsynth_addr: String,
) {
    let ws = tokio_tungstenite::WebSocketStream::from_raw_socket(
        TokioIo::new(upgraded),
        tokio_tungstenite::tungstenite::protocol::Role::Server,
        None,
    )
    .await;

    // Bind a UDP socket for this connection
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
                _ => {} // ignore text/ping/pong
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

    // Wait for either task to finish, then abort the other
    tokio::select! {
        _ = &mut ws_to_udp => { udp_to_ws.abort(); }
        _ = &mut udp_to_ws => { ws_to_udp.abort(); }
    }
}

// --- Plugin file serving ---

fn handle_plugin_file(path: &str, state: &AppState) -> Response<Full<Bytes>> {
    // Path format: /plugins/{name}/{version}/{file_path...}
    let stripped = path.strip_prefix("/plugins/").unwrap_or("");
    let parts: Vec<&str> = stripped.splitn(3, '/').collect();
    if parts.len() < 3 {
        return text_response(StatusCode::NOT_FOUND, "Not found");
    }

    let (name, version, file_path) = (parts[0], parts[1], parts[2]);
    let plugins_dir = state.data_dir.join("plugins");

    match read_plugin_file(&plugins_dir, name, version, file_path) {
        Ok((content, content_type)) => Response::builder()
            .status(StatusCode::OK)
            .header("content-type", content_type)
            .header("access-control-allow-origin", "*")
            .body(Full::new(Bytes::from(content)))
            .unwrap(),
        Err(e) => text_response(
            StatusCode::from_u16(e.status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            &e.to_string(),
        ),
    }
}

// --- Config API ---

fn config_path(state: &AppState) -> PathBuf {
    state.data_dir.join("config.json")
}

fn handle_get_config(state: &AppState) -> Response<Full<Bytes>> {
    let path = config_path(state);
    let text = match std::fs::read_to_string(&path) {
        Ok(t) => t,
        Err(_) => "{}".to_string(),
    };
    json_response(StatusCode::OK, &text)
}

fn handle_post_config(state: &AppState, body: &[u8]) -> Response<Full<Bytes>> {
    // Validate JSON
    let value: serde_json::Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(e) => return json_response(StatusCode::BAD_REQUEST, &format!(r#"{{"error":"{e}"}}"#)),
    };

    let path = config_path(state);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let json = serde_json::to_string_pretty(&value).unwrap_or_default();
    match std::fs::write(&path, json) {
        Ok(()) => json_response(StatusCode::OK, r#"{"ok":true}"#),
        Err(e) => json_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!(r#"{{"error":"{e}"}}"#),
        ),
    }
}

// --- Plugin management API ---

fn handle_add_plugin(state: &AppState, body: &[u8]) -> Response<Full<Bytes>> {
    let info = match validate_plugin(body) {
        Ok(i) => i,
        Err(e) => return json_response(StatusCode::BAD_REQUEST, &format!(r#"{{"error":"{e}"}}"#)),
    };

    let plugins_dir = state.data_dir.join("plugins");
    let _ = std::fs::create_dir_all(&plugins_dir);

    let zip_path = plugins_dir.join(format!("{}-{}.zip", &info.name, &info.version));
    if let Err(e) = std::fs::write(&zip_path, body) {
        return json_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!(r#"{{"error":"{e}"}}"#),
        );
    }

    // Update config.json
    if let Err(e) = persist_plugin_entry(&state.data_dir, &info) {
        return json_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!(r#"{{"error":"{e}"}}"#),
        );
    }

    let json = serde_json::to_string(&info).unwrap_or_default();
    json_response(StatusCode::OK, &json)
}

fn handle_remove_plugin(path: &str, state: &AppState) -> Response<Full<Bytes>> {
    let id = path.strip_prefix("/api/plugins/").unwrap_or("");
    if id.is_empty() {
        return json_response(StatusCode::BAD_REQUEST, r#"{"error":"missing plugin id"}"#);
    }

    let config_path = config_path(state);
    let mut config: serde_json::Value = match std::fs::read_to_string(&config_path) {
        Ok(t) => serde_json::from_str(&t).unwrap_or(serde_json::json!({})),
        Err(_) => serde_json::json!({}),
    };

    let plugins = match config
        .as_object_mut()
        .and_then(|o| o.get_mut("plugins"))
        .and_then(|v| v.as_array_mut())
    {
        Some(a) => a,
        None => return json_response(StatusCode::NOT_FOUND, r#"{"error":"plugin not found"}"#),
    };

    let idx = match plugins
        .iter()
        .position(|p| p.get("id").and_then(|v| v.as_str()) == Some(id))
    {
        Some(i) => i,
        None => return json_response(StatusCode::NOT_FOUND, r#"{"error":"plugin not found"}"#),
    };

    let entry = &plugins[idx];
    let name = entry.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let version = entry.get("version").and_then(|v| v.as_str()).unwrap_or("");
    let stem = format!("{name}-{version}");

    plugins.remove(idx);

    let json = serde_json::to_string_pretty(&config).unwrap_or_default();
    let _ = std::fs::write(&config_path, json);

    let zip_path = state.data_dir.join("plugins").join(format!("{stem}.zip"));
    if zip_path.exists() {
        let _ = std::fs::remove_file(&zip_path);
    }

    json_response(StatusCode::OK, r#"{"ok":true}"#)
}

fn persist_plugin_entry(data_dir: &Path, info: &PluginInfo) -> Result<(), String> {
    let config_path = data_dir.join("config.json");
    let mut config: serde_json::Value = match std::fs::read_to_string(&config_path) {
        Ok(t) => serde_json::from_str(&t).unwrap_or(serde_json::json!({})),
        Err(_) => serde_json::json!({}),
    };

    let plugins = config
        .as_object_mut()
        .ok_or("config root must be an object")?
        .entry("plugins")
        .or_insert_with(|| serde_json::json!([]))
        .as_array_mut()
        .ok_or("plugins must be an array")?;

    plugins.retain(|p| {
        !(p.get("name").and_then(|v| v.as_str()) == Some(&info.name)
            && p.get("version").and_then(|v| v.as_str()) == Some(&info.version))
    });

    plugins.push(serde_json::to_value(info).map_err(|e| e.to_string())?);

    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&config_path, json).map_err(|e| e.to_string())
}

// --- Static file serving ---

fn serve_static(path: &str, state: &AppState) -> Response<Full<Bytes>> {
    let relative = path.trim_start_matches('/');
    let file_path = if relative.is_empty() {
        state.dist_dir.join("index.html")
    } else {
        state.dist_dir.join(relative)
    };

    // If the file exists, serve it; otherwise SPA fallback to index.html
    let target = if file_path.is_file() {
        file_path
    } else {
        state.dist_dir.join("index.html")
    };

    match std::fs::read(&target) {
        Ok(data) => {
            let mime = guess_mime(&target);
            Response::builder()
                .status(StatusCode::OK)
                .header("content-type", mime)
                .body(Full::new(Bytes::from(data)))
                .unwrap()
        }
        Err(_) => text_response(StatusCode::NOT_FOUND, "Not found"),
    }
}

fn guess_mime(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") | Some("mjs") => "application/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("svg") => "image/svg+xml",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ico") => "image/x-icon",
        Some("wasm") => "application/wasm",
        _ => "application/octet-stream",
    }
}

// --- Helpers ---

async fn collect_body(req: Request<Incoming>) -> Vec<u8> {
    use http_body_util::BodyExt;
    match req.into_body().collect().await {
        Ok(collected) => collected.to_bytes().to_vec(),
        Err(_) => Vec::new(),
    }
}

fn text_response(status: StatusCode, body: &str) -> Response<Full<Bytes>> {
    Response::builder()
        .status(status)
        .header("content-type", "text/plain")
        .body(Full::new(Bytes::from(body.to_string())))
        .unwrap()
}

fn json_response(status: StatusCode, body: &str) -> Response<Full<Bytes>> {
    Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .header("access-control-allow-origin", "*")
        .body(Full::new(Bytes::from(body.to_string())))
        .unwrap()
}

fn data_dir() -> Result<PathBuf, String> {
    const APP_IDENTIFIER: &str = "com.nicmell.scapp";

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        Ok(PathBuf::from(home)
            .join("Library/Application Support")
            .join(APP_IDENTIFIER))
    }
    #[cfg(target_os = "linux")]
    {
        let dir = std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_default();
            format!("{home}/.local/share")
        });
        Ok(PathBuf::from(dir).join(APP_IDENTIFIER))
    }
    #[cfg(target_os = "windows")]
    {
        let dir = std::env::var("APPDATA").map_err(|_| "APPDATA not set".to_string())?;
        Ok(PathBuf::from(dir).join(APP_IDENTIFIER))
    }
    #[cfg(target_os = "android")]
    {
        let dir = std::env::var("HOME").unwrap_or_else(|_| "/data/data/com.nicmell.scapp".to_string());
        Ok(PathBuf::from(dir))
    }
}

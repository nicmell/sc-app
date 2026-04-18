mod buffer_ws;
mod recording_ws;
mod ws_bridge;

use crate::ipc::buffer::BufferStreamState;
use crate::{config, plugin, recording};
use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::net::TcpListener;

struct AppState {
    context: tauri::Context,
    data_dir: PathBuf,
    scsynth_addr: String,
    buffer_streams: Arc<BufferStreamState>,
}

pub fn serve(context: tauri::Context, port: u16, scsynth_addr: String) {
    let data_dir = config::data_dir().expect("failed to resolve app data dir");

    println!("Serving on http://localhost:{port}");
    println!("scsynth target: {scsynth_addr}");

    let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
    if let Err(e) = rt.block_on(run(context, data_dir, port, scsynth_addr)) {
        eprintln!("Server error: {e}");
        std::process::exit(1);
    }
}

async fn run(
    context: tauri::Context,
    data_dir: PathBuf,
    port: u16,
    scsynth_addr: String,
) -> Result<(), String> {
    let state = Arc::new(AppState {
        context,
        data_dir,
        scsynth_addr,
        buffer_streams: Arc::new(BufferStreamState::new()),
    });

    let addr: SocketAddr = format!("0.0.0.0:{port}")
        .parse()
        .map_err(|e| format!("Invalid address: {e}"))?;

    let listener = TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind {addr}: {e}"))?;

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

    // WebSocket upgrade
    let is_ws_upgrade = req
        .headers()
        .get("upgrade")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.eq_ignore_ascii_case("websocket"))
        .unwrap_or(false);

    if is_ws_upgrade {
        if let Some(rest) = path.strip_prefix("/buffer/") {
            if let Ok(bufnum) = rest.parse::<i32>() {
                return Ok(buffer_ws::handle_ws_upgrade(
                    req,
                    bufnum,
                    &state.scsynth_addr,
                    state.buffer_streams.clone(),
                ));
            }
        }
        if let Some(rest) = path.strip_prefix("/recordings/") {
            if let Some(id) = rest.strip_suffix("/stream") {
                return Ok(recording_ws::handle_ws_upgrade(
                    req,
                    id.to_string(),
                    state.data_dir.clone(),
                    state.scsynth_addr.clone(),
                    state.buffer_streams.clone(),
                ));
            }
        }
        return Ok(ws_bridge::handle_ws_upgrade(req, &state.scsynth_addr));
    }

    // Plugins: bridge to plugin::router.
    if let Some(inner) = path.strip_prefix("/plugins") {
        return Ok(bridge_router(req, inner, &state.data_dir, plugin::router::handle).await);
    }
    // Recordings: bridge to recording::router.
    if let Some(inner) = path.strip_prefix("/recordings") {
        return Ok(bridge_router(req, inner, &state.data_dir, recording::router::handle).await);
    }

    // Static asset serving with SPA fallback
    Ok(serve_asset(&path, &state.context))
}

/// Generic bridge from a `hyper` request to a `http`-crate Request/Response
/// router (the shared plugin/recording router surface).
async fn bridge_router(
    req: Request<Incoming>,
    inner_path: &str,
    data_dir: &Path,
    router: fn(&Path, &http::Request<Vec<u8>>) -> http::Response<Vec<u8>>,
) -> Response<Full<Bytes>> {
    let uri = if inner_path.is_empty() { "/" } else { inner_path };
    let method = req.method().clone();
    let headers = req.headers().clone();
    let body_bytes = match req.into_body().collect().await {
        Ok(collected) => collected.to_bytes().to_vec(),
        Err(_) => Vec::new(),
    };
    let mut builder = http::Request::builder().method(method).uri(uri);
    for (k, v) in &headers {
        builder = builder.header(k, v);
    }
    let http_req = builder.body(body_bytes).unwrap();
    let http_resp = router(data_dir, &http_req);
    let (parts, body) = http_resp.into_parts();
    Response::from_parts(parts, Full::new(Bytes::from(body)))
}

// --- Static asset serving ---

fn resolve_asset(path: &str, context: &tauri::Context) -> Option<Vec<u8>> {
    if cfg!(dev) {
        // Dev mode: assets not embedded, read from dist/ on disk
        let dist = Path::new(env!("CARGO_MANIFEST_DIR")).join("../dist");
        std::fs::read(dist.join(path)).ok()
    } else {
        // Release: assets embedded via generate_context!()
        context.assets().get(&path.into()).map(|d| d.into_owned())
    }
}

fn serve_asset(path: &str, context: &tauri::Context) -> Response<Full<Bytes>> {
    let relative = path.trim_start_matches('/');

    let (target, data) = if relative.is_empty() {
        ("index.html", resolve_asset("index.html", context))
    } else {
        (relative, resolve_asset(relative, context))
    };

    if let Some(bytes) = data {
        let mime = guess_mime(target);
        return Response::builder()
            .status(StatusCode::OK)
            .header("content-type", mime)
            .header("access-control-allow-origin", "*")
            .body(Full::new(Bytes::from(bytes)))
            .unwrap();
    }

    // SPA fallback
    if let Some(index) = resolve_asset("index.html", context) {
        return Response::builder()
            .status(StatusCode::OK)
            .header("content-type", "text/html; charset=utf-8")
            .header("access-control-allow-origin", "*")
            .body(Full::new(Bytes::from(index)))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header("content-type", "text/plain")
        .body(Full::new(Bytes::from("Not found")))
        .unwrap()
}

fn guess_mime(path: &str) -> &'static str {
    let ext = path.rsplit('.').next().unwrap_or("");
    match ext {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ico" => "image/x-icon",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

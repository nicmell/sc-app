pub mod scope_ws;
mod ws_bridge;

use crate::{config, plugin};
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
}

pub fn serve(context: tauri::Context, port: u16, scsynth_addr: String) {
    if cfg!(dev) {
        let project_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
        println!("Building frontend...");
        let status = std::process::Command::new("yarn")
            .arg("build")
            .current_dir(&project_root)
            .status()
            .expect("failed to run yarn build");
        if !status.success() {
            eprintln!("yarn build failed");
            std::process::exit(1);
        }
    }

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
        if path == "/scope" {
            return Ok(scope_ws::handle_ws_upgrade(req, &state.scsynth_addr));
        }
        return Ok(ws_bridge::handle_ws_upgrade(req, &state.scsynth_addr));
    }

    // Plugin routes
    if path.starts_with("/plugins") {
        return Ok(handle_plugin_request(req, &path, &state.data_dir).await);
    }

    // Static asset serving with SPA fallback
    Ok(serve_asset(&path, &state.context))
}

// --- Plugin route bridge ---

async fn handle_plugin_request(
    req: Request<Incoming>,
    path: &str,
    data_dir: &Path,
) -> Response<Full<Bytes>> {
    let stripped = path.strip_prefix("/plugins").unwrap_or("/");
    let stripped = if stripped.is_empty() { "/" } else { stripped };

    let method = req.method().clone();
    let headers = req.headers().clone();
    let body_bytes = match req.into_body().collect().await {
        Ok(collected) => collected.to_bytes().to_vec(),
        Err(_) => Vec::new(),
    };

    let mut builder = http::Request::builder()
        .method(method)
        .uri(stripped);
    for (k, v) in &headers {
        builder = builder.header(k, v);
    }
    let http_req = builder.body(body_bytes).unwrap();

    let http_resp = plugin::router::handle(data_dir, &http_req);

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

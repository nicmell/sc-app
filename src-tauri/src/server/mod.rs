//! Phase 0 — HTTP server.
//!
//! Two responsibilities:
//! 1. Serve the Vite `dist/` directory as static files with a SPA
//!    fallback to `index.html` for any unknown path (browser mode).
//! 2. Upgrade `GET /ws` to a WebSocket that the
//!    [`ws_bridge`](super::server::ws_bridge) forwards to a per-session
//!    UDP socket connected to scsynth. The target address can be
//!    overridden per connection via `?scsynth=HOST:PORT`.

use std::net::SocketAddr;
use std::path::PathBuf;

use anyhow::{Context, Result};
use axum::body::Body;
use axum::extract::{Query, Request, State, WebSocketUpgrade};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use tokio::fs;
use tokio_util::io::ReaderStream;

pub mod ws_bridge;

#[derive(Clone)]
struct AppState {
    default_scsynth: SocketAddr,
}

#[derive(Deserialize)]
struct WsQuery {
    scsynth: Option<String>,
}

pub async fn serve(port: u16, default_scsynth: SocketAddr, dist: PathBuf) -> Result<()> {
    let state = AppState { default_scsynth };

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(state)
        .fallback({
            let dist = dist.clone();
            move |req: Request| static_or_spa(req, dist.clone())
        });

    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind to {addr}"))?;

    eprintln!("sc-app listening on http://{addr}");
    eprintln!(
        "  /ws → {default_scsynth} (override per-connection via ?scsynth=HOST:PORT)"
    );
    eprintln!("  static → {}", dist.display());

    axum::serve(listener, app).await.context("axum serve error")?;
    Ok(())
}

/// Static-file handler with a scoped SPA fallback.
///
/// The naive `ServeDir::fallback(ServeFile::new(index))` approach serves
/// `index.html` for *every* 404 — which means missing assets like a
/// stale `/assets/scopeWorker-<hash>.js` come back as HTML and blow up
/// the browser's strict MIME check with a confusing "non-JavaScript
/// MIME type" error. Scope the fallback to navigation-like paths only:
///
/// - If the request path has a file extension (e.g. `.js`, `.wasm`) or
///   starts with `/assets/` → 404 with a loud text error.
/// - Otherwise (client-side routes like `/`, `/scopes/42`) → serve
///   `index.html`.
async fn static_or_spa(req: Request, dist: PathBuf) -> Response {
    let path = req.uri().path();
    // Strip the leading `/` and canonicalise into a `dist`-relative path.
    let relative = path.trim_start_matches('/');
    let on_disk = dist.join(relative);

    // Prevent path traversal — refuse anything that climbs out of dist.
    let canonical = fs::canonicalize(&on_disk).await.ok();
    let dist_canonical = fs::canonicalize(&dist).await.ok();
    let inside_dist = match (&canonical, &dist_canonical) {
        (Some(p), Some(d)) => p.starts_with(d),
        _ => false,
    };

    if inside_dist {
        if let Ok(meta) = fs::metadata(&on_disk).await {
            if meta.is_file() {
                return file_response(&on_disk).await;
            }
        }
    }

    let is_asset = path.starts_with("/assets/");
    let is_file_like = path
        .rsplit('/')
        .next()
        .map_or(false, |seg| seg.contains('.'));

    if is_asset || is_file_like {
        // Loud 404 — no HTML fallback for asset-shaped paths. This
        // prevents stale build references from manifesting as
        // confusing MIME errors in the browser.
        return (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
            format!("not found: {path}\n"),
        )
            .into_response();
    }

    // Navigation path → SPA entry.
    file_response(&dist.join("index.html")).await
}

async fn file_response(path: &std::path::Path) -> Response {
    match fs::File::open(path).await {
        Ok(file) => {
            let mime = mime_from_ext(path).unwrap_or("application/octet-stream");
            let stream = ReaderStream::new(file);
            let body = Body::from_stream(stream);
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime)
                .body(body)
                .unwrap()
        }
        Err(_) => (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
            format!("not found: {}\n", path.display()),
        )
            .into_response(),
    }
}

fn mime_from_ext(path: &std::path::Path) -> Option<&'static str> {
    Some(match path.extension()?.to_str()? {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "wasm" => "application/wasm",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "ico" => "image/x-icon",
        "map" => "application/json; charset=utf-8",
        _ => return None,
    })
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> Result<Response, (StatusCode, String)> {
    let scsynth = match query.scsynth.as_deref() {
        None => state.default_scsynth,
        Some(raw) => raw
            .parse::<SocketAddr>()
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("invalid scsynth address {raw:?}: {e}")))?,
    };

    Ok(ws.on_upgrade(move |socket| async move {
        if let Err(e) = ws_bridge::handle_ws(socket, scsynth).await {
            eprintln!("ws_bridge session error: {e:#}");
        }
    }))
}

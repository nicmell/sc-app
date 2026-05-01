//! Static-file serving for the Vite `dist/` bundle, plus the path
//! resolution that finds it inside a Tauri bundle.
//!
//! The naive `ServeDir::fallback(ServeFile::new(index))` approach
//! serves `index.html` for *every* 404 — which means missing assets
//! like a stale `/assets/scopeWorker-<hash>.js` come back as HTML and
//! blow up the browser's strict MIME check with a confusing
//! "non-JavaScript MIME type" error. So we scope the fallback to
//! navigation-like paths only:
//!
//! - If the request path has a file extension (e.g. `.js`, `.wasm`)
//!   or starts with `/assets/` → 404 with a loud text error.
//! - Otherwise (client-side routes like `/`, `/scopes/42`) → serve
//!   `index.html`.
//!
//! Path-traversal guard: requests are canonicalised and rejected if
//! they resolve outside `dist/`.
//!
//! Where `dist/` lives: when shipped via `bundle.resources` in
//! `tauri.conf.json`, Tauri re-bases the leading `..` to `_up_`, so
//! the bundled files land at `<resource_dir>/_up_/dist/`. Both the
//! GUI path (via `AppHandle::path().resource_dir()`) and the bridge
//! path ([`resolve_bundled_dist`], via `tauri::utils::platform`) use
//! [`DIST_SUBPATH`] as the same suffix.

use std::path::{Path, PathBuf};

use axum::body::Body;
use axum::extract::Request;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use tokio::fs;
use tokio_util::io::ReaderStream;

/// Subpath inside the Tauri resource dir where `dist/` lands.
/// `bundle.resources: ["../dist"]` re-bases the leading `..` to
/// `_up_` when copying into the bundle, so the actual files live at
/// `<resource_dir>/_up_/dist/...`.
pub const DIST_SUBPATH: &str = "_up_/dist";

/// Resolve the bundled `dist/` directory for a non-Tauri-runtime
/// caller (the `bridge` subcommand). Uses
/// `tauri::utils::platform::resource_dir` directly so we get Tauri's
/// platform-specific path logic without paying for `Builder::run()`
/// (and, on Linux, without `gtk::init()` failing on a headless
/// host).
///
/// Returns `Err` when not running inside a Tauri bundle (e.g. plain
/// `cargo run -- bridge` in dev). Caller is expected to fall back
/// gracefully — `--dist` override or no static fallback at all.
///
/// The GUI path doesn't call this — it has an `AppHandle` and
/// uses `app.path().resource_dir()?.join(DIST_SUBPATH)` directly.
pub fn resolve_bundled_dist() -> anyhow::Result<PathBuf> {
    let pkg_info = tauri::utils::PackageInfo {
        name: env!("CARGO_PKG_NAME").into(),
        version: env!("CARGO_PKG_VERSION")
            .parse()
            .expect("CARGO_PKG_VERSION must be a valid semver"),
        authors: env!("CARGO_PKG_AUTHORS"),
        description: env!("CARGO_PKG_DESCRIPTION"),
        crate_name: env!("CARGO_PKG_NAME"),
    };
    let env = tauri::Env::default();
    let resource_dir = tauri::utils::platform::resource_dir(&pkg_info, &env)
        .map_err(|e| anyhow::anyhow!("resource_dir: {e}"))?;
    Ok(resource_dir.join(DIST_SUBPATH))
}

pub async fn static_or_spa(req: Request, dist: PathBuf) -> Response {
    let path = req.uri().path();
    // Strip the leading `/` and canonicalise into a `dist`-relative path.
    let relative = path.trim_start_matches('/');
    let on_disk = dist.join(relative);

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

    file_response(&dist.join("index.html")).await
}

async fn file_response(path: &Path) -> Response {
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

fn mime_from_ext(path: &Path) -> Option<&'static str> {
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

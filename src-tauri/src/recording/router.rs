use super::manager;
use http::{Method, Request, Response};
use std::path::Path;

fn percent_decode(input: &str) -> String {
    let mut out = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""),
                16,
            ) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn response(status: u16, content_type: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("content-type", content_type)
        .header("access-control-allow-origin", "*")
        .body(body)
        .unwrap()
}

fn error(status: u16, message: &str) -> Response<Vec<u8>> {
    let body = serde_json::json!({ "error": message });
    response(status, "application/json", body.to_string().into_bytes())
}

fn json(status: u16, body: &impl serde::Serialize) -> Response<Vec<u8>> {
    let bytes = serde_json::to_vec(body).unwrap_or_default();
    response(status, "application/json", bytes)
}

// --- Route handlers ---

/// GET / — list all recordings.
fn list(data_dir: &Path) -> Response<Vec<u8>> {
    match manager::list(data_dir) {
        Ok(items) => json(200, &items),
        Err(e) => error(500, &e),
    }
}

/// POST / — mint a new recording slot. Returns `{id, path}`.
fn create(data_dir: &Path) -> Response<Vec<u8>> {
    match manager::create(data_dir) {
        Ok(handle) => json(201, &handle),
        Err(e) => error(500, &e),
    }
}

/// GET /{id}.wav — serve the finished WAV file.
fn download(data_dir: &Path, id: &str) -> Response<Vec<u8>> {
    match manager::read(data_dir, id) {
        Ok(bytes) => Response::builder()
            .status(200)
            .header("content-type", "audio/wav")
            .header(
                "content-disposition",
                format!("attachment; filename=\"record-{id}.wav\""),
            )
            .header("access-control-allow-origin", "*")
            .body(bytes)
            .unwrap(),
        Err(_) => error(404, "Recording not found"),
    }
}

/// DELETE /{id} — remove a recording file.
fn remove(data_dir: &Path, id: &str) -> Response<Vec<u8>> {
    match manager::remove(data_dir, id) {
        Ok(()) => response(204, "application/json", Vec::new()),
        Err(e) => error(400, &e),
    }
}

// --- Router ---

/// Main router. Called from both the Tauri `app://recordings/…` URI scheme
/// handler (native mode) and the HTTP server's `/recordings/…` bridge
/// (serve mode).
///
/// Routes:
///   GET    /              → list
///   POST   /              → create (body ignored; returns fresh id+path)
///   GET    /{id}.wav      → download
///   DELETE /{id}          → remove
pub fn handle(data_dir: &Path, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let raw_path = percent_decode(request.uri().path().trim_start_matches('/'));
    let method = request.method();
    let segments: Vec<&str> = raw_path.split('/').filter(|s| !s.is_empty()).collect();

    match (method, segments.as_slice()) {
        (&Method::GET, []) => list(data_dir),
        (&Method::POST, []) => create(data_dir),
        (&Method::GET, [name]) => {
            if let Some(id) = name.strip_suffix(".wav") {
                download(data_dir, id)
            } else {
                error(404, "Not found")
            }
        }
        (&Method::DELETE, [id]) => remove(data_dir, id),
        _ => error(404, "Not found"),
    }
}

use tauri::http::Response;
use tauri::{Manager, UriSchemeContext};

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

fn mime_from_extension(ext: &str) -> &str {
    match ext {
        "js" | "mjs" => "application/javascript",
        "json" => "application/json",
        "wasm" => "application/wasm",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "txt" => "text/plain",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "pdf" => "application/pdf",
        "xml" => "application/xml",
        _ => "application/octet-stream",
    }
}

fn error_response(status: u16, body: &[u8]) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("access-control-allow-origin", "*")
        .body(body.to_vec())
        .unwrap()
}

pub fn handle<R: tauri::Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: tauri::http::Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let raw_name = request.uri().host().unwrap_or("");
    let name = percent_decode(raw_name);

    if name.is_empty() {
        return error_response(404, b"Not found");
    }

    let plugins_dir = match ctx.app_handle().path().app_data_dir() {
        Ok(d) => d.join("plugins"),
        Err(_) => return error_response(500, b"Cannot resolve app data dir"),
    };

    let canonical_dir = match plugins_dir.canonicalize() {
        Ok(p) => p,
        Err(_) => return error_response(404, b"Plugins directory not found"),
    };

    let canonical_file = match plugins_dir.join(&name).canonicalize() {
        Ok(p) => p,
        Err(_) => return error_response(404, b"File not found"),
    };

    if !canonical_file.starts_with(&canonical_dir) {
        return error_response(403, b"Forbidden");
    }

    let content = match std::fs::read(&canonical_file) {
        Ok(c) => c,
        Err(_) => return error_response(500, b"Failed to read file"),
    };

    let ext = canonical_file
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    Response::builder()
        .status(200)
        .header("content-type", mime_from_extension(ext))
        .header("access-control-allow-origin", "*")
        .body(content)
        .unwrap()
}

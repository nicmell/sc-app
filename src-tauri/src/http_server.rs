use crate::{config, plugin_manager};
use http::{Method, Request, Response};
use std::io::Read;
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

/// GET /plugins — list all plugins
fn list_plugins(data_dir: &Path) -> Response<Vec<u8>> {
    match plugin_manager::list_plugins(data_dir) {
        Ok(plugins) => json(200, &plugins),
        Err(e) => error(500, &e),
    }
}

/// POST /plugins — add a plugin (body = zip bytes)
fn add_plugin(data_dir: &Path, body: &[u8]) -> Response<Vec<u8>> {
    match plugin_manager::add_plugin(data_dir, body) {
        Ok(info) => json(201, &info),
        Err(e) => error(400, &e),
    }
}

/// DELETE /plugins/{id} — remove a plugin
fn remove_plugin(data_dir: &Path, id: &str) -> Response<Vec<u8>> {
    match plugin_manager::remove_plugin(data_dir, id) {
        Ok(()) => response(204, "application/json", Vec::new()),
        Err(e) => error(404, &e),
    }
}

/// GET /plugins/{id}/{file_path...} — serve a plugin file from its zip archive
fn serve_file(data_dir: &Path, id: &str, file_path: &str) -> Response<Vec<u8>> {
    if !plugin_manager::is_safe_path(file_path) {
        return error(403, "Forbidden");
    }

    let plugins_dir = config::plugins_dir(data_dir);
    let suffix = format!(".{id}.zip");
    let zip_path = match std::fs::read_dir(&plugins_dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .find(|e| e.file_name().to_string_lossy().ends_with(&suffix))
            .map(|e| e.path()),
        Err(_) => None,
    };
    let zip_path = match zip_path {
        Some(p) => p,
        None => return error(404, "Plugin not found"),
    };

    let zip_data = match std::fs::read(&zip_path) {
        Ok(d) => d,
        Err(_) => return error(404, "Plugin not found"),
    };

    let cursor = std::io::Cursor::new(zip_data.as_slice());
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return error(500, "Failed to read plugin archive"),
    };

    // Read and validate metadata
    let info = {
        let mut meta_file = match archive.by_name("metadata.json") {
            Ok(f) => f,
            Err(_) => return error(500, "Failed to read plugin metadata"),
        };
        let mut meta_text = String::new();
        if meta_file.read_to_string(&mut meta_text).is_err() {
            return error(500, "Failed to read plugin metadata");
        }
        drop(meta_file);
        let meta_value: serde_json::Value = match serde_json::from_str(&meta_text) {
            Ok(v) => v,
            Err(_) => return error(500, "Failed to parse plugin metadata"),
        };
        match plugin_manager::validate_metadata(&meta_value) {
            Ok(i) => i,
            Err(e) => return error(500, &e),
        }
    };

    // Only allow access to the entry file and declared assets
    let asset_type = info.assets.iter()
        .find(|a| a.path == file_path)
        .map(|a| a.mime_type.clone());
    let is_entry = file_path == info.entry;

    if !is_entry && asset_type.is_none() {
        return error(403, "File not declared in plugin metadata");
    }

    let mut file = match archive.by_name(file_path) {
        Ok(f) => f,
        Err(_) => return error(404, "File not found in plugin"),
    };

    let mut content = Vec::new();
    if file.read_to_end(&mut content).is_err() {
        return error(500, "Failed to read file from archive");
    }

    if let Some(ref declared) = asset_type {
        if let Err(e) = plugin_manager::validate_asset_image(&content, declared) {
            return error(500, &format!("Asset validation failed: {e}"));
        }
        response(200, plugin_manager::asset_type_to_mime(declared), content)
    } else {
        let html = match std::str::from_utf8(&content) {
            Ok(s) => s,
            Err(_) => return error(500, "Entry file is not valid UTF-8"),
        };
        if let Err(e) = fastxml::parse(html) {
            return error(500, &format!("Entry file is not valid XHTML: {e}"));
        }
        response(200, "application/xhtml+xml", content)
    }
}

// --- Router ---

/// Main router. Receives requests after the host has been validated.
///
/// Routes:
///   GET    /              → list all plugins
///   POST   /              → add a plugin (body = zip)
///   DELETE /{id}          → remove a plugin
///   GET    /{id}/{file}   → serve plugin file
pub fn handle(data_dir: &Path, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let raw_path = percent_decode(request.uri().path().trim_start_matches('/'));
    let method = request.method();

    let segments: Vec<&str> = raw_path
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();

    match (method, segments.as_slice()) {
        (&Method::GET, []) => list_plugins(data_dir),
        (&Method::POST, []) => add_plugin(data_dir, request.body()),
        (&Method::DELETE, [id]) => remove_plugin(data_dir, id),
        (&Method::GET, [id, rest @ ..]) if !rest.is_empty() => {
            let file_path = rest.join("/");
            serve_file(data_dir, id, &file_path)
        }
        _ => error(404, "Not found"),
    }
}

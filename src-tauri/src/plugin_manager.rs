use serde::Serialize;
use std::io::Read;
use tauri::http::Response;
use tauri::{AppHandle, Manager, UriSchemeContext};

#[derive(Serialize)]
pub struct PluginInfo {
    pub name: String,
    pub author: String,
    pub version: String,
    pub entry: String,
}

fn validate_metadata(raw: &serde_json::Value) -> Result<PluginInfo, String> {
    let obj = raw
        .as_object()
        .ok_or("metadata.json must be a JSON object")?;

    let get_str = |key: &str| -> Result<String, String> {
        obj.get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| format!("metadata.json: \"{key}\" must be a non-empty string"))
    };

    Ok(PluginInfo {
        name: get_str("name")?,
        author: get_str("author")?,
        version: get_str("version")?,
        entry: get_str("entry")?,
    })
}

fn is_safe_path(name: &str) -> bool {
    let path = std::path::Path::new(name);
    path.components().all(|c| matches!(c, std::path::Component::Normal(_)))
}

#[tauri::command(rename_all = "snake_case")]
pub fn install(app: AppHandle, data: Vec<u8>) -> Result<PluginInfo, String> {
    let cursor = std::io::Cursor::new(&data);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|_| "File is not a valid zip archive".to_string())?;

    // Read metadata.json
    let metadata_text = {
        let mut file = archive
            .by_name("metadata.json")
            .map_err(|_| "Zip must contain a metadata.json at its root".to_string())?;
        let mut text = String::new();
        file.read_to_string(&mut text)
            .map_err(|e| format!("Failed to read metadata.json: {e}"))?;
        text
    };

    let meta_value: serde_json::Value = serde_json::from_str(&metadata_text)
        .map_err(|_| "metadata.json is not valid JSON".to_string())?;

    let info = validate_metadata(&meta_value)?;

    // Verify entry file exists in zip
    archive
        .by_name(&info.entry)
        .map_err(|_| format!("Entry file \"{}\" not found in zip", info.entry))?;

    // Extract to plugins/<name>/
    let plugins_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("plugins")
        .join(&info.name);

    std::fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();

        if !is_safe_path(&name) {
            return Err(format!("Invalid path in zip: {name}"));
        }

        if file.is_dir() {
            std::fs::create_dir_all(plugins_dir.join(&name)).map_err(|e| e.to_string())?;
            continue;
        }

        let out_path = plugins_dir.join(&name);
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut contents = Vec::new();
        file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
        std::fs::write(&out_path, &contents).map_err(|e| e.to_string())?;
    }

    Ok(info)
}

#[tauri::command(rename_all = "snake_case")]
pub fn remove(app: AppHandle, name: String) -> Result<(), String> {
    let plugin_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("plugins")
        .join(&name);

    if plugin_dir.exists() {
        std::fs::remove_dir_all(&plugin_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// --- URI scheme handler for serving plugin files ---

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
    let plugin_name = percent_decode(request.uri().host().unwrap_or(""));
    let file_path = percent_decode(request.uri().path().trim_start_matches('/'));

    if plugin_name.is_empty() || file_path.is_empty() {
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

    let canonical_file = match plugins_dir
        .join(&plugin_name)
        .join(&file_path)
        .canonicalize()
    {
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

use crate::app_config;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::http::Response;
use tauri::{AppHandle, Manager, UriSchemeContext};

#[derive(Serialize, Deserialize, Clone)]
pub struct AssetInfo {
    pub path: String,
    #[serde(rename = "type")]
    pub mime_type: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub author: String,
    pub version: String,
    pub entry: String,
    pub assets: Vec<AssetInfo>,
}

fn is_valid_name(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn is_valid_version(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() == 3 && parts.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
}

const SUPPORTED_MIME_TYPES: &[&str] = &[
    "application/javascript",
    "application/json",
    "application/wasm",
    "text/html",
    "text/css",
    "text/plain",
    "image/svg+xml",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "video/mp4",
    "video/webm",
    "application/pdf",
    "application/xml",
];

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

    let name = get_str("name")?;
    if !is_valid_name(&name) {
        return Err("metadata.json: \"name\" must only contain A-Z a-z 0-9 - _".to_string());
    }

    let version = get_str("version")?;
    if !is_valid_version(&version) {
        return Err("metadata.json: \"version\" must be in the form major.minor.patch".to_string());
    }

    let entry = get_str("entry")?;
    if !is_safe_path(&entry) {
        return Err("metadata.json: \"entry\" must be a valid relative path".to_string());
    }

    let assets = match obj.get("assets") {
        Some(serde_json::Value::Array(arr)) => {
            let mut result = Vec::with_capacity(arr.len());
            for (i, item) in arr.iter().enumerate() {
                let asset_obj = item.as_object().ok_or_else(|| {
                    format!("metadata.json: assets[{i}] must be an object")
                })?;

                let path = asset_obj
                    .get("path")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| {
                        format!("metadata.json: assets[{i}].path must be a non-empty string")
                    })?;

                if !is_safe_path(&path) {
                    return Err(format!(
                        "metadata.json: assets[{i}].path must be a valid relative path"
                    ));
                }

                let mime_type = asset_obj
                    .get("type")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| {
                        format!("metadata.json: assets[{i}].type must be a non-empty string")
                    })?;

                if !SUPPORTED_MIME_TYPES.contains(&mime_type.as_str()) {
                    return Err(format!(
                        "metadata.json: assets[{i}].type \"{mime_type}\" is not a supported MIME type"
                    ));
                }

                result.push(AssetInfo { path, mime_type });
            }
            result
        }
        Some(_) => return Err("metadata.json: \"assets\" must be an array".to_string()),
        None => Vec::new(),
    };

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let id = format!("{name}-{version}-{timestamp}");

    Ok(PluginInfo {
        id,
        name,
        author: get_str("author")?,
        version,
        entry,
        assets,
    })
}

fn is_safe_path(name: &str) -> bool {
    let path = std::path::Path::new(name);
    path.components().all(|c| matches!(c, std::path::Component::Normal(_)))
}

fn validate_plugin(data: &[u8]) -> Result<PluginInfo, String> {
    let cursor = std::io::Cursor::new(data);
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

    // Verify all asset files exist in zip
    for asset in &info.assets {
        archive
            .by_name(&asset.path)
            .map_err(|_| format!("Asset file \"{}\" not found in zip", asset.path))?;
    }

    Ok(info)
}

#[tauri::command]
pub fn add_plugin(app: AppHandle, data: Vec<u8>) -> Result<PluginInfo, String> {
    let info = validate_plugin(&data)?;

    // Save the zip as-is to plugins/<name>.zip
    let plugins_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("plugins");

    std::fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;

    let zip_path = plugins_dir.join(format!("{}-{}.zip", &info.name, &info.version));
    std::fs::write(&zip_path, &data).map_err(|e| e.to_string())?;

    // Persist plugin entry in config.json
    let mut config = app_config::read(&app)?;
    let plugins = config
        .as_object_mut()
        .ok_or("config.json root must be an object")?
        .entry("plugins")
        .or_insert_with(|| serde_json::json!([]))
        .as_array_mut()
        .ok_or("config.json: \"plugins\" must be an array")?;

    // Remove existing entry with the same name+version
    plugins.retain(|p| {
        !(p.get("name").and_then(|v| v.as_str()) == Some(&info.name)
            && p.get("version").and_then(|v| v.as_str()) == Some(&info.version))
    });

    // Append new entry
    plugins.push(serde_json::to_value(&info).map_err(|e| e.to_string())?);
    app_config::write(&app, &config)?;

    Ok(info)
}

#[tauri::command]
pub fn remove_plugin(app: AppHandle, id: String) -> Result<(), String> {
    // Read config and find the plugin entry
    let mut config = app_config::read(&app)?;
    let plugins = config
        .as_object_mut()
        .ok_or("config.json root must be an object")?
        .get_mut("plugins")
        .and_then(|v| v.as_array_mut())
        .ok_or("config.json: \"plugins\" must be an array")?;

    let idx = plugins
        .iter()
        .position(|p| p.get("id").and_then(|v| v.as_str()) == Some(&id))
        .ok_or_else(|| format!("Plugin with id \"{id}\" not found in config"))?;

    // Extract name+version for zip filename before removing
    let entry = &plugins[idx];
    let name = entry.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let version = entry.get("version").and_then(|v| v.as_str()).unwrap_or("");
    let stem = format!("{name}-{version}");

    plugins.remove(idx);
    app_config::write(&app, &config)?;

    // Delete the zip file
    let zip_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("plugins")
        .join(format!("{stem}.zip"));

    if zip_path.exists() {
        std::fs::remove_file(&zip_path).map_err(|e| e.to_string())?;
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
        "html" | "htm" => "text/html",
        "css" => "text/css",
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

/// Rewrite relative asset paths in the entry HTML to absolute `plugins://` URLs.
fn rewrite_entry_html(html: &str, plugin_name: &str, version: &str, info: &PluginInfo) -> String {
    let base = format!("plugins://{plugin_name}/{version}/");
    let mut result = html.to_string();

    for asset in &info.assets {
        let path = &asset.path;
        let absolute = format!("{base}{path}");

        // Replace occurrences in src="...", href="...", url(...) with both quote styles
        for attr in ["src", "href"] {
            result = result.replace(
                &format!("{attr}=\"{path}\""),
                &format!("{attr}=\"{absolute}\""),
            );
            result = result.replace(
                &format!("{attr}='{path}'"),
                &format!("{attr}='{absolute}'"),
            );
        }

        // Replace url() references in inline styles
        result = result.replace(
            &format!("url(\"{path}\")"),
            &format!("url(\"{absolute}\")"),
        );
        result = result.replace(
            &format!("url('{path}')"),
            &format!("url('{absolute}')"),
        );
        result = result.replace(
            &format!("url({path})"),
            &format!("url({absolute})"),
        );
    }

    result
}

/// Read and parse metadata.json from an already-opened archive.
fn read_metadata(archive: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>) -> Result<PluginInfo, ()> {
    let mut meta_file = archive.by_name("metadata.json").map_err(|_| ())?;
    let mut meta_text = String::new();
    meta_file.read_to_string(&mut meta_text).map_err(|_| ())?;
    drop(meta_file);

    let meta_value: serde_json::Value = serde_json::from_str(&meta_text).map_err(|_| ())?;
    validate_metadata(&meta_value).map_err(|_| ())
}

pub fn handle<R: tauri::Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: tauri::http::Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let plugin_name = percent_decode(request.uri().host().unwrap_or(""));
    let raw_path = percent_decode(request.uri().path().trim_start_matches('/'));

    // Path format: <version>/<file_path>
    let (version, file_path) = match raw_path.split_once('/') {
        Some((v, f)) if !v.is_empty() && !f.is_empty() => (v.to_string(), f.to_string()),
        _ => return error_response(404, b"Not found"),
    };

    if plugin_name.is_empty() {
        return error_response(404, b"Not found");
    }

    if !is_safe_path(&file_path) {
        return error_response(403, b"Forbidden");
    }

    let zip_path = match ctx.app_handle().path().app_data_dir() {
        Ok(d) => d.join("plugins").join(format!("{plugin_name}-{version}.zip")),
        Err(_) => return error_response(500, b"Cannot resolve app data dir"),
    };

    let zip_data = match std::fs::read(&zip_path) {
        Ok(d) => d,
        Err(_) => return error_response(404, b"Plugin not found"),
    };

    let cursor = std::io::Cursor::new(zip_data.as_slice());
    let mut archive = match zip::ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(_) => return error_response(500, b"Failed to read plugin archive"),
    };

    // Read metadata to validate the requested path and rewrite entry HTML
    let info = match read_metadata(&mut archive) {
        Ok(i) => i,
        Err(_) => return error_response(500, b"Failed to read plugin metadata"),
    };

    // Only allow access to the entry file, declared assets, and metadata.json
    let is_allowed = file_path == info.entry
        || file_path == "metadata.json"
        || info.assets.iter().any(|a| a.path == file_path);

    if !is_allowed {
        return error_response(403, b"File not declared in plugin metadata");
    }

    let mut file = match archive.by_name(&file_path) {
        Ok(f) => f,
        Err(_) => return error_response(404, b"File not found in plugin"),
    };

    let mut content = Vec::new();
    if file.read_to_end(&mut content).is_err() {
        return error_response(500, b"Failed to read file from archive");
    }

    // If serving the entry HTML, rewrite relative asset paths to absolute URLs
    let content = if file_path == info.entry {
        let html = String::from_utf8_lossy(&content);
        let rewritten = rewrite_entry_html(&html, &plugin_name, &version, &info);
        rewritten.into_bytes()
    } else {
        content
    };

    let ext = std::path::Path::new(&file_path)
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


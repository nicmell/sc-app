use crate::app_config;
use sc_plugin::validation::{
    asset_type_to_mime, is_safe_path, validate_asset_image, validate_metadata, validate_plugin,
    PluginInfo,
};
use sc_plugin::{fastxml, zip};
use std::io::Read;
use tauri::http::Response;
use tauri::{AppHandle, Manager, UriSchemeContext};

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

fn error_response(status: u16, body: &[u8]) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("access-control-allow-origin", "*")
        .body(body.to_vec())
        .unwrap()
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

    let info = match read_metadata(&mut archive) {
        Ok(i) => i,
        Err(_) => return error_response(500, b"Failed to read plugin metadata"),
    };

    // Only allow access to the entry file and declared assets
    let matching_asset = info.assets.iter().find(|a| a.path == file_path);
    let is_entry = file_path == info.entry;

    if !is_entry && matching_asset.is_none() {
        return error_response(403, b"File not declared in plugin metadata");
    }

    let mut file: zip::read::ZipFile = match archive.by_name(&file_path) {
        Ok(f) => f,
        Err(_) => return error_response(404, b"File not found in plugin"),
    };

    let mut content = Vec::new();
    if file.read_to_end(&mut content).is_err() {
        return error_response(500, b"Failed to read file from archive");
    }

    let content_type = if let Some(asset) = matching_asset {
        if let Err(e) = validate_asset_image(&content, &asset.mime_type) {
            return error_response(500, format!("Asset validation failed: {e}").as_bytes());
        }
        asset_type_to_mime(&asset.mime_type)
    } else {
        let html = match std::str::from_utf8(&content) {
            Ok(s) => s,
            Err(_) => return error_response(500, b"Entry file is not valid UTF-8"),
        };
        if let Err(e) = fastxml::parse(html) {
            return error_response(500, format!("Entry file is not valid XHTML: {e}").as_bytes());
        }
        "application/xhtml+xml"
    };

    Response::builder()
        .status(200)
        .header("content-type", content_type)
        .header("access-control-allow-origin", "*")
        .body(content)
        .unwrap()
}

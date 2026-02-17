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

const SUPPORTED_ASSET_TYPES: &[&str] = &["png", "jpeg"];

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

                if !SUPPORTED_ASSET_TYPES.contains(&mime_type.as_str()) {
                    return Err(format!(
                        "metadata.json: assets[{i}].type \"{mime_type}\" is not a supported asset type (expected one of: {SUPPORTED_ASSET_TYPES:?})"
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

const XSD_SCHEMA: &str = include_str!("xsd/sc-plugin-schema.xsd");

fn validate_entry_xhtml(entry_content: &str) -> Result<(), String> {
    let ctx = fastxml::create_xml_schema_validation_context_from_buffer(XSD_SCHEMA.as_bytes())
        .map_err(|e| format!("Failed to parse XSD schema: {e}"))?;
    let doc = fastxml::parse(entry_content)
        .map_err(|e| format!("Entry file is not valid XHTML: {e}"))?;
    let errors = fastxml::validate_document_by_schema_context(&doc, &ctx)
        .map_err(|e| format!("Entry file validation failed: {e}"))?;
    if !errors.is_empty() {
        let msgs: Vec<String> = errors.iter().map(|e| e.to_string()).collect();
        return Err(format!(
            "Entry file does not conform to sc-plugin schema:\n{}",
            msgs.join("\n")
        ));
    }
    Ok(())
}

fn validate_asset_image(data: &[u8], declared_type: &str) -> Result<(), String> {
    let format = image::guess_format(data)
        .map_err(|e| format!("Failed to detect image format: {e}"))?;
    let detected = match format {
        image::ImageFormat::Png => "png",
        image::ImageFormat::Jpeg => "jpeg",
        _ => return Err(format!("Unsupported image format detected: {format:?}")),
    };
    if detected != declared_type {
        return Err(format!(
            "Image content is {detected} but declared type is \"{declared_type}\""
        ));
    }
    Ok(())
}

fn asset_type_to_mime(t: &str) -> &str {
    match t {
        "png" => "image/png",
        "jpeg" => "image/jpeg",
        _ => "application/octet-stream",
    }
}

fn is_safe_path(name: &str) -> bool {
    let path = std::path::Path::new(name);
    path.components().all(|c| matches!(c, std::path::Component::Normal(_)))
}

pub fn validate_plugin(data: &[u8]) -> Result<PluginInfo, String> {
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

    // Read and validate entry file
    let entry_content = {
        let mut entry_file = archive
            .by_name(&info.entry)
            .map_err(|_| format!("Entry file \"{}\" not found in zip", info.entry))?;
        let mut content = String::new();
        entry_file.read_to_string(&mut content)
            .map_err(|e| format!("Failed to read entry file \"{}\": {e}", info.entry))?;
        content
    };
    validate_entry_xhtml(&entry_content)?;

    // Verify all asset files exist in zip and validate image content
    for asset in &info.assets {
        let mut asset_file = archive
            .by_name(&asset.path)
            .map_err(|_| format!("Asset file \"{}\" not found in zip", asset.path))?;
        let mut bytes = Vec::new();
        asset_file
            .read_to_end(&mut bytes)
            .map_err(|e| format!("Failed to read asset \"{}\": {e}", asset.path))?;
        validate_asset_image(&bytes, &asset.mime_type)
            .map_err(|e| format!("Asset \"{}\": {e}", asset.path))?;
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

    let mut file = match archive.by_name(&file_path) {
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


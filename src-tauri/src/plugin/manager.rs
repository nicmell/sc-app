use crate::config;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::Path;

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

pub(crate) fn validate_metadata(raw: &serde_json::Value) -> Result<PluginInfo, String> {
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

    let mut bytes = [0u8; 8];
    getrandom::getrandom(&mut bytes).map_err(|e| format!("Failed to generate random id: {e}"))?;
    let id: String = bytes.iter().map(|b| format!("{b:02x}")).collect();

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

pub(crate) fn validate_asset_image(data: &[u8], declared_type: &str) -> Result<(), String> {
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

pub(crate) fn asset_type_to_mime(t: &str) -> &'static str {
    match t {
        "png" => "image/png",
        "jpeg" => "image/jpeg",
        _ => "application/octet-stream",
    }
}

pub(crate) fn is_safe_path(name: &str) -> bool {
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

pub fn add_plugin(data_dir: &Path, data: &[u8]) -> Result<PluginInfo, String> {
    let info = validate_plugin(data)?;

    let plugins_dir = config::plugins_dir(data_dir);
    std::fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;

    let zip_path = plugins_dir.join(format!("{}-{}.{}.zip", &info.name, &info.version, &info.id));
    std::fs::write(&zip_path, data).map_err(|e| e.to_string())?;

    // Persist plugin entry in config.json
    let mut cfg = config::read(data_dir)?;
    let plugins = cfg
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
    config::write(data_dir, &cfg)?;

    Ok(info)
}

pub fn remove_plugin(data_dir: &Path, id: &str) -> Result<(), String> {
    // Read config and find the plugin entry
    let mut cfg = config::read(data_dir)?;
    let plugins = cfg
        .as_object_mut()
        .ok_or("config.json root must be an object")?
        .get_mut("plugins")
        .and_then(|v| v.as_array_mut())
        .ok_or("config.json: \"plugins\" must be an array")?;

    let idx = plugins
        .iter()
        .position(|p| p.get("id").and_then(|v| v.as_str()) == Some(id))
        .ok_or_else(|| format!("Plugin with id \"{id}\" not found in config"))?;

    // Extract name+version for zip filename before removing
    let entry = &plugins[idx];
    let name = entry.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let version = entry.get("version").and_then(|v| v.as_str()).unwrap_or("").to_string();

    plugins.remove(idx);
    config::write(data_dir, &cfg)?;

    // Delete the zip file
    let zip_path = config::plugins_dir(data_dir).join(format!("{name}-{version}.{id}.zip"));

    if zip_path.exists() {
        std::fs::remove_file(&zip_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn list_plugins(data_dir: &Path) -> Result<Vec<PluginInfo>, String> {
    let cfg = config::read(data_dir)?;
    let plugins = cfg
        .get("plugins")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    plugins
        .into_iter()
        .map(|v| serde_json::from_value::<PluginInfo>(v).map_err(|e| e.to_string()))
        .collect()
}

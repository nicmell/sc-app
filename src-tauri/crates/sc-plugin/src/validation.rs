use serde::{Deserialize, Serialize};
use std::io::Read;
use std::time::{SystemTime, UNIX_EPOCH};

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

pub fn validate_metadata(raw: &serde_json::Value) -> Result<PluginInfo, String> {
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

pub fn validate_entry_xhtml(entry_content: &str) -> Result<(), String> {
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

pub fn validate_asset_image(data: &[u8], declared_type: &str) -> Result<(), String> {
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

pub fn asset_type_to_mime(t: &str) -> &str {
    match t {
        "png" => "image/png",
        "jpeg" => "image/jpeg",
        _ => "application/octet-stream",
    }
}

pub fn is_safe_path(name: &str) -> bool {
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

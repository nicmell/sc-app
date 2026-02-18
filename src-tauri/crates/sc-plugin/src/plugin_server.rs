use crate::validation::{
    asset_type_to_mime, is_safe_path, validate_asset_image, validate_metadata, PluginInfo,
};
use std::io::Read;
use std::path::Path;

#[derive(Debug)]
pub enum PluginFileError {
    NotFound(String),
    Forbidden(String),
    Internal(String),
}

impl std::fmt::Display for PluginFileError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "Not found: {msg}"),
            Self::Forbidden(msg) => write!(f, "Forbidden: {msg}"),
            Self::Internal(msg) => write!(f, "Internal error: {msg}"),
        }
    }
}

impl PluginFileError {
    pub fn status(&self) -> u16 {
        match self {
            Self::NotFound(_) => 404,
            Self::Forbidden(_) => 403,
            Self::Internal(_) => 500,
        }
    }
}

/// Read a file from a plugin zip archive.
///
/// `plugins_dir` — directory containing `{name}-{version}.zip` files.
/// Returns the file content bytes and its content-type string.
pub fn read_plugin_file(
    plugins_dir: &Path,
    name: &str,
    version: &str,
    file_path: &str,
) -> Result<(Vec<u8>, String), PluginFileError> {
    if name.is_empty() || version.is_empty() || file_path.is_empty() {
        return Err(PluginFileError::NotFound("Not found".into()));
    }

    if !is_safe_path(file_path) {
        return Err(PluginFileError::Forbidden("Forbidden".into()));
    }

    let zip_path = plugins_dir.join(format!("{name}-{version}.zip"));
    let zip_data = std::fs::read(&zip_path)
        .map_err(|_| PluginFileError::NotFound("Plugin not found".into()))?;

    let cursor = std::io::Cursor::new(zip_data.as_slice());
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|_| PluginFileError::Internal("Failed to read plugin archive".into()))?;

    let info = read_metadata(&mut archive)
        .map_err(|_| PluginFileError::Internal("Failed to read plugin metadata".into()))?;

    // Only allow access to the entry file and declared assets
    let matching_asset = info.assets.iter().find(|a| a.path == file_path);
    let is_entry = file_path == info.entry;

    if !is_entry && matching_asset.is_none() {
        return Err(PluginFileError::Forbidden(
            "File not declared in plugin metadata".into(),
        ));
    }

    let mut file = archive
        .by_name(file_path)
        .map_err(|_| PluginFileError::NotFound("File not found in plugin".into()))?;

    let mut content = Vec::new();
    file.read_to_end(&mut content)
        .map_err(|_| PluginFileError::Internal("Failed to read file from archive".into()))?;

    let content_type = if let Some(asset) = matching_asset {
        validate_asset_image(&content, &asset.mime_type).map_err(|e| {
            PluginFileError::Internal(format!("Asset validation failed: {e}"))
        })?;
        asset_type_to_mime(&asset.mime_type).to_string()
    } else {
        let html = std::str::from_utf8(&content)
            .map_err(|_| PluginFileError::Internal("Entry file is not valid UTF-8".into()))?;
        crate::fastxml::parse(html).map_err(|e| {
            PluginFileError::Internal(format!("Entry file is not valid XHTML: {e}"))
        })?;
        "application/xhtml+xml".to_string()
    };

    Ok((content, content_type))
}

/// Read and parse metadata.json from an already-opened archive.
fn read_metadata(
    archive: &mut zip::ZipArchive<std::io::Cursor<&[u8]>>,
) -> Result<PluginInfo, ()> {
    let mut meta_file = archive.by_name("metadata.json").map_err(|_| ())?;
    let mut meta_text = String::new();
    meta_file.read_to_string(&mut meta_text).map_err(|_| ())?;
    drop(meta_file);

    let meta_value: serde_json::Value = serde_json::from_str(&meta_text).map_err(|_| ())?;
    validate_metadata(&meta_value).map_err(|_| ())
}

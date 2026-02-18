use crate::app_config;
use sc_plugin::plugin_server::read_plugin_file;
use sc_plugin::validation::{validate_plugin, PluginInfo};
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

    let plugins_dir = match ctx.app_handle().path().app_data_dir() {
        Ok(d) => d.join("plugins"),
        Err(_) => return error_response(500, b"Cannot resolve app data dir"),
    };

    match read_plugin_file(&plugins_dir, &plugin_name, &version, &file_path) {
        Ok((content, content_type)) => Response::builder()
            .status(200)
            .header("content-type", content_type)
            .header("access-control-allow-origin", "*")
            .body(content)
            .unwrap(),
        Err(e) => error_response(e.status(), e.to_string().as_bytes()),
    }
}

use super::udp::UdpState;
use crate::plugin;
use tauri::{Emitter, Manager, State, UriSchemeContext, Window};

/// Managed state holding the scope WebSocket server port.
pub struct ScopeWsPort(pub u16);

#[tauri::command]
pub fn scope_ws_port(state: State<'_, ScopeWsPort>) -> u16 {
    state.0
}

// --- URI scheme handler ---

pub fn handle_uri<R: tauri::Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    let data_dir = match ctx.app_handle().path().app_data_dir() {
        Ok(d) => d,
        Err(_) => {
            return tauri::http::Response::builder()
                .status(500)
                .header("access-control-allow-origin", "*")
                .body(b"Cannot resolve app data dir".to_vec())
                .unwrap();
        }
    };

    plugin::router::handle(&data_dir, &request)
}

// --- Tauri IPC commands ---

#[tauri::command]
pub async fn udp_bind(
    window: Window,
    local_addr: String,
    state: State<'_, UdpState>,
) -> Result<(), String> {
    state
        .bind(&local_addr, move |data| {
            let _ = window.emit("osc-data", data);
        })
        .await
}

#[tauri::command]
pub async fn udp_send(
    target: String,
    data: Vec<u8>,
    state: State<'_, UdpState>,
) -> Result<usize, String> {
    state.send(&target, &data).await
}

#[tauri::command]
pub async fn udp_close(state: State<'_, UdpState>) -> Result<(), String> {
    state.close().await
}

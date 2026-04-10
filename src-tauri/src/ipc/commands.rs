use super::{buf_reader, scope_shm, udp::UdpState};
use crate::plugin;
use tauri::{Emitter, Manager, State, UriSchemeContext, Window};

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

#[tauri::command]
pub async fn buf_read(
    target: String,
    bufnum: i32,
    start: i32,
    count: i32,
) -> Result<Vec<f32>, String> {
    buf_reader::read_buffer(&target, bufnum, start, count).await
}

#[tauri::command]
pub fn scope_shm_probe(port: u16) -> Result<scope_shm::ShmProbeResult, String> {
    scope_shm::probe(port)
}

#[tauri::command]
pub fn scope_shm_read(port: u16, max_samples: usize) -> Result<Vec<f32>, String> {
    scope_shm::read_scope(port, max_samples)
}

/// Unified scope buffer reader. Tries SHM first (for localhost connections),
/// falls back to OSC `/b_getn` transparently. The frontend calls this single
/// command — the backend picks the fastest available path.
#[tauri::command]
pub async fn scope_read(
    host: String,
    port: u16,
    bufnum: i32,
    count: i32,
) -> Result<Vec<f32>, String> {
    // Try SHM for localhost connections
    if host == "127.0.0.1" || host == "localhost" {
        if let Ok(floats) = scope_shm::read_scope(port, count as usize) {
            if !floats.is_empty() {
                return Ok(floats);
            }
        }
    }

    // Fall back to OSC buf_read
    let target = format!("{}:{}", host, port);
    buf_reader::read_buffer(&target, bufnum, 0, count).await
}

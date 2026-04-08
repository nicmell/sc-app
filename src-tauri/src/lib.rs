pub mod cli;
pub mod config;
pub mod http_server;
pub mod plugin_manager;
mod buf_reader;
mod scope_shm;
mod udp_server;

use tauri::{Emitter, Manager, State, UriSchemeContext, Window};
use udp_server::UdpState;

// --- URI scheme handler ---

fn handle_uri<R: tauri::Runtime>(
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

    http_server::handle(&data_dir, &request)
}

// --- Tauri commands ---

#[tauri::command]
async fn udp_bind(
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
async fn udp_send(
    target: String,
    data: Vec<u8>,
    state: State<'_, UdpState>,
) -> Result<usize, String> {
    state.send(&target, &data).await
}

#[tauri::command]
async fn udp_close(state: State<'_, UdpState>) -> Result<(), String> {
    state.close().await
}

#[tauri::command]
async fn buf_read(
    target: String,
    bufnum: i32,
    start: i32,
    count: i32,
) -> Result<Vec<f32>, String> {
    buf_reader::read_buffer(&target, bufnum, start, count).await
}

#[tauri::command]
fn scope_shm_probe(port: u16) -> Result<scope_shm::ShmProbeResult, String> {
    scope_shm::probe(port)
}

#[tauri::command]
fn scope_shm_read(port: u16, max_samples: usize) -> Result<Vec<f32>, String> {
    scope_shm::read_scope(port, max_samples)
}

// --- App entry ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(UdpState::new())
        .register_uri_scheme_protocol("app", handle_uri)
        .invoke_handler(tauri::generate_handler![
            udp_bind,
            udp_send,
            udp_close,
            buf_read,
            scope_shm_probe,
            scope_shm_read,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use super::buffer::{BufferStreamState, SubId, TauriChannelSink};
use super::udp::UdpState;
use crate::plugin;
use tauri::ipc::Channel;
use tauri::{Emitter, Manager, State, UriSchemeContext, Window};

// --- URI scheme handler (`app://…`) ---

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

    // Dispatch on the host portion of `app://<host>/…`. The router gets the
    // request with the host stripped from the path.
    let host = request.uri().host().unwrap_or("").to_string();
    match host.as_str() {
        "plugins" => plugin::router::handle(&data_dir, &request),
        _ => tauri::http::Response::builder()
            .status(404)
            .header("content-type", "text/plain")
            .header("access-control-allow-origin", "*")
            .body(b"Unknown app:// host".to_vec())
            .unwrap(),
    }
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
pub async fn buffer_subscribe(
    bufnum: i32,
    frames: i32,
    chunk: i32,
    sample_rate: i32,
    scsynth_addr: String,
    channel: Channel<Vec<f32>>,
    state: State<'_, BufferStreamState>,
) -> Result<SubId, String> {
    let sink = Box::new(TauriChannelSink { channel });
    state
        .subscribe(bufnum, frames, chunk, sample_rate, &scsynth_addr, sink)
        .await
}

#[tauri::command]
pub async fn buffer_unsubscribe(
    sub_id: SubId,
    state: State<'_, BufferStreamState>,
) -> Result<(), String> {
    state.unsubscribe(sub_id).await;
    Ok(())
}

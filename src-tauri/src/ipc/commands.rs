use super::buffer::{BufferStreamState, SubId, TauriChannelSink};
use super::recording::RecordingState;
use super::udp::UdpState;
use crate::plugin;
use serde::Serialize;
use tauri::ipc::Channel;
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
pub async fn buffer_subscribe(
    bufnum: i32,
    frames: i32,
    chunk: i32,
    scsynth_addr: String,
    channel: Channel<Vec<f32>>,
    state: State<'_, BufferStreamState>,
) -> Result<SubId, String> {
    let sink = Box::new(TauriChannelSink { channel });
    state
        .subscribe(bufnum, frames, chunk, &scsynth_addr, sink)
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

// --- Recording (DiskOut + file tail) ---

#[derive(Serialize)]
pub struct RecordHandle {
    pub id: String,
    pub path: String,
}

#[tauri::command]
pub async fn record_open(state: State<'_, RecordingState>) -> Result<RecordHandle, String> {
    let (id, path) = state.open().await;
    Ok(RecordHandle {
        id,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn record_tail_start(
    id: String,
    channel: Channel<Vec<f32>>,
    state: State<'_, RecordingState>,
) -> Result<(), String> {
    let sink = Box::new(TauriChannelSink { channel });
    state.start_tail(&id, sink).await
}

#[tauri::command]
pub async fn record_tail_stop(
    id: String,
    state: State<'_, RecordingState>,
) -> Result<(), String> {
    state.stop_tail(&id).await;
    Ok(())
}

#[tauri::command]
pub async fn record_read(
    id: String,
    state: State<'_, RecordingState>,
) -> Result<Vec<u8>, String> {
    state.read_all(&id).await
}

#[tauri::command]
pub async fn record_cleanup(
    id: String,
    state: State<'_, RecordingState>,
) -> Result<(), String> {
    state.cleanup(&id).await;
    Ok(())
}

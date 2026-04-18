use super::buffer::{BufferSink, BufferStreamState, SubId, TauriChannelSink};
use super::udp::UdpState;
use crate::{plugin, recording};
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager, State, UriSchemeContext, Window};

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
        "recordings" => recording::router::handle(&data_dir, &request),
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

/// Start a recording stream: poll `bufnum` via `/b_getn`, forward samples to
/// `channel` for the live waveform, and stream them into a WAV file at
/// `{data_dir}/recordings/{id}.wav`. Stop by calling `buffer_unsubscribe(sub_id)`;
/// the recording sink finalises the WAV header on drop.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn record_stream_start(
    app: AppHandle,
    id: String,
    bufnum: i32,
    frames: i32,
    chunk: i32,
    sample_rate: u32,
    channels: u16,
    scsynth_addr: String,
    channel: Channel<Vec<f32>>,
    buffer_state: State<'_, BufferStreamState>,
) -> Result<SubId, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("data dir: {e}"))?;
    let inner: Box<dyn BufferSink> = Box::new(TauriChannelSink { channel });
    recording::state::start_stream(
        &data_dir,
        &id,
        bufnum,
        frames,
        chunk,
        sample_rate,
        channels,
        &scsynth_addr,
        inner,
        &buffer_state,
    )
    .await
}

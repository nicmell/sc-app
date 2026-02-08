use std::sync::Arc;
use tauri::{Emitter, State, Window};
use tokio::net::UdpSocket;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;

struct UdpEntry {
    task: JoinHandle<()>,
    sock: Arc<UdpSocket>,
}

struct UdpState(RwLock<Option<UdpEntry>>);

#[tauri::command]
async fn udp_bind(
    window: Window,
    local_addr: String,
    state: State<'_, UdpState>,
) -> Result<(), String> {
    let mut guard = state.0.write().await;

    // Abort any existing recv task
    if let Some(entry) = guard.take() {
        entry.task.abort();
    }

    let sock = UdpSocket::bind(&local_addr)
        .await
        .map_err(|e| e.to_string())?;
    let arc = Arc::new(sock);
    let recv_sock = arc.clone();

    let task = tokio::task::spawn(async move {
        let mut buf = [0u8; 65536];
        loop {
            match recv_sock.recv_from(&mut buf).await {
                Ok((len, _)) => {
                    let _ = window.emit("osc-data", &buf[..len]);
                }
                Err(_) => break,
            }
        }
    });

    *guard = Some(UdpEntry { task, sock: arc });
    Ok(())
}

#[tauri::command]
async fn udp_send(
    target: String,
    data: Vec<u8>,
    state: State<'_, UdpState>,
) -> Result<usize, String> {
    let guard = state.0.read().await;
    let entry = guard.as_ref().ok_or("Socket not bound")?;
    entry
        .sock
        .send_to(&data, &target)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn udp_close(state: State<'_, UdpState>) -> Result<(), String> {
    let mut guard = state.0.write().await;
    if let Some(entry) = guard.take() {
        entry.task.abort();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(UdpState(RwLock::new(None)))
        .invoke_handler(tauri::generate_handler![udp_bind, udp_send, udp_close])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

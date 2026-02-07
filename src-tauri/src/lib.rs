use std::net::UdpSocket;
use std::sync::Mutex;
use tauri::State;

struct UdpState(Mutex<Option<UdpSocket>>);

#[tauri::command]
fn udp_bind(local_addr: String, state: State<UdpState>) -> Result<(), String> {
    let socket = UdpSocket::bind(&local_addr).map_err(|e| e.to_string())?;
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = Some(socket);
    Ok(())
}

#[tauri::command]
fn udp_send(target: String, data: Vec<u8>, state: State<UdpState>) -> Result<usize, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let socket = guard.as_ref().ok_or("Socket not bound")?;
    socket.send_to(&data, &target).map_err(|e| e.to_string())
}

#[tauri::command]
fn udp_close(state: State<UdpState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(UdpState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![udp_bind, udp_send, udp_close])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

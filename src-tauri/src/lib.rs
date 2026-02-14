mod plugin_manager;
mod udp_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(udp_server::UdpState::new())
        .register_uri_scheme_protocol("plugins", plugin_manager::handle)
        .invoke_handler(tauri::generate_handler![
            udp_server::bind,
            udp_server::send,
            udp_server::close,
            plugin_manager::install,
            plugin_manager::remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

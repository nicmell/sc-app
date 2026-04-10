use crate::{ipc, plugin, server};
use clap::{Parser, Subcommand};
use tauri::Manager;

#[derive(Parser)]
#[command(name = "sc-app", about = "SuperCollider plugin dashboard")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Start standalone HTTP server
    Serve {
        /// Server port
        #[arg(long, default_value_t = 3000, env = "SC_PORT")]
        port: u16,

        /// scsynth UDP address
        #[arg(long, default_value = "127.0.0.1:57110", env = "SC_SCSYNTH_ADDR")]
        scsynth: String,
    },

    /// Manage plugins
    #[command(subcommand)]
    Plugin(plugin::cli::PluginCommand),
}

/// Entry point. Dispatches to GUI, web server, or plugin commands.
/// Never returns — all branches either block or exit the process.
pub fn run(context: tauri::Context) -> ! {
    let cli = Cli::parse();

    match cli.command {
        None => {
            tauri::Builder::default()
                .plugin(tauri_plugin_opener::init())
                .plugin(tauri_plugin_fs::init())
                .manage(ipc::udp::UdpState::new())
                .register_uri_scheme_protocol("app", ipc::commands::handle_uri)
                .invoke_handler(tauri::generate_handler![
                    ipc::commands::udp_bind,
                    ipc::commands::udp_send,
                    ipc::commands::udp_close,
                    ipc::commands::scope_ws_port,
                ])
                .setup(|app| {
                    let scsynth = std::env::var("SC_SCSYNTH_ADDR")
                        .unwrap_or_else(|_| "127.0.0.1:57110".to_string());

                    // Start the scope WS server on a background thread with its own
                    // tokio runtime (the Tauri runtime isn't available yet in setup).
                    let (tx, rx) = std::sync::mpsc::channel();
                    std::thread::spawn(move || {
                        let rt = tokio::runtime::Runtime::new()
                            .expect("failed to create scope WS runtime");
                        let port = rt.block_on(server::scope_ws::start_server(scsynth))
                            .expect("failed to start scope WS server");
                        let _ = tx.send(port);
                        // Keep the runtime alive so spawned tasks continue running
                        rt.block_on(std::future::pending::<()>());
                    });

                    let port = rx.recv().expect("failed to receive scope WS port");
                    println!("Scope WS server on ws://127.0.0.1:{port}");
                    app.manage(ipc::commands::ScopeWsPort(port));
                    Ok(())
                })
                .run(context)
                .expect("error while running tauri application");
            std::process::exit(0);
        }
        Some(Command::Serve { port, scsynth }) => {
            server::serve(context, port, scsynth);
            std::process::exit(0);
        }
        Some(Command::Plugin(cmd)) => {
            match plugin::cli::run(cmd) {
                Ok(()) => std::process::exit(0),
                Err(e) => {
                    eprintln!("Error: {e}");
                    std::process::exit(1);
                }
            }
        }
    }
}

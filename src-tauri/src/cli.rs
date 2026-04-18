use crate::{ipc, plugin, server};
use clap::{Parser, Subcommand};

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
                ])
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

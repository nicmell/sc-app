mod cli;
mod config;
mod logging;
pub mod server;

/// Library entry point invoked by `src/main.rs`. Dispatches to the CLI,
/// which in turn either launches the Tauri GUI (no subcommand) or the
/// standalone HTTP+WS bridge (`bridge` subcommand).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    cli::run();
}

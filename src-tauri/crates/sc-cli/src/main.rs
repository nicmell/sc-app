fn main() {
    if !sc_plugin::cli::run() {
        eprintln!("Usage: sc-cli <command> [args]");
        eprintln!("Run 'sc-cli help' for available commands.");
        std::process::exit(1);
    }
}

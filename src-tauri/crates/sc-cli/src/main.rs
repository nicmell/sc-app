use std::path::PathBuf;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    // Handle "serve" before delegating to sc_plugin::cli::run()
    if args.get(1).map(|s| s.as_str()) == Some("serve") {
        match run_serve(&args[2..]) {
            Ok(()) => {}
            Err(e) => {
                eprintln!("Error: {e}");
                std::process::exit(1);
            }
        }
        return;
    }

    if !sc_plugin::cli::run() {
        eprintln!("Usage: sc-cli <command> [args]");
        eprintln!("Run 'sc-cli help' for available commands.");
        std::process::exit(1);
    }
}

fn run_serve(args: &[String]) -> Result<(), String> {
    let mut dist_dir: Option<PathBuf> = None;
    let mut port: u16 = 3000;
    let mut host = "0.0.0.0".to_string();
    let mut scsynth_addr = "127.0.0.1:57110".to_string();

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--dist" => {
                i += 1;
                dist_dir = Some(PathBuf::from(
                    args.get(i).ok_or("--dist requires a path")?,
                ));
            }
            "--port" => {
                i += 1;
                port = args
                    .get(i)
                    .ok_or("--port requires a number")?
                    .parse()
                    .map_err(|_| "--port must be a valid port number")?;
            }
            "--host" => {
                i += 1;
                host = args.get(i).ok_or("--host requires an address")?.clone();
            }
            "--scsynth" => {
                i += 1;
                scsynth_addr = args
                    .get(i)
                    .ok_or("--scsynth requires an address")?
                    .clone();
            }
            other => return Err(format!("Unknown option: {other}")),
        }
        i += 1;
    }

    let dist_dir = dist_dir.ok_or("--dist <path> is required")?;
    if !dist_dir.is_dir() {
        return Err(format!(
            "dist directory does not exist: {}",
            dist_dir.display()
        ));
    }

    let config = sc_server::ServeConfig {
        dist_dir,
        port,
        host,
        scsynth_addr,
    };

    let rt = tokio::runtime::Runtime::new().map_err(|e| format!("Failed to create runtime: {e}"))?;
    rt.block_on(sc_server::run(config))
}

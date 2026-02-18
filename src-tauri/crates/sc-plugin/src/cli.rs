use crate::validation;
use std::path::PathBuf;

const APP_IDENTIFIER: &str = "com.nicmell.scapp";

fn data_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        Ok(PathBuf::from(home)
            .join("Library/Application Support")
            .join(APP_IDENTIFIER))
    }
    #[cfg(target_os = "linux")]
    {
        let dir = std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_default();
            format!("{home}/.local/share")
        });
        Ok(PathBuf::from(dir).join(APP_IDENTIFIER))
    }
    #[cfg(target_os = "windows")]
    {
        let dir = std::env::var("APPDATA").map_err(|_| "APPDATA not set".to_string())?;
        Ok(PathBuf::from(dir).join(APP_IDENTIFIER))
    }
}

fn config_path() -> Result<PathBuf, String> {
    Ok(data_dir()?.join("config.json"))
}

fn read_config() -> Result<serde_json::Value, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

fn write_config(config: &serde_json::Value) -> Result<(), String> {
    let path = config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

fn print_plugin_info(info: &validation::PluginInfo) {
    println!("  name:    {}", info.name);
    println!("  version: {}", info.version);
    println!("  author:  {}", info.author);
    println!("  entry:   {}", info.entry);
    if !info.assets.is_empty() {
        println!("  assets:");
        for asset in &info.assets {
            println!("    - {} ({})", asset.path, asset.mime_type);
        }
    }
}

fn cmd_validate(path: &str) -> Result<(), String> {
    let data = std::fs::read(path).map_err(|e| format!("Error reading \"{path}\": {e}"))?;
    let info = validation::validate_plugin(&data)?;
    println!("Plugin is valid.");
    print_plugin_info(&info);
    Ok(())
}

fn cmd_add(path: &str) -> Result<(), String> {
    let data = std::fs::read(path).map_err(|e| format!("Error reading \"{path}\": {e}"))?;
    let info = validation::validate_plugin(&data)?;

    let plugins_dir = data_dir()?.join("plugins");
    std::fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;

    let zip_path = plugins_dir.join(format!("{}-{}.zip", &info.name, &info.version));
    std::fs::write(&zip_path, &data).map_err(|e| e.to_string())?;

    let mut config = read_config()?;
    let plugins = config
        .as_object_mut()
        .ok_or("config.json root must be an object")?
        .entry("plugins")
        .or_insert_with(|| serde_json::json!([]))
        .as_array_mut()
        .ok_or("config.json: \"plugins\" must be an array")?;

    plugins.retain(|p| {
        !(p.get("name").and_then(|v| v.as_str()) == Some(&info.name)
            && p.get("version").and_then(|v| v.as_str()) == Some(&info.version))
    });

    plugins.push(serde_json::to_value(&info).map_err(|e| e.to_string())?);
    write_config(&config)?;

    println!("Plugin added.");
    print_plugin_info(&info);
    Ok(())
}

fn cmd_remove(query: &str) -> Result<(), String> {
    let mut config = read_config()?;
    let plugins = config
        .as_object_mut()
        .ok_or("config.json root must be an object")?
        .get_mut("plugins")
        .and_then(|v| v.as_array_mut())
        .ok_or("No plugins installed")?;

    // Match by name, or by "name-version"
    let (match_name, match_version): (&str, Option<&str>) = match query.rsplit_once('-') {
        Some((n, v)) if v.contains('.') => (n, Some(v)),
        _ => (query, None),
    };

    let idx = plugins
        .iter()
        .position(|p| {
            let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let version = p.get("version").and_then(|v| v.as_str()).unwrap_or("");
            name == match_name
                && match_version.map_or(true, |v| version == v)
        })
        .ok_or_else(|| format!("Plugin \"{query}\" not found"))?;

    let entry = &plugins[idx];
    let name = entry.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let version = entry.get("version").and_then(|v| v.as_str()).unwrap_or("");
    let stem = format!("{name}-{version}");
    println!("Removing {name} v{version}...");

    plugins.remove(idx);
    write_config(&config)?;

    let zip_path = data_dir()?.join("plugins").join(format!("{stem}.zip"));
    if zip_path.exists() {
        std::fs::remove_file(&zip_path).map_err(|e| e.to_string())?;
    }

    println!("Plugin removed.");
    Ok(())
}

fn cmd_list() -> Result<(), String> {
    let config = read_config()?;
    let plugins = config
        .get("plugins")
        .and_then(|v| v.as_array())
        .filter(|a| !a.is_empty());

    match plugins {
        Some(list) => {
            println!("Installed plugins:");
            for p in list {
                let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("?");
                let version = p.get("version").and_then(|v| v.as_str()).unwrap_or("?");
                let author = p.get("author").and_then(|v| v.as_str()).unwrap_or("?");
                println!("  {name} v{version} by {author}");
            }
        }
        None => println!("No plugins installed."),
    }
    Ok(())
}

fn print_usage() {
    eprintln!("Usage: sc-cli <command> [args]");
    eprintln!();
    eprintln!("Commands:");
    eprintln!("  validate <path>   Validate a plugin zip file");
    eprintln!("  add <path>        Validate and install a plugin");
    eprintln!("  remove <name>     Remove a plugin (by name or name-version)");
    eprintln!("  list              List installed plugins");
    eprintln!("  serve [options]   Start HTTP server with OSC bridge");
    eprintln!();
    eprintln!("Serve options:");
    eprintln!("  --dist <path>     Path to dist directory (required)");
    eprintln!("  --port <number>   Port to listen on (default: 3000)");
    eprintln!("  --host <addr>     Host to bind to (default: 0.0.0.0)");
    eprintln!("  --scsynth <addr>  scsynth address (default: 127.0.0.1:57110)");
}

/// Run the CLI. Returns `true` if a CLI command was handled, `false` if the GUI should start.
pub fn run() -> bool {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        return false;
    }

    let result = match args[1].as_str() {
        "validate" => args
            .get(2)
            .ok_or_else(|| "Usage: sc-cli validate <path>".to_string())
            .and_then(|p| cmd_validate(p)),
        "add" => args
            .get(2)
            .ok_or_else(|| "Usage: sc-cli add <path>".to_string())
            .and_then(|p| cmd_add(p)),
        "remove" => args
            .get(2)
            .ok_or_else(|| "Usage: sc-cli remove <name>".to_string())
            .and_then(|q| cmd_remove(q)),
        "list" => cmd_list(),
        "serve" => {
            // Handled by sc-cli binary directly; if we get here it means
            // the Tauri binary was invoked with "serve" — just print usage.
            eprintln!("The 'serve' command is only available via the sc-cli binary.");
            std::process::exit(1);
        }
        "help" | "--help" | "-h" => {
            print_usage();
            std::process::exit(0);
        }
        other => {
            eprintln!("Unknown command: {other}");
            print_usage();
            std::process::exit(1);
        }
    };

    match result {
        Ok(()) => std::process::exit(0),
        Err(e) => {
            eprintln!("Error: {e}");
            std::process::exit(1);
        }
    }
}

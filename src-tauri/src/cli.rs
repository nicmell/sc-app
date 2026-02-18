use crate::config;
use crate::plugin_manager;

fn print_plugin_info(info: &plugin_manager::PluginInfo) {
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
    let info = plugin_manager::validate_plugin(&data)?;
    println!("Plugin is valid.");
    print_plugin_info(&info);
    Ok(())
}

fn cmd_add(path: &str) -> Result<(), String> {
    let data = std::fs::read(path).map_err(|e| format!("Error reading \"{path}\": {e}"))?;
    let info = plugin_manager::validate_plugin(&data)?;

    let data_dir = config::data_dir()?;
    let plugins_dir = config::plugins_dir(&data_dir);
    std::fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;

    let zip_path = plugins_dir.join(format!("{}-{}.{}.zip", &info.name, &info.version, &info.id));
    std::fs::write(&zip_path, &data).map_err(|e| e.to_string())?;

    let mut cfg = config::read(&data_dir)?;
    let plugins = cfg
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
    config::write(&data_dir, &cfg)?;

    println!("Plugin added.");
    print_plugin_info(&info);
    Ok(())
}

fn cmd_remove(query: &str) -> Result<(), String> {
    let data_dir = config::data_dir()?;
    let mut cfg = config::read(&data_dir)?;
    let plugins = cfg
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
    let id = entry.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let name = entry.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let version = entry.get("version").and_then(|v| v.as_str()).unwrap_or("").to_string();
    println!("Removing {name} v{version}...");

    plugins.remove(idx);
    config::write(&data_dir, &cfg)?;

    let zip_path = config::plugins_dir(&data_dir).join(format!("{name}-{version}.{id}.zip"));
    if zip_path.exists() {
        std::fs::remove_file(&zip_path).map_err(|e| e.to_string())?;
    }

    println!("Plugin removed.");
    Ok(())
}

fn cmd_list() -> Result<(), String> {
    let config = config::read(&config::data_dir()?)?;
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
    eprintln!("Usage: sc-app <command> [args]");
    eprintln!();
    eprintln!("Commands:");
    eprintln!("  validate <path>   Validate a plugin zip file");
    eprintln!("  add <path>        Validate and install a plugin");
    eprintln!("  remove <name>     Remove a plugin (by name or name-version)");
    eprintln!("  list              List installed plugins");
    eprintln!();
    eprintln!("If no command is given, the GUI is launched.");
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
            .ok_or_else(|| "Usage: sc-app validate <path>".to_string())
            .and_then(|p| cmd_validate(p)),
        "add" => args
            .get(2)
            .ok_or_else(|| "Usage: sc-app add <path>".to_string())
            .and_then(|p| cmd_add(p)),
        "remove" => args
            .get(2)
            .ok_or_else(|| "Usage: sc-app remove <name>".to_string())
            .and_then(|q| cmd_remove(q)),
        "list" => cmd_list(),
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

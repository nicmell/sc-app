use crate::config;
use crate::plugin::manager;
use clap::Subcommand;

#[derive(Subcommand)]
pub enum PluginCommand {
    /// Validate a plugin zip file
    Validate {
        /// Path to plugin zip
        path: String,
    },
    /// Validate and install a plugin
    Add {
        /// Path to plugin zip
        path: String,
    },
    /// Remove a plugin by name or name-version
    Remove {
        /// Plugin name or name-version
        name: String,
    },
    /// List installed plugins
    List,
}

pub fn run(cmd: PluginCommand) -> Result<(), String> {
    match cmd {
        PluginCommand::Validate { path } => cmd_validate(&path),
        PluginCommand::Add { path } => cmd_add(&path),
        PluginCommand::Remove { name } => cmd_remove(&name),
        PluginCommand::List => cmd_list(),
    }
}

fn print_plugin_info(info: &manager::PluginInfo) {
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
    let info = manager::validate_plugin(&data)?;
    println!("Plugin is valid.");
    print_plugin_info(&info);
    Ok(())
}

fn cmd_add(path: &str) -> Result<(), String> {
    let data = std::fs::read(path).map_err(|e| format!("Error reading \"{path}\": {e}"))?;
    let info = manager::validate_plugin(&data)?;

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

    let (match_name, match_version): (&str, Option<&str>) = match query.rsplit_once('-') {
        Some((n, v)) if v.contains('.') => (n, Some(v)),
        _ => (query, None),
    };

    let idx = plugins
        .iter()
        .position(|p| {
            let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let version = p.get("version").and_then(|v| v.as_str()).unwrap_or("");
            name == match_name && match_version.map_or(true, |v| version == v)
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

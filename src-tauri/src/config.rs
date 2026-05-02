//! Config file loader.
//!
//! Schema: all fields optional. Missing fields fall through to
//! env > built-in defaults. Unknown fields are a hard error
//! (`deny_unknown_fields`) so typos surface loudly at parse time
//! instead of silently doing nothing.
//!
//! Discovery:
//! - **Bridge mode**: `--config <path>` if explicitly passed
//!   (fails loudly if the file doesn't exist), else
//!   [`LINUX_SYSTEM_PATH`] auto-discovered (silent if absent).
//! - **GUI mode**: `app.path().app_config_dir()/config.json`,
//!   written with defaults on first launch via
//!   [`Config::write_default_if_missing`].
//!
//! Diagnostics from this module use `eprintln!` rather than
//! `tracing::*` because config loads in both bridge and GUI mode
//! happen *before* `init_tracing` runs (the config can specify
//! `log_dir`, which feeds into tracing init). After tracing is up,
//! callers log a positive "loaded config from X" line via the
//! tracing macros so it lands in the rotated file alongside
//! everything else.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// System-wide config path. Bridge mode auto-discovers this when
/// `--config` isn't passed; GUI mode ignores it (uses
/// `app_config_dir` instead).
pub const LINUX_SYSTEM_PATH: &str = "/etc/sc-app/config.json";

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Config {
    /// HTTP port to bind for the bridge.
    pub port: Option<u16>,
    /// Default scsynth address (host:port). Treated as the implicit
    /// catch-all route target — packets whose OSC address doesn't
    /// match any prefix in `routes` are sent here. Per-WS overrides
    /// via `?scsynth=` still work.
    pub scsynth: Option<String>,
    /// Directory to write rotated NDJSON logs into. When `None` in
    /// both config + env + flag, the bridge stays stderr-only and
    /// the GUI falls back to `app.path().app_log_dir()`.
    pub log_dir: Option<PathBuf>,
    /// Optional OSC address-prefix routes. Walked top-to-bottom;
    /// first `prefix` whose value is a `starts_with` match against
    /// the packet's OSC address wins. Non-matching packets fall back
    /// to `scsynth`. Empty / absent ⇒ single-target behaviour
    /// identical to pre-Phase-26.
    #[serde(default)]
    pub routes: Vec<Route>,
}

/// One entry in the bridge's routing table.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Route {
    /// OSC address prefix to match (e.g. `"/dirt"`, `"/midi/note"`).
    pub prefix: String,
    /// `host:port` for the route's UDP target. Resolved at boot.
    pub target: String,
}

impl Config {
    /// Read + parse a config file. Returns `Ok(None)` if the file
    /// is absent, `Ok(Some(_))` if present and valid, `Err` if
    /// present but unparseable / unreadable.
    pub fn load(path: &Path) -> anyhow::Result<Option<Self>> {
        match std::fs::read_to_string(path) {
            Ok(s) => Ok(Some(serde_json::from_str::<Self>(&s)?)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Write a starter `config.json` to `path` if it doesn't already
    /// exist. Idempotent — never overwrites existing user edits.
    /// Used by GUI mode on first launch to give the user something
    /// to discover and edit.
    pub fn write_default_if_missing(path: &Path) {
        if path.exists() {
            return;
        }
        if let Some(parent) = path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                eprintln!(
                    "[config] could not create {}: {e}",
                    parent.display()
                );
                return;
            }
        }
        // Hand-written so the on-disk file matches what the user
        // sees in the docs. Keep keys minimal — log_dir is omitted
        // so first-launch users get the platform-standard default.
        let body = "{\n  \"port\": 3000,\n  \"scsynth\": \"127.0.0.1:57110\"\n}\n";
        if let Err(e) = std::fs::write(path, body) {
            eprintln!(
                "[config] could not write default config to {}: {e}",
                path.display()
            );
        } else {
            eprintln!("[config] wrote default config to {}", path.display());
        }
    }
}

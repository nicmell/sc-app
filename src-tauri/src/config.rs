//! Config file loader.
//!
//! Schema: all fields optional. Missing fields fall through to
//! env > built-in defaults. Unknown fields are a hard error
//! (`deny_unknown_fields`) so typos surface loudly at parse time
//! instead of silently doing nothing.
//!
//! Discovery (bridge mode, see `cli::resolve_bridge_config`):
//! 1. `--config <path>` if explicitly passed (must exist).
//! 2. `./config.json` — project-local, picked up by `yarn bridge`
//!    and `yarn dev:full` from the repo root.
//! 3. [`LINUX_SYSTEM_PATH`] — for systemd deployments.
//!
//! Discovery (GUI mode):
//! - `app.path().app_config_dir()/config.json`, written with
//!   [`STARTER`] values on first launch via
//!   [`Config::write_default_if_missing`].
//!
//! Two distinct "defaults":
//! - [`Config::default`] (derived) — all `None` / empty Vec. Used
//!   as the "no config file present" fallback after the discovery
//!   walk fails. Layered under env-var overrides + built-in
//!   defaults in `cli/mod.rs`.
//! - [`STARTER`] (this module) — the values we ship to disk on
//!   first launch so the user sees something concrete to edit.
//!   Kept as a struct, not a hand-written JSON literal, so any new
//!   field on `Config` is reflected in the on-disk file
//!   automatically.
//!
//! Diagnostics from this module use `eprintln!` rather than
//! `tracing::*` because config loads happen *before* `init_tracing`
//! runs (the config can specify `log_dir`, which feeds into
//! tracing init). After tracing is up, callers log a positive
//! "loaded config from X" line via the tracing macros so it lands
//! in the rotated file alongside everything else.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

/// System-wide config path. Bridge mode auto-discovers this when
/// `--config` isn't passed; GUI mode ignores it (uses
/// `app_config_dir` instead).
pub const LINUX_SYSTEM_PATH: &str = "/etc/sc-app/config.json";

/// Built-in default port for the bridge HTTP listener.
pub const DEFAULT_PORT: u16 = 3000;

/// Built-in default scsynth address (the implicit catch-all route
/// target).
pub const DEFAULT_SCSYNTH: &str = "127.0.0.1:57110";

/// Built-in default sclang+SuperDirt address. The starter config
/// pre-populates a `/dirt → DEFAULT_DIRT` route so a first-launch
/// GUI / tauri-dev session has working SuperDirt routing without
/// the user having to edit `config.json` first. (Phase 26 +
/// `scripts/start-osc.sh` always assume sclang on this port.)
pub const DEFAULT_DIRT: &str = "127.0.0.1:57120";

/// Built-in default TTL for idle bridge-managed sessions.
/// 30 minutes is generous enough to forgive someone walking
/// away from a tab, short enough that maxLogins=8 (scsynth's
/// default) doesn't fill up after a handful of orphaned tabs.
pub const DEFAULT_SESSION_TTL_SECONDS: u64 = 1800;

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Config {
    /// HTTP port to bind for the bridge.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    /// Default scsynth address (host:port). Treated as the implicit
    /// catch-all route target — packets whose OSC address doesn't
    /// match any prefix in `routes` are sent here. Per-WS overrides
    /// via `?scsynth=` still work.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scsynth: Option<String>,
    /// Directory to write rotated NDJSON logs into. When `None` in
    /// both config + env + flag, the bridge stays stderr-only and
    /// the GUI falls back to `app.path().app_log_dir()`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_dir: Option<PathBuf>,
    /// Optional OSC address-prefix routes. Walked top-to-bottom;
    /// first `prefix` whose value is a `starts_with` match against
    /// the packet's OSC address wins. Non-matching packets fall back
    /// to `scsynth`. Empty / absent ⇒ single-target behaviour
    /// identical to pre-Phase-26.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub routes: Vec<Route>,
    /// Phase 29d: how long an idle bridge-managed session lingers
    /// before TTL cleanup evicts it (and runs the
    /// /g_freeAll + /n_free + /notify 0 teardown bundle). The
    /// background scan runs once per minute; sessions whose
    /// `last_active` is older than this value get dropped on the
    /// next tick. None ⇒ DEFAULT_SESSION_TTL_SECONDS (1800).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_ttl_seconds: Option<u64>,
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

/// Lazily-initialised starter config. Built once on first access
/// and reused. Distinct from [`Config::default`] (which is all
/// `None` / empty); this is what we *write to disk* for the user
/// to discover and edit on first launch.
static STARTER_CELL: OnceLock<Config> = OnceLock::new();

/// Accessor for the starter config struct. Construction goes
/// through here (not a free-floating function) so the values are
/// visible-by-reference at module scope and any future field
/// additions on `Config` need only one update site.
pub fn starter() -> &'static Config {
    STARTER_CELL.get_or_init(|| Config {
        port: Some(DEFAULT_PORT),
        scsynth: Some(DEFAULT_SCSYNTH.to_string()),
        log_dir: None,
        // Phase 26 seeded `/dirt`; Phase 30 adds `/clock` to the
        // same sclang process. Both prefixes route to DEFAULT_DIRT
        // because the SuperDirt startup script owns both responders
        // (`OSCdef(\scAppListSamples)` for /dirt/listSamples and
        // `OSCdef(\scAppClockHello)` for /clock/hello).
        routes: vec![
            Route {
                prefix: "/dirt".into(),
                target: DEFAULT_DIRT.into(),
            },
            Route {
                prefix: "/clock".into(),
                target: DEFAULT_DIRT.into(),
            },
        ],
        session_ttl_seconds: None,
    })
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
    ///
    /// Body is serialized from [`starter`] via serde, so any field
    /// added to `Config` (with `skip_serializing_if` for
    /// `None`/empty) is reflected on disk automatically.
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
        let body = match serde_json::to_string_pretty(starter()) {
            Ok(s) => s + "\n",
            Err(e) => {
                eprintln!(
                    "[config] could not serialize starter config: {e}"
                );
                return;
            }
        };
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


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starter_serializes_to_clean_json() {
        let body = serde_json::to_string_pretty(starter()).unwrap();
        // Should have port, scsynth, and both SuperDirt-process
        // routes (`/dirt` from Phase 26, `/clock` from Phase 30 —
        // both responders live in scripts/sc-app-superdirt-startup.scd
        // so first-launch GUI / tauri-dev sessions route correctly
        // without manual config editing). log_dir is None and
        // serializes-skipped.
        assert!(body.contains("\"port\": 3000"));
        assert!(body.contains("\"scsynth\": \"127.0.0.1:57110\""));
        assert!(body.contains("\"prefix\": \"/dirt\""));
        assert!(body.contains("\"prefix\": \"/clock\""));
        assert!(body.contains("\"target\": \"127.0.0.1:57120\""));
        assert!(!body.contains("log_dir"));
    }

    #[test]
    fn config_with_routes_roundtrips() {
        let cfg = Config {
            port: Some(3000),
            scsynth: Some("127.0.0.1:57110".into()),
            log_dir: Some("./logs".into()),
            routes: vec![Route {
                prefix: "/dirt".into(),
                target: "127.0.0.1:57120".into(),
            }],
            session_ttl_seconds: Some(900),
        };
        let json = serde_json::to_string_pretty(&cfg).unwrap();
        let back: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(back.port, Some(3000));
        assert_eq!(back.routes.len(), 1);
        assert_eq!(back.routes[0].prefix, "/dirt");
    }
}

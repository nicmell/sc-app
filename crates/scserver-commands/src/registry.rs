//! Command registry — tiny metadata table for every scraped SC command
//! and reply. Useful for UIs and reflection.

use serde::Serialize;

#[path = "registry_data.rs"]
mod generated;

/// One entry in the server-command catalogue.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct CommandEntry {
    /// OSC address, e.g. `"/s_new"`.
    pub address: &'static str,
    /// Source file basename (`master`, `node`, `buffer`, …).
    pub category: &'static str,
    /// One-line description scraped from the SC docs.
    pub description: &'static str,
}

pub fn all_commands() -> &'static [CommandEntry] {
    generated::ALL_COMMANDS
}

pub fn lookup(address: &str) -> Option<&'static CommandEntry> {
    generated::ALL_COMMANDS
        .iter()
        .find(|e| e.address == address)
}

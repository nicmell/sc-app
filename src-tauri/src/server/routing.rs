//! OSC address-prefix routing.
//!
//! [`RoutingTable`] is built once at boot from
//! [`crate::config::Config::routes`] and the resolved default
//! `scsynth` address. The bridge clones it per-WS, optionally
//! overriding the default with the connection's `?scsynth=` query
//! param, then opens one UDP socket per unique target.
//!
//! Routes are walked in user order — first `starts_with` match
//! wins, no auto-sort. If multiple prefixes overlap (e.g. `/dirt`
//! and `/dirt/play`), the user must list the more specific one
//! first.
//!
//! [`peek_osc_address`] is the cheap address extractor used per
//! packet on the WS→UDP hot path. It walks `#bundle` envelopes to
//! the first inner message and returns its address — sufficient for
//! routing because real-world bundles are uniform-target. Mixed-
//! target bundles aren't supported (documented limitation).

use std::collections::HashSet;
use std::net::SocketAddr;

use anyhow::{anyhow, Result};
use tokio::net::lookup_host;

use crate::config::Route;

#[derive(Debug, Clone)]
pub struct RoutingTable {
    /// User's order; first prefix-match wins.
    routes: Vec<(String, SocketAddr)>,
    /// Catch-all when no route matches.
    default: SocketAddr,
}

impl RoutingTable {
    /// Build a table from the resolved default + config-side route
    /// entries. Each `Route::target` is resolved (IP literal or
    /// hostname) at boot via `tokio::net::lookup_host`. Empty
    /// prefixes are rejected because they would shadow the default.
    pub async fn build(default: SocketAddr, routes: &[Route]) -> Result<Self> {
        let mut resolved: Vec<(String, SocketAddr)> = Vec::with_capacity(routes.len());
        for route in routes {
            if route.prefix.is_empty() {
                return Err(anyhow!(
                    "config.routes: empty prefix is not allowed (would shadow the default)"
                ));
            }
            let target = resolve_target(&route.target).await.map_err(|e| {
                anyhow!(
                    "config.routes: failed to resolve target {:?} for prefix {:?}: {e}",
                    route.target,
                    route.prefix
                )
            })?;
            resolved.push((route.prefix.clone(), target));
        }
        Ok(Self {
            routes: resolved,
            default,
        })
    }

    /// Pick the target for an OSC address. First user-order
    /// `starts_with` match wins; otherwise fall back to default.
    pub fn route_for(&self, address: &str) -> SocketAddr {
        for (prefix, target) in &self.routes {
            if address.starts_with(prefix.as_str()) {
                return *target;
            }
        }
        self.default
    }

    /// Default route target. Used by the bridge to attach Phase 22
    /// snoop / cleanup logic — those are scsynth-specific concerns.
    pub fn default_target(&self) -> SocketAddr {
        self.default
    }

    /// Replace the default route's target. Used by the WS handler
    /// to honour `?scsynth=` per-connection overrides without
    /// mutating the global table.
    pub fn set_default(&mut self, target: SocketAddr) {
        self.default = target;
    }

    /// Distinct UDP target addresses (default + each route's
    /// target, deduplicated). The bridge binds one ephemeral UDP
    /// socket per entry.
    pub fn unique_targets(&self) -> Vec<SocketAddr> {
        let mut seen: HashSet<SocketAddr> = HashSet::new();
        let mut out: Vec<SocketAddr> = Vec::new();
        if seen.insert(self.default) {
            out.push(self.default);
        }
        for (_, target) in &self.routes {
            if seen.insert(*target) {
                out.push(*target);
            }
        }
        out
    }

    /// Pretty-print for boot-time logging (no Debug noise).
    pub fn describe(&self) -> String {
        if self.routes.is_empty() {
            return format!("default → {}", self.default);
        }
        let mut s = String::new();
        for (prefix, target) in &self.routes {
            s.push_str(&format!("    {prefix} → {target}\n"));
        }
        s.push_str(&format!("    (default) → {}", self.default));
        s
    }
}

/// Resolve a `host:port` string into a `SocketAddr`. IP literals
/// parse synchronously; hostnames go through `lookup_host`.
async fn resolve_target(s: &str) -> Result<SocketAddr> {
    if let Ok(addr) = s.parse::<SocketAddr>() {
        return Ok(addr);
    }
    let mut iter = lookup_host(s).await?;
    iter.next()
        .ok_or_else(|| anyhow!("no addresses for {s}"))
}

/// Peek the OSC address from a UDP payload without full decode.
/// For a `#bundle`, walks the envelope to the first inner message
/// and returns its address. Returns `None` on parse failure or
/// empty address — caller should fall back to the default route.
///
/// The hot path: called per WS→UDP packet, including `/b_getn` at
/// 48+ Hz. Allocation-free; just byte arithmetic + a UTF-8 check.
pub fn peek_osc_address(bytes: &[u8]) -> Option<&str> {
    let mut current = bytes;
    loop {
        if current.starts_with(b"#bundle\0") {
            // 8 (#bundle\0) + 8 (timetag) + 4 (size of first
            // element) = 20-byte envelope before the first inner
            // packet starts. We don't need the size value itself
            // because we recurse into the inner packet, which
            // self-describes via its own bytes.
            if current.len() < 20 {
                return None;
            }
            current = &current[20..];
            continue;
        }
        let null_pos = current.iter().position(|&b| b == 0)?;
        if null_pos == 0 {
            return None;
        }
        // OSC addresses are ASCII; ASCII is valid UTF-8.
        return std::str::from_utf8(&current[..null_pos]).ok();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn peek_address_bare_message() {
        // /done\0\0\0  (8 bytes, 4-byte aligned)
        let bytes = b"/done\0\0\0";
        assert_eq!(peek_osc_address(bytes), Some("/done"));
    }

    #[test]
    fn peek_address_in_bundle() {
        // #bundle\0 + timetag (8 zeros) + size (4 bytes) + /dirt/play\0\0
        let mut bytes: Vec<u8> = Vec::new();
        bytes.extend_from_slice(b"#bundle\0");
        bytes.extend_from_slice(&[0u8; 8]);
        bytes.extend_from_slice(&12u32.to_be_bytes());
        bytes.extend_from_slice(b"/dirt/play\0\0");
        assert_eq!(peek_osc_address(&bytes), Some("/dirt/play"));
    }

    #[test]
    fn peek_address_truncated_bundle_returns_none() {
        let bytes = b"#bundle\0";
        assert_eq!(peek_osc_address(bytes), None);
    }

    #[test]
    fn route_for_matches_prefix() {
        let table = RoutingTable {
            routes: vec![
                ("/dirt".into(), "127.0.0.1:57120".parse().unwrap()),
            ],
            default: "127.0.0.1:57110".parse().unwrap(),
        };
        assert_eq!(table.route_for("/dirt/play"), "127.0.0.1:57120".parse().unwrap());
        assert_eq!(table.route_for("/s_new"), "127.0.0.1:57110".parse().unwrap());
    }

    #[test]
    fn route_first_match_wins() {
        // /dirt/play comes before /dirt — more specific should be
        // ordered first by the user.
        let table = RoutingTable {
            routes: vec![
                ("/dirt/play".into(), "127.0.0.1:1".parse().unwrap()),
                ("/dirt".into(), "127.0.0.1:2".parse().unwrap()),
            ],
            default: "127.0.0.1:3".parse().unwrap(),
        };
        assert_eq!(table.route_for("/dirt/play"), "127.0.0.1:1".parse().unwrap());
        assert_eq!(table.route_for("/dirt/hello"), "127.0.0.1:2".parse().unwrap());
        assert_eq!(table.route_for("/g_new"), "127.0.0.1:3".parse().unwrap());
    }

    #[test]
    fn unique_targets_deduplicates() {
        let table = RoutingTable {
            routes: vec![
                ("/a".into(), "127.0.0.1:1".parse().unwrap()),
                ("/b".into(), "127.0.0.1:1".parse().unwrap()), // same as /a
                ("/c".into(), "127.0.0.1:2".parse().unwrap()),
            ],
            default: "127.0.0.1:3".parse().unwrap(),
        };
        let targets = table.unique_targets();
        assert_eq!(targets.len(), 3);
        assert!(targets.contains(&"127.0.0.1:3".parse().unwrap()));
        assert!(targets.contains(&"127.0.0.1:1".parse().unwrap()));
        assert!(targets.contains(&"127.0.0.1:2".parse().unwrap()));
    }
}

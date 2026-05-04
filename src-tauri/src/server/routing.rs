//! OSC address-regex routing.
//!
//! [`RoutingTable`] is built once at boot from
//! [`crate::config::Config::routes`]. Each route's regex is compiled
//! at build time — a malformed pattern is a startup error.
//!
//! Routes are walked in user order — first regex match wins. There
//! is **no implicit default** (Phase 37 retired the catch-all). If
//! a packet's address matches no route AND isn't claimed by a
//! middleware, the bridge drops it with a `warn!` log.
//!
//! [`peek_osc_address`] is the cheap address extractor used per
//! packet on the WS→UDP hot path. It walks `#bundle` envelopes to
//! the first inner message and returns its address — sufficient for
//! routing because real-world bundles are uniform-target. Mixed-
//! target bundles aren't supported (documented limitation).

use std::collections::HashSet;
use std::net::SocketAddr;

use anyhow::{anyhow, Result};
use regex::Regex;
use tokio::net::lookup_host;

use crate::config::Route;

#[derive(Debug, Clone)]
pub struct RoutingTable {
    /// User's order; first regex match wins. No implicit default
    /// (Phase 37).
    routes: Vec<(Regex, SocketAddr)>,
}

impl RoutingTable {
    /// Build a table from the config-side route entries. Each
    /// `Route::pattern` is compiled with the `regex` crate; each
    /// `Route::target` is resolved (IP literal or hostname) at
    /// boot via `tokio::net::lookup_host`. A malformed regex or
    /// unresolvable target is a startup error.
    pub async fn build(routes: &[Route]) -> Result<Self> {
        let mut resolved: Vec<(Regex, SocketAddr)> = Vec::with_capacity(routes.len());
        for route in routes {
            if route.pattern.is_empty() {
                return Err(anyhow!(
                    "config.routes: empty pattern is not allowed (would match every address)"
                ));
            }
            let regex = Regex::new(&route.pattern).map_err(|e| {
                anyhow!(
                    "config.routes: invalid regex {:?} for target {:?}: {e}",
                    route.pattern,
                    route.target
                )
            })?;
            let target = resolve_target(&route.target).await.map_err(|e| {
                anyhow!(
                    "config.routes: failed to resolve target {:?} for pattern {:?}: {e}",
                    route.target,
                    route.pattern
                )
            })?;
            resolved.push((regex, target));
        }
        Ok(Self { routes: resolved })
    }

    /// Pick the target for an OSC address. First user-order regex
    /// match wins; returns `None` if no route matches. Caller
    /// (the dispatcher) handles the no-match case (drop + warn).
    pub fn route_for(&self, address: &str) -> Option<SocketAddr> {
        for (regex, target) in &self.routes {
            if regex.is_match(address) {
                return Some(*target);
            }
        }
        None
    }

    /// Distinct UDP target addresses (each route's target,
    /// deduplicated). The bridge binds one ephemeral UDP socket
    /// per entry plus one for the scsynth handshake address (which
    /// `Session::create` opens explicitly outside the routes
    /// table).
    pub fn unique_targets(&self) -> Vec<SocketAddr> {
        let mut seen: HashSet<SocketAddr> = HashSet::new();
        let mut out: Vec<SocketAddr> = Vec::new();
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
            return "(no routes)".to_string();
        }
        let mut s = String::new();
        for (regex, target) in &self.routes {
            s.push_str(&format!("    {} → {target}\n", regex.as_str()));
        }
        s.push_str("    (no implicit default — orphan addresses drop+warn)");
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
/// empty address — caller drops the packet with a warning.
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

    fn re(s: &str) -> Regex {
        Regex::new(s).unwrap()
    }

    fn addr(s: &str) -> SocketAddr {
        s.parse().unwrap()
    }

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
    fn route_for_basic_match() {
        let table = RoutingTable {
            routes: vec![(re(r"^/dirt(/|$)"), addr("127.0.0.1:57120"))],
        };
        assert_eq!(table.route_for("/dirt/play"), Some(addr("127.0.0.1:57120")));
        assert_eq!(table.route_for("/dirt"), Some(addr("127.0.0.1:57120")));
    }

    #[test]
    fn route_for_no_match_returns_none() {
        let table = RoutingTable {
            routes: vec![(re(r"^/dirt(/|$)"), addr("127.0.0.1:57120"))],
        };
        // Phase 37: no implicit default. /s_new doesn't match the
        // /dirt pattern, so no route.
        assert_eq!(table.route_for("/s_new"), None);
    }

    #[test]
    fn route_first_match_wins() {
        // More-specific pattern listed first; less-specific second.
        let table = RoutingTable {
            routes: vec![
                (re(r"^/dirt/play$"), addr("127.0.0.1:1")),
                (re(r"^/dirt(/|$)"), addr("127.0.0.1:2")),
            ],
        };
        assert_eq!(table.route_for("/dirt/play"), Some(addr("127.0.0.1:1")));
        assert_eq!(table.route_for("/dirt/hello"), Some(addr("127.0.0.1:2")));
        assert_eq!(table.route_for("/g_new"), None);
    }

    #[test]
    fn route_anchored_prefix_doesnt_overmatch() {
        // The starter sclang regex must NOT match /dirts/something
        // (a non-/dirt address that happens to start with /dirt).
        // The `(/|$)` anchor on /dirt prevents this.
        let table = RoutingTable {
            routes: vec![(re(r"^/(dirt|clock|scope)(/|$)"), addr("127.0.0.1:57120"))],
        };
        assert_eq!(table.route_for("/dirt/play"), Some(addr("127.0.0.1:57120")));
        assert_eq!(table.route_for("/dirt"), Some(addr("127.0.0.1:57120")));
        assert_eq!(table.route_for("/dirts/extra"), None);
        assert_eq!(table.route_for("/scope/allocate"), Some(addr("127.0.0.1:57120")));
    }

    #[test]
    fn route_scsynth_command_surface_matches() {
        // The starter scsynth regex covers the /[sngbcdpu]_*
        // command families plus the named global commands.
        // Reply-side addresses (`/done`, `/fail`, `/tr`,
        // `/status.reply`, `/n_go`, `/n_end`, …) come INBOUND
        // from scsynth and are never routed outbound, so it's
        // fine that some of them happen to also match the
        // outbound regex (`/n_go` ⊂ `/n_` family). The bridge
        // never sends them.
        let table = RoutingTable {
            routes: vec![(
                re(r"^/([sngbcdpu]_|notify|status|sync|cmd|dumpOSC|clearSched|error|quit|version)"),
                addr("127.0.0.1:57110"),
            )],
        };
        for addr_str in [
            "/s_new", "/n_free", "/g_new", "/b_alloc", "/b_getn", "/c_set",
            "/d_recv", "/p_new", "/u_cmd", "/notify", "/status", "/sync",
            "/cmd", "/dumpOSC", "/clearSched", "/error", "/quit", "/version",
        ] {
            assert!(
                table.route_for(addr_str).is_some(),
                "expected scsynth regex to match {addr_str}"
            );
        }
        // Addresses that DON'T match: /done, /fail, /tr (these
        // don't share a prefix with any command-family letter).
        // Plus addresses outside the scsynth surface entirely.
        assert_eq!(table.route_for("/done"), None);
        assert_eq!(table.route_for("/fail"), None);
        assert_eq!(table.route_for("/dirt/play"), None);
        assert_eq!(table.route_for("/scope/subscribe"), None);
        // Reply addresses that DO accidentally match the regex
        // (`/status.reply` shares the `/status` prefix; `/n_go`
        // shares `/n_`). Harmless in practice — the worker never
        // sends these outbound.
        assert!(table.route_for("/status.reply").is_some());
        assert!(table.route_for("/n_go").is_some());
    }

    #[test]
    fn unique_targets_deduplicates() {
        let table = RoutingTable {
            routes: vec![
                (re(r"^/a"), addr("127.0.0.1:1")),
                (re(r"^/b"), addr("127.0.0.1:1")), // same as /a
                (re(r"^/c"), addr("127.0.0.1:2")),
            ],
        };
        let targets = table.unique_targets();
        assert_eq!(targets.len(), 2);
        assert!(targets.contains(&addr("127.0.0.1:1")));
        assert!(targets.contains(&addr("127.0.0.1:2")));
    }
}

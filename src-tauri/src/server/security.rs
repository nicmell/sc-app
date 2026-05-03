//! Loopback identity validation (Phase 34).
//!
//! axum binds to 127.0.0.1, but loopback-binding alone doesn't
//! defend against two attacks the Phase 25 webview-on-HTTP shift
//! exposed:
//!
//! 1. **DNS rebinding** — a hostile site rebinds its DNS to
//!    127.0.0.1 mid-session. The browser still treats the page
//!    as `attacker.com` origin (Same-Origin Policy), but the
//!    bytes go to the local bridge. Mitigation: reject any
//!    request whose `Host` header doesn't name a loopback
//!    hostname.
//!
//! 2. **Cross-origin WebSocket upgrades** — WebSocket handshakes
//!    are NOT subject to SOP the way `fetch` is; any page can
//!    `new WebSocket('ws://127.0.0.1:3000/ws')`. Mitigation:
//!    reject WS upgrades whose `Origin` header doesn't name a
//!    loopback origin.
//!
//! Both hosts and origins allow any port — the bridge is bound
//! loopback-only so any port hitting it is by definition a
//! loopback port. Validating the hostname is the load-bearing
//! check.
//!
//! TLS was considered as an alternative for #1 (the cert wouldn't
//! match `attacker.com` after rebinding, breaking the handshake)
//! but adds cert-provisioning friction, doesn't compose with
//! `yarn dev:full` cleanly, and doesn't help #2 or against
//! same-machine non-browser callers anyway. Header validation is
//! cheaper and more effective.

use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::Next;
use axum::response::Response;

/// Returns true iff `host` (the value of an HTTP `Host` header)
/// names a loopback address. The port is ignored — bridge is
/// loopback-bound, so any port that reaches us is by definition
/// a loopback port.
pub fn host_is_allowed(host: &str) -> bool {
    let hostname = strip_port(host);
    is_loopback_hostname(hostname)
}

/// Returns true iff `origin` (the value of an HTTP `Origin`
/// header) names a loopback origin. Accepts `http://` and
/// `https://` schemes plus `tauri://localhost` (legacy Tauri
/// builds pre-Phase-25, harmless to allow).
pub fn origin_is_allowed(origin: &str) -> bool {
    if origin == "tauri://localhost" {
        return true;
    }
    let rest = if let Some(r) = origin.strip_prefix("http://") {
        r
    } else if let Some(r) = origin.strip_prefix("https://") {
        r
    } else {
        return false;
    };
    // Origin should be just `scheme://host[:port]`, no path. But
    // be lenient and strip a path segment if present.
    let host_with_port = rest.split('/').next().unwrap_or(rest);
    let hostname = strip_port(host_with_port);
    is_loopback_hostname(hostname)
}

/// axum middleware enforcing `host_is_allowed` on every HTTP
/// request. Layered before `with_state` in `serve_on()`.
pub async fn enforce_host(
    req: Request,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    let host = req
        .headers()
        .get("host")
        .and_then(|v| v.to_str().ok());
    match host {
        Some(h) if host_is_allowed(h) => Ok(next.run(req).await),
        Some(h) => {
            tracing::warn!(host = %h, "rejected request with non-loopback Host header");
            // 421 Misdirected Request is the OWASP-recommended
            // status for DNS-rebinding rejection: the server is
            // saying "I am not the host you think you reached."
            Err((
                StatusCode::MISDIRECTED_REQUEST,
                format!("Host header '{h}' not allowed (loopback-only bridge)"),
            ))
        }
        None => {
            tracing::warn!("rejected request with missing Host header");
            // HTTP/1.1 requires Host. Missing = malformed.
            Err((
                StatusCode::BAD_REQUEST,
                "missing Host header".into(),
            ))
        }
    }
}

/// Read the `Origin` header from a WebSocket upgrade request and
/// reject if present-and-mismatched. Missing Origin is allowed:
/// browsers always send it on WS upgrade (the WebSocket API
/// cannot suppress it), so a missing Origin means a non-browser
/// caller, which can already bypass any browser-side defense by
/// talking TCP directly. Letting curl-style clients connect for
/// debugging is a minor convenience; it doesn't weaken the
/// browser-attack defense.
pub fn check_ws_origin(headers: &HeaderMap) -> Result<(), (StatusCode, String)> {
    let Some(origin) = headers.get("origin").and_then(|v| v.to_str().ok()) else {
        return Ok(());
    };
    if origin_is_allowed(origin) {
        Ok(())
    } else {
        tracing::warn!(origin = %origin, "rejected WS upgrade with non-loopback Origin");
        Err((
            StatusCode::FORBIDDEN,
            format!("Origin '{origin}' not allowed (loopback-only bridge)"),
        ))
    }
}

fn strip_port(host_with_port: &str) -> &str {
    // IPv6 form: `[::1]:port` or `[::1]` — strip brackets first.
    if let Some(stripped) = host_with_port.strip_prefix('[') {
        if let Some(end) = stripped.find(']') {
            return &stripped[..end];
        }
    }
    // IPv4 / hostname: `host:port` or `host`. Use rsplit_once so
    // we strip from the rightmost colon (no IPv6 ambiguity left
    // after the bracket strip).
    host_with_port
        .rsplit_once(':')
        .map(|(h, _)| h)
        .unwrap_or(host_with_port)
}

fn is_loopback_hostname(hostname: &str) -> bool {
    matches!(hostname, "127.0.0.1" | "localhost" | "::1")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_loopback_v4_accepted() {
        assert!(host_is_allowed("127.0.0.1"));
        assert!(host_is_allowed("127.0.0.1:3000"));
        assert!(host_is_allowed("127.0.0.1:1420"));
        // Any port is fine — bridge is loopback-bound.
        assert!(host_is_allowed("127.0.0.1:65535"));
    }

    #[test]
    fn host_loopback_localhost_accepted() {
        assert!(host_is_allowed("localhost"));
        assert!(host_is_allowed("localhost:3000"));
        assert!(host_is_allowed("localhost:1420"));
    }

    #[test]
    fn host_loopback_v6_accepted() {
        assert!(host_is_allowed("[::1]"));
        assert!(host_is_allowed("[::1]:3000"));
    }

    #[test]
    fn host_external_rejected() {
        assert!(!host_is_allowed("attacker.com"));
        assert!(!host_is_allowed("attacker.com:3000"));
        assert!(!host_is_allowed("example.com:443"));
        assert!(!host_is_allowed("192.168.1.10"));
        assert!(!host_is_allowed("192.168.1.10:3000"));
        // 0.0.0.0 means "all interfaces" but the literal string
        // isn't a loopback hostname.
        assert!(!host_is_allowed("0.0.0.0:3000"));
        // Public DNS resolvers — definitely external.
        assert!(!host_is_allowed("8.8.8.8"));
        // Empty / nonsense strings.
        assert!(!host_is_allowed(""));
        assert!(!host_is_allowed(":3000"));
    }

    #[test]
    fn origin_loopback_accepted() {
        assert!(origin_is_allowed("http://127.0.0.1:3000"));
        assert!(origin_is_allowed("http://127.0.0.1"));
        assert!(origin_is_allowed("http://localhost:1420"));
        assert!(origin_is_allowed("http://localhost:3000"));
        assert!(origin_is_allowed("https://127.0.0.1:3000"));
        assert!(origin_is_allowed("https://localhost:3000"));
        assert!(origin_is_allowed("http://[::1]:3000"));
    }

    #[test]
    fn origin_legacy_tauri_accepted() {
        // Pre-Phase-25 Tauri builds used the tauri:// custom
        // protocol. Allow it for legacy bundles that may still
        // be served by an upgraded bridge.
        assert!(origin_is_allowed("tauri://localhost"));
    }

    #[test]
    fn origin_external_rejected() {
        assert!(!origin_is_allowed("http://attacker.com"));
        assert!(!origin_is_allowed("https://attacker.com:3000"));
        assert!(!origin_is_allowed("http://192.168.1.10:3000"));
        // file:// and `null` Origins (sandboxed iframes,
        // file:/// pages) — reject. Legitimate browser pages
        // never produce these for our deployment.
        assert!(!origin_is_allowed("file:///some/path"));
        assert!(!origin_is_allowed("null"));
        // Missing scheme.
        assert!(!origin_is_allowed("127.0.0.1:3000"));
        assert!(!origin_is_allowed("localhost"));
        // Empty.
        assert!(!origin_is_allowed(""));
    }

    #[test]
    fn origin_with_path_strips_correctly() {
        // Origins shouldn't have paths per spec, but be lenient.
        assert!(origin_is_allowed("http://localhost:3000/some/path"));
        assert!(!origin_is_allowed("http://attacker.com/127.0.0.1"));
    }

    #[test]
    fn strip_port_handles_all_forms() {
        assert_eq!(strip_port("127.0.0.1:3000"), "127.0.0.1");
        assert_eq!(strip_port("127.0.0.1"), "127.0.0.1");
        assert_eq!(strip_port("localhost:1420"), "localhost");
        assert_eq!(strip_port("[::1]:3000"), "::1");
        assert_eq!(strip_port("[::1]"), "::1");
        // Pathological — empty after the colon.
        assert_eq!(strip_port("host:"), "host");
    }
}

//! Address-keyed middleware dispatch (Phase 37).
//!
//! Two registries — outbound (WS → bridge → UDP) and inbound (UDP →
//! bridge → WS) — let the bridge claim OSC addresses for in-process
//! handling before the routing table is consulted. The user's
//! "callback accepting next" intent is honored via the
//! [`MiddlewareOutcome::PassThrough`] variant — that's literally
//! what calling `next()` means.
//!
//! ## Dispatch order (both directions)
//!
//! 1. Peek the OSC address with [`super::routing::peek_osc_address`].
//! 2. Walk the registry top-down; first regex match wins.
//! 3. Middleware body returns a [`MiddlewareOutcome`]:
//!    - `Consumed` → stop, do nothing else.
//!    - `PassThrough` → continue to the default action.
//!    - `ConsumedAndSend(bytes)` → run the default action on `bytes`
//!      instead of the original payload.
//! 4. If no middleware claimed (or returned `PassThrough`), do the
//!    default:
//!    - **Outbound**: [`super::routing::RoutingTable::route_for`] +
//!      UDP send. No match ⇒ `warn!` log + drop.
//!    - **Inbound**: forward the original payload to the WS sink.
//!
//! ## Why an enum + match instead of `dyn Trait`
//!
//! The middleware set is a fixed in-tree list (~5 entries for the
//! initial scope work). Trait-object dispatch with `dyn Future`
//! would box a future per packet on the hot path; enum-and-match
//! avoids that. If a third-party plugin surface ever emerges, the
//! enum can be promoted to a trait.
//!
//! Phase 37b lands the infrastructure with empty enums; Phase 37c
//! populates them with the scope middlewares relocated from
//! `ws_bridge.rs`.

use std::net::SocketAddr;
use std::sync::Arc;

use regex::Regex;

use super::session::Session;

/// Outcome of a middleware invocation.
#[derive(Debug)]
pub enum MiddlewareOutcome {
    /// Middleware fully handled the packet; bridge does nothing
    /// else for this dispatch.
    Consumed,
    /// Run the default action (routing on outbound, ws-sink
    /// forward on inbound). Equivalent to calling `next()` in
    /// Express-style middleware.
    PassThrough,
    /// Suppress the original payload and apply the default action
    /// to these bytes instead. Outbound: the new bytes are routed.
    /// Inbound: the new bytes go to the WS sink.
    ConsumedAndSend(Vec<u8>),
}

/// Which leg of the OSC pipe this dispatch is on.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    /// WS → bridge → UDP (outbound from frontend's perspective).
    Outbound,
    /// UDP → bridge → WS (inbound to frontend's perspective).
    Inbound,
}

/// Per-call middleware context. The dispatcher constructs this
/// from already-acquired locks/borrows; the handler body holds it
/// for one packet only.
///
/// Phase 37b: fields are unused (no middleware variants yet);
/// 37c populates them.
#[allow(dead_code)]
pub(crate) struct WsCtx<'a> {
    pub session: &'a Arc<Session>,
    /// Scope state. Already locked by the dispatcher; handler
    /// gets exclusive mutable access for the duration of the
    /// callback. Phase 37b leaves the concrete type to
    /// [`super::ws_bridge::ScopeContext`]; 37c will reshape this
    /// as the scope middlewares move.
    pub scope: &'a mut super::ws_bridge::ScopeContext,
    pub direction: Direction,
    /// Inbound only: which UDP target this payload arrived from
    /// (the broadcast forwarder knows). `None` for outbound.
    pub source_target: Option<SocketAddr>,
}

/// Outbound middlewares (claim addresses heading WS → bridge →
/// UDP). Phase 37c populates the variants for scope subscribe /
/// unsubscribe.
#[derive(Clone, Copy, Debug)]
pub enum OutboundMiddleware {
    /// Phase 37c will add the scope variants. Empty enum (no
    /// variants) is intentional — the registry can hold a
    /// `Vec<(Regex, OutboundMiddleware)>` but it's always empty
    /// in 37b. The dispatcher's `match` over `*mw` is then
    /// trivially exhaustive (matching on an uninhabited type).
    #[doc(hidden)]
    _Phantom,
}

/// Inbound middlewares (claim addresses heading UDP → bridge →
/// WS). Phase 37c populates the variants for scope chunk
/// emission, `/b_getn` issuance, and `/b_setn` interception.
#[derive(Clone, Copy, Debug)]
pub enum InboundMiddleware {
    /// Same shape as `OutboundMiddleware::_Phantom`. Phase 37c
    /// adds real variants.
    #[doc(hidden)]
    _Phantom,
}

/// Address-pattern → middleware registry. Walked top-down on
/// every dispatch; first regex match wins.
pub struct MiddlewareRegistry<M> {
    entries: Vec<(Regex, M)>,
}

impl<M> MiddlewareRegistry<M> {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    /// Compile the pattern and append to the registry. Panics on
    /// invalid regex — registrations are program-built (not
    /// user-supplied), so a bad regex is a programmer error.
    pub fn register(&mut self, pattern: &str, mw: M) {
        let regex = Regex::new(pattern)
            .unwrap_or_else(|e| panic!("middleware regex {pattern:?}: {e}"));
        self.entries.push((regex, mw));
    }

    /// Iterate over middlewares whose pattern matches the given
    /// address. The dispatcher walks this in registration order;
    /// the first one that doesn't return `PassThrough` wins.
    pub fn iter_matching<'a>(&'a self, address: &'a str) -> impl Iterator<Item = &'a M> + 'a {
        self.entries.iter().filter_map(move |(re, m)| {
            if re.is_match(address) {
                Some(m)
            } else {
                None
            }
        })
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

impl<M> Default for MiddlewareRegistry<M> {
    fn default() -> Self {
        Self::new()
    }
}

/// Dispatch an outbound packet through the registry. Returns the
/// outcome of the first matching middleware, or `PassThrough` if
/// none matched. Caller (recv loop in `ws_bridge`) is responsible
/// for the default routing path.
///
/// Async because middleware bodies (37c) may need to call
/// `target_sockets[..].send().await` etc.
#[allow(dead_code)] // Phase 37b: wired in 37c.
pub(crate) async fn dispatch_outbound<'a>(
    registry: &MiddlewareRegistry<OutboundMiddleware>,
    ctx: &mut WsCtx<'a>,
    address: &str,
    payload: &[u8],
) -> MiddlewareOutcome {
    for mw in registry.iter_matching(address) {
        let outcome = invoke_outbound(*mw, ctx, address, payload).await;
        match outcome {
            MiddlewareOutcome::PassThrough => continue,
            other => return other,
        }
    }
    MiddlewareOutcome::PassThrough
}

/// Dispatch an inbound payload through the registry. Same shape
/// as [`dispatch_outbound`]; default action on `PassThrough` is
/// "forward to WS sink".
#[allow(dead_code)] // Phase 37b: wired in 37c.
pub(crate) async fn dispatch_inbound<'a>(
    registry: &MiddlewareRegistry<InboundMiddleware>,
    ctx: &mut WsCtx<'a>,
    address: &str,
    payload: &[u8],
) -> MiddlewareOutcome {
    for mw in registry.iter_matching(address) {
        let outcome = invoke_inbound(*mw, ctx, address, payload).await;
        match outcome {
            MiddlewareOutcome::PassThrough => continue,
            other => return other,
        }
    }
    MiddlewareOutcome::PassThrough
}

/// Outbound dispatch table. Phase 37c implements the variants;
/// 37b matches on the empty `_Phantom` placeholder, which never
/// gets constructed (the registry is always empty in 37b).
async fn invoke_outbound<'a>(
    mw: OutboundMiddleware,
    _ctx: &mut WsCtx<'a>,
    _address: &str,
    _payload: &[u8],
) -> MiddlewareOutcome {
    match mw {
        OutboundMiddleware::_Phantom => MiddlewareOutcome::PassThrough,
    }
}

/// Inbound dispatch table. Same shape as [`invoke_outbound`].
async fn invoke_inbound<'a>(
    mw: InboundMiddleware,
    _ctx: &mut WsCtx<'a>,
    _address: &str,
    _payload: &[u8],
) -> MiddlewareOutcome {
    match mw {
        InboundMiddleware::_Phantom => MiddlewareOutcome::PassThrough,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_iter_matching_first_match_wins() {
        // Two entries both matching `/scope/subscribe`; the
        // dispatcher walks them in registration order. We're not
        // testing the dispatcher itself here (would need a Ctx +
        // tokio runtime); just the registry's matching iterator.
        let mut reg: MiddlewareRegistry<u32> = MiddlewareRegistry::new();
        reg.register(r"^/scope/", 1);
        reg.register(r"^/scope/subscribe$", 2);
        let matches: Vec<u32> = reg.iter_matching("/scope/subscribe").copied().collect();
        assert_eq!(matches, vec![1, 2]);
    }

    #[test]
    fn registry_no_match_yields_empty() {
        let mut reg: MiddlewareRegistry<u32> = MiddlewareRegistry::new();
        reg.register(r"^/dirt/", 1);
        let matches: Vec<u32> = reg.iter_matching("/s_new").copied().collect();
        assert!(matches.is_empty());
    }

    #[test]
    fn registry_empty_is_empty() {
        let reg: MiddlewareRegistry<u32> = MiddlewareRegistry::new();
        assert!(reg.is_empty());
        assert!(reg.iter_matching("/anything").next().is_none());
    }

    #[test]
    #[should_panic(expected = "middleware regex")]
    fn registry_panics_on_invalid_regex() {
        let mut reg: MiddlewareRegistry<u32> = MiddlewareRegistry::new();
        reg.register(r"[unclosed", 1);
    }
}

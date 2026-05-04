//! Scope-data ingestion. Two ingestion modes are supported, picked
//! per-session at `Session::create` time:
//!
//! - [`shm`] — Phase 31's hot path. mmap scsynth's
//!   Boost.Interprocess scope-buffer pool; read slots non-mutating
//!   on each observed `/clock/tick`. Tap synth uses `ScopeOut2.ar`;
//!   frontend allocates via `/scope/allocate`.
//! - [`osc`] — Phase 36's fallback. Poll scsynth via OSC `/b_getn`
//!   on each observed `/clock/tick`; intercept `/b_setn` replies
//!   from the broadcast stream. Tap synth uses `BufWr.ar` with a
//!   `clockBus`-driven `writeIdx`; frontend allocates via
//!   `/b_alloc`.
//!
//! Both modes emit identical 0x03 chunk frames on the main `/ws`
//! — see `server::ws_bridge` for the dispatch glue.

pub mod osc;
pub mod shm;

/// Phase 36: which scope-data ingestion path is in use for a
/// session. Frozen at `Session::create` time. Frontend mirrors
/// this choice when picking SynthDef + buffer allocation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScopeMode {
    /// Bridge mmaps scsynth's SHM scope_buffer pool, reads slots
    /// non-mutating on each observed `/clock/tick`. Tap synth
    /// uses `ScopeOut2.ar`; frontend allocates via `/scope/allocate`.
    Shm,
    /// Bridge polls scsynth via OSC `/b_getn` on each observed
    /// `/clock/tick`, intercepts the matching `/b_setn` replies
    /// from the broadcast stream. Tap synth uses `BufWr.ar` with
    /// a `clockBus`-driven writeIdx; frontend allocates via
    /// `/b_alloc`.
    Osc,
}

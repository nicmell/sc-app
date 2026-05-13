//! Bridge-managed per-tab sessions.
//!
//! Phase 29 introduced per-session UDP sockets and per-session
//! `/notify`. Phase 39a hoisted those up to the bridge level
//! (one [`super::server::Server`] per route target, one
//! `/notify` for the bridge's lifetime). A Session is now
//! lightweight per-tab bookkeeping:
//!
//! - `session_id` — UUID in the tab's `sessionStorage`.
//! - `session_slot` — bridge-allocated (0..MAX_SESSIONS),
//!   partitions the node-ID space within the bridge's single
//!   `clientId` (see [`SessionSlotAllocator`]). Bridge-internal;
//!   not exposed on the wire — frontend derives its
//!   [`IdAllocator`] base from `parent_group_id` directly.
//! - `parent_group_id` — `bridge_client_id * 1_000_000 +
//!   session_slot * 100_000 + 100`, unique per session.
//! - `scope_mode` — Phase 36 SHM/OSC choice, frozen at create.
//!
//! No UDP sockets, no broadcast channels, no recv tasks — those
//! all live on the shared `Server`s in `AppState.servers`. The
//! cleanup bundle (`/g_freeAll <pgid> + /n_free <pgid>`) is sent
//! via the shared scsynth Server; `/notify 0` only runs at
//! bridge shutdown.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use rosc::{OscBundle, OscMessage, OscPacket, OscTime, OscType};
use serde::Serialize;
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

use super::server::{ClockMetadata, DirtSample, ScsynthVersion, Server};
use crate::scope::ScopeMode;

/// `parent_group_id` partitioning constants. The bridge runs one
/// `/notify 1` and gets a single `clientId`; sessions further
/// partition that 1M-id slice into 100K-id chunks. The 100 offset
/// keeps the group ID clear of scsynth's root group (id 0) and
/// sclang's defaultGroup (id 1) when `bridge_client_id=0` and
/// `session_slot=0`.
///
/// `bridge_client_id × 1_000_000` clears sclang+SuperDirt's
/// node-ID range when sharing scsynth (sclang at clientId=0
/// allocates from 1000+; SuperDirt orbits land 1000–1999).
const BRIDGE_CLIENT_STRIDE: i32 = 1_000_000;
const SESSION_SLOT_STRIDE: i32 = 100_000;
const PARENT_GROUP_OFFSET: i32 = 100;

/// Maximum concurrent sessions. Each session owns a
/// `session_slot` in `[0, MAX_SESSIONS)`. The bridge-level
/// `clientId * 1_000_000` space is partitioned into N
/// 100_000-id slices; MAX_SESSIONS=10 keeps the slices clean
/// without overflowing into the next clientId range.
pub const MAX_SESSIONS: u8 = 10;

/// Allocator for session-scoped `session_slot`s. Free-list based;
/// sessions allocate on `Session::create` and free on cleanup.
/// Hard cap at [`MAX_SESSIONS`] — over-cap returns `None`, which
/// the API layer renders as 503. Bridge-internal: the slot itself
/// never crosses the wire — the frontend reads `parent_group_id`
/// and derives its `IdAllocator` base from there.
pub struct SessionSlotAllocator {
    free_list: Mutex<Vec<u8>>,
}

impl SessionSlotAllocator {
    pub fn new() -> Self {
        // Initialize with all IDs free, in reverse so `pop()`
        // hands out 0, 1, 2, … in order (cosmetic).
        let free_list: Vec<u8> = (0..MAX_SESSIONS).rev().collect();
        Self {
            free_list: Mutex::new(free_list),
        }
    }

    pub async fn alloc(&self) -> Option<u8> {
        let mut list = self.free_list.lock().await;
        list.pop()
    }

    pub async fn free(&self, id: u8) {
        let mut list = self.free_list.lock().await;
        if !list.contains(&id) {
            list.push(id);
        }
    }
}

impl Default for SessionSlotAllocator {
    fn default() -> Self {
        Self::new()
    }
}

/// One bridge-managed session — per-tab bookkeeping. No UDP
/// sockets (those live on `AppState.servers`); just identity +
/// routing-relevant metadata.
pub struct Session {
    pub session_id: Uuid,
    /// Phase 39a: bridge-allocated slot in `[0, MAX_SESSIONS)`.
    /// Partitions the bridge's node-ID space across sessions.
    /// Bridge-internal — the wire only carries `parent_group_id`
    /// (which encodes the slot via the partitioning formula).
    pub session_slot: u8,
    /// `bridge_client_id × 1_000_000 + session_slot × 100_000 +
    /// 100`. Unique per session; the frontend's `IdAllocator`
    /// base is `parent_group_id + 900`.
    pub parent_group_id: i32,
    #[allow(dead_code)] // 29d uses this for the TTL job's cold-start log line.
    pub created_at: Instant,
    pub last_active: RwLock<Instant>,
    /// Phase 36: which scope-data path this session uses. Probed
    /// at `Session::create` (or forced via `--no-shm`); frozen
    /// for the session's lifetime.
    pub scope_mode: ScopeMode,
}

impl Session {
    /// Mint a new session: allocate a `session_slot`, derive
    /// the `parent_group_id`, capture `scope_mode`. Pure
    /// bookkeeping — no UDP, no handshake (the bridge ran
    /// `/notify` once at boot via the scsynth Server).
    pub async fn create(
        session_slot_allocator: &SessionSlotAllocator,
        scsynth_server: &Arc<Server>,
        force_osc_mode: bool,
    ) -> Result<Self> {
        let session_slot = session_slot_allocator.alloc().await.ok_or_else(|| {
            anyhow!(
                "session limit reached ({} concurrent sessions); close a tab and retry",
                MAX_SESSIONS
            )
        })?;
        let bridge_client_id = scsynth_server
            .metadata()
            .await
            .scsynth_client_id
            .ok_or_else(|| anyhow!("scsynth Server has no clientId — bridge not bootstrapped"))?;
        // Bridge-clientId-scoped partition stays clear of
        // sclang+SuperDirt's node range (clientId=0 allocator
        // starts at 1000; SuperDirt orbits land 1000–1999). The
        // +100 offset keeps slot=0 on bridge clientId=0 from
        // colliding with the root group (id 0).
        let parent_group_id = bridge_client_id * BRIDGE_CLIENT_STRIDE
            + (session_slot as i32) * SESSION_SLOT_STRIDE
            + PARENT_GROUP_OFFSET;

        // Phase 36: probe SHM availability for this session. The
        // probe is cheap; running it per-session lets a future
        // mid-runtime config change apply on next session even
        // if the bridge process kept running.
        let scope_mode = if force_osc_mode {
            ScopeMode::Osc
        } else {
            let probe = crate::scope::shm::probe(scsynth_server.target().port());
            if probe.available {
                ScopeMode::Shm
            } else {
                tracing::info!(
                    path = ?probe.path,
                    error = ?probe.error,
                    "SHM scope path unavailable; falling back to OSC /b_getn mode"
                );
                ScopeMode::Osc
            }
        };

        let session_id = Uuid::new_v4();
        let now = Instant::now();
        tracing::info!(
            session_id = %session_id,
            bridge_client_id,
            session_slot,
            parent_group_id,
            scope_mode = ?scope_mode,
            "session created"
        );
        Ok(Self {
            session_id,
            session_slot,
            parent_group_id,
            created_at: now,
            last_active: RwLock::new(now),
            scope_mode,
        })
    }

    /// Bump `last_active`. Called from `GET /api/session/:id` and
    /// the WS attach point.
    pub async fn touch(&self) {
        *self.last_active.write().await = Instant::now();
    }

    /// Cleanup at session-end (DELETE or TTL eviction). Sends
    /// `/g_freeAll(parent_group_id) + /n_free(parent_group_id)`
    /// via the shared scsynth Server. Phase 39a: NO `/notify 0`
    /// (the bridge owns the single registration, dropped at
    /// bridge shutdown). Returns `session_slot` to the
    /// allocator.
    pub async fn cleanup(
        &self,
        scsynth_server: &Arc<Server>,
        session_slot_allocator: &SessionSlotAllocator,
    ) {
        if let Err(e) = send_session_cleanup(scsynth_server, self.parent_group_id).await {
            tracing::warn!(
                session_id = %self.session_id,
                error = %e,
                "session cleanup encode/send failed"
            );
        } else {
            tracing::info!(
                session_id = %self.session_id,
                parent_group = self.parent_group_id,
                "session cleanup bundle sent"
            );
        }
        // Brief flush window so kernel-queued datagrams reach
        // scsynth before we move on.
        tokio::time::sleep(Duration::from_millis(50)).await;
        session_slot_allocator.free(self.session_slot).await;
    }
}

/// JSON shape returned by `POST /api/session` and
/// `GET /api/session/:id`. camelCase to match the JS consumer.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: Uuid,
    /// scsynth's bridge-level `clientId` (Phase 39a: shared
    /// across all sessions; the bridge's single `/notify`
    /// registration). Informational — the frontend derives its
    /// `IdAllocator` base from `parent_group_id` directly.
    pub scsynth_client_id: i32,
    /// scsynth's address (host:port). Frontend uses the port to
    /// derive the SHM file path.
    pub scsynth: String,
    /// Nominal sample rate from `/status.reply`.
    pub sample_rate: u32,
    /// Bridge-allocated unique parent group node ID for this
    /// session. Frontend derives `IdAllocator` base as
    /// `parent_group_id + 900` (synth nodes) and
    /// `parent_group_id + 5900` (buffers).
    pub parent_group_id: i32,
    /// Phase 36: SHM vs OSC fallback.
    pub scope_mode: ScopeMode,
    /// Phase 39b: cached clock metadata from sclang's bootstrap
    /// reply. `None` if sclang isn't reachable / the bootstrap
    /// hasn't completed — clock-dependent UI handles this
    /// gracefully (Connect screen shows "sclang not reachable").
    pub clock: Option<ClockMetadata>,
    /// Phase 39b: scope buffer pool size from sclang's
    /// `s.scopeBufferAllocator` range.
    pub num_scope_buffers: Option<i32>,
    /// Phase 39b: snapshot of `~dirt.buffers` at sclang boot.
    /// Frontend's sequencer panel populates the sample-name
    /// autocomplete from this list — no per-session
    /// `/dirt/listSamples` round-trip.
    pub dirt_samples: Vec<DirtSample>,
    /// Phase 39 hotfix: scsynth version captured at bridge
    /// boot. Surfaced on SessionInfo so the dashboard footer
    /// doesn't need a per-session `/version` round-trip (which
    /// hit the routing-orphan path post-Phase-37 since
    /// `/version` wasn't in the scsynth regex).
    pub scsynth_version: Option<ScsynthVersion>,
}

/// Build the public-API view of this session by combining
/// per-session state with bridge-wide Server metadata.
pub async fn session_info(
    session: &Session,
    scsynth_server: &Arc<Server>,
    sclang_server: Option<&Arc<Server>>,
) -> Result<SessionInfo> {
    let (scsynth_client_id, sample_rate, scsynth_version) = {
        let m = scsynth_server.metadata().await;
        let scsynth_client_id = m
            .scsynth_client_id
            .ok_or_else(|| anyhow!("scsynth Server has no clientId — bridge not bootstrapped"))?;
        let sample_rate = m
            .sample_rate
            .ok_or_else(|| anyhow!("scsynth Server has no sample rate — bridge not bootstrapped"))?;
        // Phase 40: scsynth_version moved back onto scsynth's
        // metadata. Pre-40 sclang captured it at its own boot and
        // echoed via the bootstrap reply; Phase 40 has the bridge
        // probe /version directly during the scsynth handshake.
        let scsynth_version = m.scsynth_version.clone();
        (scsynth_client_id, sample_rate, scsynth_version)
    };

    // Phase 40: clock + num_scope_buffers are bridge-owned (read
    // from config; surfaced via the sclang Server's metadata only
    // because that's where the clock metadata cache lives — the
    // values themselves come from `AppState`, written in serve_on
    // after the clock /s_new). dirt_samples are scanned from disk
    // in serve_on and written to sclang_server metadata.
    let (clock, num_scope_buffers, dirt_samples) = if let Some(sclang) = sclang_server {
        let m = sclang.metadata().await;
        (
            m.clock,
            m.num_scope_buffers,
            m.dirt_samples.clone(),
        )
    } else {
        (None, None, Vec::new())
    };

    Ok(SessionInfo {
        session_id: session.session_id,
        scsynth_client_id,
        scsynth: scsynth_server.target().to_string(),
        sample_rate,
        parent_group_id: session.parent_group_id,
        scope_mode: session.scope_mode,
        clock,
        num_scope_buffers,
        dirt_samples,
        scsynth_version,
    })
}

/// Handle to the bridge-wide session table. Cloneable (the inner
/// `Arc` is the shared state).
#[derive(Clone, Default)]
pub struct SessionStore {
    inner: Arc<RwLock<HashMap<Uuid, Arc<Session>>>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn insert(&self, session: Arc<Session>) {
        let mut map = self.inner.write().await;
        map.insert(session.session_id, session);
    }

    /// Reads the session by ID and bumps `last_active`. Used by
    /// `GET /api/session/:id` and by the WS attach handler.
    pub async fn get_and_touch(&self, id: &Uuid) -> Option<Arc<Session>> {
        let session = {
            let map = self.inner.read().await;
            map.get(id).cloned()?
        };
        session.touch().await;
        Some(session)
    }

    pub async fn remove(&self, id: &Uuid) -> Option<Arc<Session>> {
        let mut map = self.inner.write().await;
        map.remove(id)
    }

    /// Snapshot of the active session list. Used at bridge
    /// shutdown to run cleanup on every session.
    pub async fn drain_all(&self) -> Vec<Arc<Session>> {
        let mut map = self.inner.write().await;
        map.drain().map(|(_, s)| s).collect()
    }

    /// Phase 29d TTL job. Sweeps the store and runs cleanup on
    /// stale sessions. Two-pass to keep lock contention minimal.
    pub async fn evict_idle(
        &self,
        scsynth_server: &Arc<Server>,
        session_slot_allocator: &SessionSlotAllocator,
        ttl: Duration,
    ) {
        let now = Instant::now();
        let stale_ids: Vec<Uuid> = {
            let map = self.inner.read().await;
            let mut ids = Vec::new();
            for (id, session) in map.iter() {
                let last = *session.last_active.read().await;
                if now.saturating_duration_since(last) > ttl {
                    ids.push(*id);
                }
            }
            ids
        };
        if stale_ids.is_empty() {
            return;
        }
        let mut evicted: Vec<Arc<Session>> = Vec::with_capacity(stale_ids.len());
        {
            let mut map = self.inner.write().await;
            for id in &stale_ids {
                if let Some(s) = map.remove(id) {
                    evicted.push(s);
                }
            }
        }
        for session in evicted {
            tracing::info!(
                session_id = %session.session_id,
                "evicting idle session (TTL expired)"
            );
            session.cleanup(scsynth_server, session_slot_allocator).await;
        }
    }
}

// ===== Cleanup helpers =====

/// Cleanup bundle: `/g_freeAll <gid>` + `/n_free <gid>`. NO
/// `/notify 0` (Phase 39a: bridge owns the single notify
/// registration; only released at bridge shutdown via
/// [`send_bridge_notify_off`]).
async fn send_session_cleanup(scsynth_server: &Arc<Server>, parent_group_id: i32) -> Result<()> {
    let bundle = OscPacket::Bundle(OscBundle {
        timetag: OscTime {
            seconds: 0,
            fractional: 1,
        },
        content: vec![
            OscPacket::Message(OscMessage {
                addr: "/g_freeAll".into(),
                args: vec![OscType::Int(parent_group_id)],
            }),
            OscPacket::Message(OscMessage {
                addr: "/n_free".into(),
                args: vec![OscType::Int(parent_group_id)],
            }),
        ],
    });
    let bytes = rosc::encoder::encode(&bundle).context("encode session cleanup bundle")?;
    scsynth_server
        .send(&bytes)
        .await
        .context("send session cleanup bundle")?;
    Ok(())
}

/// Phase 39a: bridge-shutdown teardown. Sends `/notify 0` to
/// release the bridge's single `/notify` slot on scsynth.
pub async fn send_bridge_notify_off(scsynth_server: &Arc<Server>) -> Result<()> {
    let pkt = OscPacket::Message(OscMessage {
        addr: "/notify".into(),
        args: vec![OscType::Int(0)],
    });
    let bytes = rosc::encoder::encode(&pkt).context("encode /notify 0")?;
    scsynth_server
        .send(&bytes)
        .await
        .context("send /notify 0")?;
    tracing::info!("bridge /notify 0 sent");
    Ok(())
}

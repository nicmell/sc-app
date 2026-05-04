//! Bridge-managed per-tab sessions.
//!
//! Phase 29 introduced per-session UDP sockets and per-session
//! `/notify`. Phase 39a hoisted those up to the bridge level
//! (one [`super::server::Server`] per route target, one
//! `/notify` for the bridge's lifetime). A Session is now
//! lightweight per-tab bookkeeping:
//!
//! - `session_id` — UUID in the tab's `sessionStorage`.
//! - `sub_client_id` — bridge-allocated (0..MAX_SESSIONS),
//!   partitions the node-ID space within the bridge's single
//!   `clientId` (see [`SubClientIdAllocator`]).
//! - `parent_group_id` — `SESSION_GROUP_BASE + sub_client_id`,
//!   unique per session.
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

/// scsynth's `clientId = 0` is the single-client default; using
/// `0 * 100 = 0` would clash with the root group. Fall back to
/// `100`. Mirrors the same fallback in `src/AppShell.tsx`.
const FALLBACK_PARENT_GROUP_ID: i32 = 100;

/// Phase 39a hotfix: parent_group_id is partitioned by both the
/// bridge's clientId AND the sub_client_id to avoid colliding
/// with sclang+SuperDirt's node-ID range (sclang at clientId=0
/// allocates synths from 1000+; SuperDirt orbits land in
/// 1000–1999). The formula mirrors the frontend's IdAllocator
/// partition: `bridge_client_id × 1M + sub_client_id × 100K +
/// 100`. Single-client (`bridge_client_id=0`, `sub_client_id=0`)
/// keeps the legacy 100 group id for back-compat.
const PARENT_GROUP_OFFSET_PER_CLIENT_ID: i32 = 1_000_000;
const PARENT_GROUP_OFFSET_PER_SUB_CLIENT_ID: i32 = 100_000;
const PARENT_GROUP_OFFSET_WITHIN_SLICE: i32 = 100;

/// Maximum concurrent sessions. Each session owns a
/// `sub_client_id` in `[0, MAX_SESSIONS)`. The bridge-level
/// `clientId * 1_000_000` space is partitioned into N
/// 100_000-id slices; MAX_SESSIONS=10 keeps the slices clean
/// without overflowing into the next clientId range.
pub const MAX_SESSIONS: u8 = 10;

/// Allocator for session-scoped `sub_client_id`s. Free-list
/// based; sessions allocate on `Session::create` and free on
/// cleanup. Hard cap at [`MAX_SESSIONS`] — over-cap returns
/// `None`, which the API layer renders as 503.
pub struct SubClientIdAllocator {
    free_list: Mutex<Vec<u8>>,
}

impl SubClientIdAllocator {
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

impl Default for SubClientIdAllocator {
    fn default() -> Self {
        Self::new()
    }
}

/// One bridge-managed session — per-tab bookkeeping. No UDP
/// sockets (those live on `AppState.servers`); just identity +
/// routing-relevant metadata.
pub struct Session {
    pub session_id: Uuid,
    /// Phase 39a: bridge-allocated id in `[0, MAX_SESSIONS)`.
    /// Partitions the bridge's node-ID space across sessions.
    pub sub_client_id: u8,
    /// `SESSION_GROUP_BASE + sub_client_id`, or
    /// `FALLBACK_PARENT_GROUP_ID` if scsynth assigned
    /// `clientId = 0` (rare; only when scsynth is launched with
    /// `-l 1`).
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
    /// Mint a new session: allocate a `sub_client_id`, derive
    /// the `parent_group_id`, capture `scope_mode`. Pure
    /// bookkeeping — no UDP, no handshake (the bridge ran
    /// `/notify` once at boot via the scsynth Server).
    pub async fn create(
        sub_client_id_allocator: &SubClientIdAllocator,
        scsynth_server: &Arc<Server>,
        force_osc_mode: bool,
    ) -> Result<Self> {
        let sub_client_id = sub_client_id_allocator.alloc().await.ok_or_else(|| {
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
        let parent_group_id = if bridge_client_id == 0 && sub_client_id == 0 {
            tracing::warn!(
                "scsynth returned clientId=0 and sub_client_id=0; using fallback parent group {FALLBACK_PARENT_GROUP_ID}"
            );
            FALLBACK_PARENT_GROUP_ID
        } else {
            // Bridge-clientId-scoped partition to stay clear of
            // sclang+SuperDirt's node range (clientId=0 allocator
            // starts at 1000; SuperDirt orbits land 1000–1999).
            bridge_client_id * PARENT_GROUP_OFFSET_PER_CLIENT_ID
                + (sub_client_id as i32) * PARENT_GROUP_OFFSET_PER_SUB_CLIENT_ID
                + PARENT_GROUP_OFFSET_WITHIN_SLICE
        };

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
            sub_client_id,
            parent_group_id,
            scope_mode = ?scope_mode,
            "session created"
        );
        Ok(Self {
            session_id,
            sub_client_id,
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
    /// bridge shutdown). Returns `sub_client_id` to the
    /// allocator.
    pub async fn cleanup(
        &self,
        scsynth_server: &Arc<Server>,
        sub_client_id_allocator: &SubClientIdAllocator,
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
        sub_client_id_allocator.free(self.sub_client_id).await;
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
    /// registration). Used by the frontend's `IdAllocator` base
    /// computation.
    pub scsynth_client_id: i32,
    /// Phase 39a: per-session id in `[0, MAX_SESSIONS)`. Combined
    /// with `scsynth_client_id` to compute the frontend's
    /// `IdAllocator` base:
    /// `scsynth_client_id * 1_000_000 + sub_client_id * 100_000 + 1000`.
    pub sub_client_id: u8,
    /// scsynth's address (host:port). Frontend uses the port to
    /// derive the SHM file path.
    pub scsynth: String,
    /// Nominal sample rate from `/status.reply`.
    pub sample_rate: u32,
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
    let (scsynth_client_id, sample_rate) = {
        let m = scsynth_server.metadata().await;
        let scsynth_client_id = m
            .scsynth_client_id
            .ok_or_else(|| anyhow!("scsynth Server has no clientId — bridge not bootstrapped"))?;
        let sample_rate = m
            .sample_rate
            .ok_or_else(|| anyhow!("scsynth Server has no sample rate — bridge not bootstrapped"))?;
        (scsynth_client_id, sample_rate)
    };

    // Phase 39 hotfix follow-up: scsynth_version moved off scsynth's
    // metadata onto sclang's. sclang captures it at its own boot and
    // forwards to the bridge in /sc-app/bootstrap/scsynth-version;
    // the bridge has no direct /version handshake anymore.
    let (clock, num_scope_buffers, dirt_samples, scsynth_version) =
        if let Some(sclang) = sclang_server {
            let m = sclang.metadata().await;
            (
                m.clock,
                m.num_scope_buffers,
                m.dirt_samples.clone(),
                m.scsynth_version.clone(),
            )
        } else {
            (None, None, Vec::new(), None)
        };

    Ok(SessionInfo {
        session_id: session.session_id,
        scsynth_client_id,
        sub_client_id: session.sub_client_id,
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
        sub_client_id_allocator: &SubClientIdAllocator,
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
            session.cleanup(scsynth_server, sub_client_id_allocator).await;
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

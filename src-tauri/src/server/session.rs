//! Phase 29 — bridge-managed per-tab sessions.
//!
//! A `Session` represents a single browser tab's presence on the
//! bridge. It owns the UDP sockets to scsynth (and any other
//! configured route target), holds the `clientId` captured from
//! scsynth's `/done /notify` reply, and persists across WS
//! reconnects within the session's TTL window.
//!
//! Key separation from `ws_cleanup.rs` (the older per-WS state):
//! - **Lifetime**: a Session is born on `POST /api/session`, lives
//!   until explicit `DELETE` or TTL expiry. Multiple WS connects
//!   may attach over its lifetime. `WsCleanup` lives only as long
//!   as the WS itself.
//! - **Identity**: a Session is keyed by a UUID stored in the
//!   browser's `sessionStorage`. `WsCleanup` is keyed by nothing
//!   (one-per-WS, anonymous).
//! - **OSC handshake**: the Session does the `/notify 1` +
//!   `/status` round-trips on its OWN UDP socket at creation
//!   time. The frontend then attaches a WS pointing at this
//!   session and consumes the captured `clientId` / `sampleRate`
//!   directly — no per-WS handshake needed.
//!
//! Phase 29a (this commit) ships the Session model + the HTTP
//! endpoints in `api.rs`. The WS bridge is unchanged: it still
//! opens its own per-WS UDP sockets and runs its own
//! `/notify 1` handshake, ignoring sessions entirely. Phase 29b
//! cuts ws_bridge over to use Session-owned sockets.
//!
//! This means in 29a a session created via `POST /api/session`
//! holds one `/notify` slot on scsynth (`maxLogins=8` default
//! ceiling), and a WS opened against the same bridge holds a
//! second slot. That's wasteful but bounded; 29b consolidates
//! to one slot per session.
//!
//! ## Cleanup ordering
//!
//! `Session::cleanup` is called by `DELETE /api/session/:id` and
//! by the future TTL job (29d). It runs the same teardown bundle
//! as `WsCleanup::cleanup` — `/g_freeAll`, `/n_free`, `/notify 0`
//! — against the default-route socket, then drops the sockets.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{anyhow, bail, Context, Result};
use rosc::{OscBundle, OscMessage, OscPacket, OscTime, OscType};
use serde::Serialize;
use tokio::net::UdpSocket;
use tokio::sync::{broadcast, RwLock};
use tokio::task::JoinHandle;
use tokio::time::timeout;
use uuid::Uuid;

use super::routing::RoutingTable;

/// Capacity of each per-socket broadcast channel — how many UDP
/// payloads we'll queue when no WS is currently subscribed (or a
/// subscriber is briefly slow). 4096 at the steady ~48 Hz tick
/// rate is ~85 s of buffer, comfortably more than any realistic
/// WS-attach gap.
const BROADCAST_CAPACITY: usize = 4096;

/// Notify round-trip ceiling. scsynth replies in milliseconds on
/// loopback; 2 seconds is generous against pathological GC pauses
/// or virtual-machine clock skew.
const NOTIFY_TIMEOUT: Duration = Duration::from_secs(2);

/// `/status` round-trip ceiling. Cheap reply; same generous cap.
const STATUS_TIMEOUT: Duration = Duration::from_secs(1);

/// scsynth's `clientId = 0` is the single-client default; using
/// `0 * 100 = 0` would clash with the root group, so we fall
/// back to `100`. Mirrors the same fallback in `src/AppShell.tsx`
/// and `ws_cleanup.rs`.
const FALLBACK_PARENT_GROUP_ID: i32 = 100;

/// One bridge-managed session. Holds the UDP sockets, captured
/// scsynth handshake values, and timestamps used by the future
/// TTL cleanup task. `Arc<Session>` is the share-between-handlers
/// type — the SessionStore stores `Arc<Session>` so HTTP handlers
/// + the future TTL task can hold weak references without
/// blocking the store.
pub struct Session {
    pub session_id: Uuid,
    /// The default-route UDP socket — the one connected to
    /// scsynth. Bound at session creation, kept alive for the
    /// session's lifetime so the `/notify` subscription persists
    /// across WS reconnects within TTL. Same `Arc` as the entry
    /// in `target_sockets[scsynth_addr]`.
    pub scsynth_socket: Arc<UdpSocket>,
    /// Per-route-target UDP sockets, indexed by target address.
    /// Each one has a broadcast recv task running against it
    /// (see `broadcast_senders`).
    pub target_sockets: HashMap<SocketAddr, Arc<UdpSocket>>,
    /// Per-target broadcast channels. The recv task for each
    /// `target_sockets[addr]` reads UDP datagrams and pushes
    /// payloads onto `broadcast_senders[addr]`. Each WS that
    /// attaches to this Session subscribes once per target.
    pub broadcast_senders: HashMap<SocketAddr, broadcast::Sender<Vec<u8>>>,
    /// Routing table the session was created with. Frozen at
    /// creation time — `?scsynth=` per-WS overrides aren't
    /// supported on session-attached WS (the user picks the
    /// scsynth address at session-creation time, not per-WS).
    pub routes: Arc<RoutingTable>,
    pub scsynth_addr: SocketAddr,
    pub client_id: i32,
    pub sample_rate: u32,
    pub parent_group_id: i32,
    #[allow(dead_code)] // 29d uses this for the TTL job's cold-start log line.
    pub created_at: Instant,
    pub last_active: RwLock<Instant>,
    /// Per-target recv-broadcast task handles. Aborted by
    /// `cleanup` BEFORE sending the teardown bundle so the
    /// /fail replies it provokes don't get fanned out to
    /// (now-detached) WS connections.
    recv_tasks: Vec<JoinHandle<()>>,
}

impl Session {
    /// Mint a new session: open one UDP socket per unique route
    /// target, send `/notify 1` to scsynth and capture the
    /// `clientId` from `/done /notify`, send `/status` and capture
    /// `nominalSampleRate` from `/status.reply`, then spawn one
    /// recv-broadcast task per socket. Errors propagate up to
    /// the HTTP handler, which renders them to the frontend's
    /// recovery surface.
    ///
    /// Ordering matters: the handshake recvs the replies
    /// EXCLUSIVELY (no broadcast tasks running yet). Once both
    /// handshakes complete, the broadcast tasks take over and
    /// own all subsequent reads.
    pub async fn create(routes: Arc<RoutingTable>) -> Result<Self> {
        let default_addr = routes.default_target();
        let unique_targets = routes.unique_targets();

        // Bind one UDP socket per unique target. Same shape as the
        // pre-29 ws_bridge, but the sockets live for the session's
        // TTL instead of the WS's lifetime.
        let mut target_sockets: HashMap<SocketAddr, Arc<UdpSocket>> = HashMap::new();
        for target in &unique_targets {
            let sock = UdpSocket::bind("0.0.0.0:0")
                .await
                .with_context(|| format!("bind UDP socket for {target}"))?;
            sock.connect(*target)
                .await
                .with_context(|| format!("udp connect to {target}"))?;
            target_sockets.insert(*target, Arc::new(sock));
        }
        let scsynth_socket = target_sockets
            .get(&default_addr)
            .ok_or_else(|| anyhow!("default route socket missing — internal error"))?
            .clone();

        // Round-trip 1: /notify 1 → /done /notify <clientId>.
        let client_id = notify_handshake(&scsynth_socket).await?;
        let parent_group_id = if client_id > 0 {
            client_id * 100
        } else {
            tracing::warn!(
                "scsynth returned clientId=0; using fallback parent group {FALLBACK_PARENT_GROUP_ID}"
            );
            FALLBACK_PARENT_GROUP_ID
        };

        // Round-trip 2: /status → /status.reply (nominalSampleRate).
        let sample_rate = status_handshake(&scsynth_socket).await?;

        // Phase 29b: spawn one recv-broadcast task per target
        // socket. Each task reads UDP datagrams and broadcasts
        // them on a per-target channel; WS connections that
        // later attach to the session subscribe to consume.
        let mut broadcast_senders: HashMap<SocketAddr, broadcast::Sender<Vec<u8>>> =
            HashMap::new();
        let mut recv_tasks: Vec<JoinHandle<()>> = Vec::new();
        for (target, sock) in &target_sockets {
            let (tx, _initial_rx) = broadcast::channel::<Vec<u8>>(BROADCAST_CAPACITY);
            broadcast_senders.insert(*target, tx.clone());
            let sock = sock.clone();
            let target = *target;
            let task = tokio::spawn(async move {
                let mut buf = vec![0u8; 65_536];
                loop {
                    match sock.recv(&mut buf).await {
                        Ok(n) => {
                            // `send` returns Err(SendError(_)) if
                            // there are no live receivers — that's
                            // fine, we just drop and keep going.
                            // It does NOT block on a full buffer;
                            // slow consumers see Lagged on recv.
                            let _ = tx.send(buf[..n].to_vec());
                        }
                        Err(e) => {
                            tracing::warn!(
                                error = %e,
                                ?target,
                                "session udp recv error; broadcast task exiting"
                            );
                            break;
                        }
                    }
                }
            });
            recv_tasks.push(task);
        }

        let session_id = Uuid::new_v4();
        let now = Instant::now();
        tracing::info!(
            session_id = %session_id,
            client_id,
            parent_group_id,
            sample_rate,
            scsynth = %default_addr,
            "session created"
        );
        Ok(Self {
            session_id,
            scsynth_socket,
            target_sockets,
            broadcast_senders,
            routes,
            scsynth_addr: default_addr,
            client_id,
            sample_rate,
            parent_group_id,
            created_at: now,
            last_active: RwLock::new(now),
            recv_tasks,
        })
    }

    /// Bump `last_active`. Called from `GET /api/session/:id` and
    /// (in 29b) from the WS attach point.
    pub async fn touch(&self) {
        *self.last_active.write().await = Instant::now();
    }

    /// Phase 22 cleanup, applied at session-end (DELETE or TTL).
    /// Sends `/g_freeAll(parentGroupId)` + `/n_free(parentGroupId)`
    /// + `/notify 0` to scsynth, then drops the sockets when the
    /// `Arc<Session>` goes out of scope. Best-effort — scsynth may
    /// already be dead, UDP doesn't error on send-to-nothing, and
    /// we never read the reply.
    ///
    /// Aborts the recv-broadcast tasks BEFORE sending the cleanup
    /// bundle so the `/fail` replies it provokes (if scsynth's
    /// state is already inconsistent) don't get fanned out to
    /// any WS still attached. Same ordering rationale as the
    /// pre-29 `ws_bridge` cleanup tail.
    pub async fn cleanup(&self) {
        for task in &self.recv_tasks {
            task.abort();
        }
        if let Err(e) = send_cleanup(&self.scsynth_socket, self.parent_group_id).await {
            tracing::warn!(
                session_id = %self.session_id,
                error = %e,
                "session cleanup encode/send failed"
            );
            return;
        }
        tracing::info!(
            session_id = %self.session_id,
            parent_group = self.parent_group_id,
            "session cleanup bundle sent"
        );
        // Brief flush window so kernel-queued datagrams reach
        // scsynth before the socket drops.
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

/// JSON shape returned by `POST /api/session` and
/// `GET /api/session/:id`. camelCase to match the JS consumer.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: Uuid,
    pub client_id: i32,
    pub scsynth: String,
    pub sample_rate: u32,
    pub parent_group_id: i32,
}

impl Session {
    /// Project the public-API JSON view of this session.
    pub fn info(&self) -> SessionInfo {
        SessionInfo {
            session_id: self.session_id,
            client_id: self.client_id,
            scsynth: self.scsynth_addr.to_string(),
            sample_rate: self.sample_rate,
            parent_group_id: self.parent_group_id,
        }
    }
}

/// Handle to the bridge-wide session table. Cloneable (the inner
/// `Arc` is the shared state); HTTP handlers and the future TTL
/// task hold their own `SessionStore` value pointing at the same
/// map.
#[derive(Clone, Default)]
pub struct SessionStore {
    inner: Arc<RwLock<HashMap<Uuid, Arc<Session>>>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Insert. Caller-supplied uuid; we don't generate here so the
    /// session struct's id and the store key are guaranteed
    /// identical (they come from the same `Uuid::new_v4()`).
    pub async fn insert(&self, session: Arc<Session>) {
        let id = session.session_id;
        self.inner.write().await.insert(id, session);
    }

    /// Read an existing session. Returns `None` if absent. Bumps
    /// `last_active` as a side effect (so a frontend GET serves
    /// as a TTL keep-alive, important for tabs idle at the OS
    /// level but with `sessionStorage` still set).
    pub async fn get_and_touch(&self, id: &Uuid) -> Option<Arc<Session>> {
        let session = self.inner.read().await.get(id).cloned()?;
        session.touch().await;
        Some(session)
    }

    /// Remove + return for explicit DELETE. The caller runs
    /// `cleanup()` on the returned `Arc<Session>` before dropping
    /// it so the teardown bundle reaches scsynth.
    pub async fn remove(&self, id: &Uuid) -> Option<Arc<Session>> {
        self.inner.write().await.remove(id)
    }

    /// Snapshot the current sessions. Used by the future TTL task
    /// (29d) to scan + expire idle entries; not on the hot path.
    #[allow(dead_code)] // 29d will use this
    pub async fn snapshot(&self) -> Vec<Arc<Session>> {
        self.inner.read().await.values().cloned().collect()
    }
}

// ── handshake helpers ───────────────────────────────────────────

/// Send `/notify 1` and await `/done /notify <clientId>` on the
/// same socket. Returns the captured `clientId` or an error if
/// scsynth doesn't reply within `NOTIFY_TIMEOUT`.
async fn notify_handshake(sock: &UdpSocket) -> Result<i32> {
    let pkt = OscPacket::Message(OscMessage {
        addr: "/notify".into(),
        args: vec![OscType::Int(1)],
    });
    let bytes = rosc::encoder::encode(&pkt).context("encode /notify 1")?;
    sock.send(&bytes)
        .await
        .context("send /notify 1 to scsynth")?;

    let mut buf = vec![0u8; 65_536];
    let result = timeout(NOTIFY_TIMEOUT, async {
        loop {
            let n = sock.recv(&mut buf).await.context("recv /done /notify")?;
            if let Some(client_id) = parse_done_notify(&buf[..n]) {
                return Ok::<i32, anyhow::Error>(client_id);
            }
            // Not a /done /notify reply — ignore and keep listening.
            // scsynth shouldn't send anything else on this socket
            // during bootstrap, but be defensive.
        }
    })
    .await;

    match result {
        Ok(Ok(client_id)) => Ok(client_id),
        Ok(Err(e)) => Err(e),
        Err(_) => bail!(
            "scsynth didn't reply to /notify 1 within {:?}",
            NOTIFY_TIMEOUT
        ),
    }
}

/// Send `/status` and await `/status.reply`. Returns the
/// `nominalSampleRate` (args[7]) rounded to integer Hz — same
/// rule the frontend used in pre-29 `handleConnect` (the actual
/// sample rate drifts by 10s of ppm; the nominal is what scsynth
/// was *asked* to run at, always integer).
async fn status_handshake(sock: &UdpSocket) -> Result<u32> {
    let pkt = OscPacket::Message(OscMessage {
        addr: "/status".into(),
        args: vec![],
    });
    let bytes = rosc::encoder::encode(&pkt).context("encode /status")?;
    sock.send(&bytes)
        .await
        .context("send /status to scsynth")?;

    let mut buf = vec![0u8; 65_536];
    let result = timeout(STATUS_TIMEOUT, async {
        loop {
            let n = sock.recv(&mut buf).await.context("recv /status.reply")?;
            if let Some(sr) = parse_status_reply(&buf[..n]) {
                return Ok::<u32, anyhow::Error>(sr);
            }
        }
    })
    .await;

    match result {
        Ok(Ok(sr)) => Ok(sr),
        Ok(Err(e)) => Err(e),
        Err(_) => bail!(
            "scsynth didn't reply to /status within {:?}",
            STATUS_TIMEOUT
        ),
    }
}

/// Decode `/done /notify <clientId> [maxLogins]`. Returns the
/// clientId if the bytes match, `None` otherwise. Same shape as
/// the snoop in `ws_cleanup.rs`, lifted here to be reused at
/// handshake time.
fn parse_done_notify(bytes: &[u8]) -> Option<i32> {
    let packet = rosc::decoder::decode_udp(bytes).ok()?.1;
    let msg = match packet {
        OscPacket::Message(m) => m,
        OscPacket::Bundle(_) => return None,
    };
    if msg.addr != "/done" {
        return None;
    }
    let mut args = msg.args.into_iter();
    let cmd = args.next()?;
    let OscType::String(s) = cmd else { return None };
    if s != "/notify" {
        return None;
    }
    let cid = args.next()?;
    let OscType::Int(id) = cid else { return None };
    Some(id)
}

/// Decode `/status.reply` and return `args[7]` (nominal sample
/// rate) rounded to u32. The reply has 9 args:
/// `[unused, numUgens, numSynths, numGroups, numSynthDefs,
/// avgCpu, peakCpu, nominalSampleRate, actualSampleRate]`.
fn parse_status_reply(bytes: &[u8]) -> Option<u32> {
    let packet = rosc::decoder::decode_udp(bytes).ok()?.1;
    let msg = match packet {
        OscPacket::Message(m) => m,
        OscPacket::Bundle(_) => return None,
    };
    if msg.addr != "/status.reply" {
        return None;
    }
    let nominal = msg.args.get(7)?;
    let sr = match nominal {
        OscType::Float(f) => *f as f64,
        OscType::Double(d) => *d,
        OscType::Int(i) => *i as f64,
        _ => return None,
    };
    if !sr.is_finite() || sr <= 0.0 {
        return None;
    }
    Some(sr.round() as u32)
}

/// Cleanup bundle: `/g_freeAll <gid>` + `/n_free <gid>` +
/// `/notify 0`, all wrapped in a bundle with the OSC "immediate"
/// timetag. Same shape as `ws_cleanup::send_cleanup`.
async fn send_cleanup(sock: &UdpSocket, parent_group_id: i32) -> Result<()> {
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
            OscPacket::Message(OscMessage {
                addr: "/notify".into(),
                args: vec![OscType::Int(0)],
            }),
        ],
    });
    let bytes = rosc::encoder::encode(&bundle).context("encode session cleanup bundle")?;
    sock.send(&bytes).await.context("send session cleanup bundle")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encode(pkt: OscPacket) -> Vec<u8> {
        rosc::encoder::encode(&pkt).unwrap()
    }

    #[test]
    fn parse_done_notify_extracts_client_id() {
        let bytes = encode(OscPacket::Message(OscMessage {
            addr: "/done".into(),
            args: vec![OscType::String("/notify".into()), OscType::Int(7)],
        }));
        assert_eq!(parse_done_notify(&bytes), Some(7));
    }

    #[test]
    fn parse_done_notify_rejects_unrelated_done() {
        let bytes = encode(OscPacket::Message(OscMessage {
            addr: "/done".into(),
            args: vec![OscType::String("/sync".into()), OscType::Int(42)],
        }));
        assert_eq!(parse_done_notify(&bytes), None);
    }

    #[test]
    fn parse_status_reply_extracts_nominal_rate() {
        let bytes = encode(OscPacket::Message(OscMessage {
            addr: "/status.reply".into(),
            args: vec![
                OscType::Int(0),     // unused
                OscType::Int(0),     // numUgens
                OscType::Int(0),     // numSynths
                OscType::Int(0),     // numGroups
                OscType::Int(0),     // numSynthDefs
                OscType::Float(0.0), // avgCpu
                OscType::Float(0.0), // peakCpu
                OscType::Float(48000.0), // nominal
                OscType::Float(48000.27), // actual (drift)
            ],
        }));
        assert_eq!(parse_status_reply(&bytes), Some(48000));
    }

    #[test]
    fn parse_status_reply_rounds_nominal() {
        // Defensive: even though scsynth always returns whole-Hz
        // nominals, round to handle float-precision noise.
        let bytes = encode(OscPacket::Message(OscMessage {
            addr: "/status.reply".into(),
            args: vec![
                OscType::Int(0),
                OscType::Int(0),
                OscType::Int(0),
                OscType::Int(0),
                OscType::Int(0),
                OscType::Float(0.0),
                OscType::Float(0.0),
                OscType::Float(47999.7),
                OscType::Float(0.0),
            ],
        }));
        assert_eq!(parse_status_reply(&bytes), Some(48000));
    }
}

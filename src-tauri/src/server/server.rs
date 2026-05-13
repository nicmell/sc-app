//! Per-target UDP server abstraction (Phase 39a).
//!
//! Pre-39 each [`Session`] owned its own UDP sockets, ran its
//! own `/notify 1` + `/status` handshake, and held its own
//! per-target broadcast channels. Phase 39 hoists these up to
//! the bridge level: one [`Server`] per route target, built once
//! at `serve_on` boot, shared across every session.
//!
//! ## Lifecycle
//!
//! - [`Server::build`] opens the UDP socket, runs any
//!   role-specific handshake (e.g. `/notify` + `/status` on
//!   [`ServerRole::Scsynth`]) BEFORE spawning the recv task — so
//!   the handshake replies aren't racing the broadcast channel.
//! - After the handshake completes, the recv task is spawned and
//!   broadcasts every inbound UDP datagram to subscribers.
//! - Sessions / WS forwarders call [`Server::subscribe`] to get a
//!   `broadcast::Receiver`. [`Server::send`] writes a packet to
//!   the connected target.
//!
//! ## Metadata cache
//!
//! [`ServerMetadata`] is populated synchronously by the
//! role-specific handshake. The scsynth Server fills
//! `scsynth_client_id` + `sample_rate` + `scsynth_version` from
//! its `/notify` + `/status` + `/version` handshakes. The sclang
//! Server's `dirt_samples` is populated by [`serve_on`] from a
//! disk scan (Phase 40: pre-40 a `/bootstrap/hello` round-trip
//! also carried clock + scope-pool metadata, but those are now
//! bridge-owned via config). The synthesized [`ClockMetadata`]
//! is written to the sclang Server's metadata after the bridge's
//! `\scAppClock` `/s_new` succeeds.
//!
//! ## Cost of shared sockets vs per-session sockets
//!
//! Per-session model (pre-39): scsynth's UDP-source-keyed replies
//! (e.g. `/fail`, `/done`) reached only the offending session.
//! Shared model (post-39): every WS attached to a session sees
//! every reply. `/fail` is the most user-visible cost — a bug in
//! one tab surfaces as a toast in another. In practice `/fail` is
//! rare; correlation by source-port is documented as a follow-up
//! mitigation (see plan.md "Cross-cutting risks" for Phase 39).

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use rosc::{OscMessage, OscPacket, OscType};
use tokio::net::UdpSocket;
use tokio::sync::{broadcast, RwLock};
use tokio::task::JoinHandle;
use tokio::time::timeout;

use crate::scope::shm as scope_shm;

/// Buffer depth for the per-Server broadcast channel. Sized
/// generously so a slow consumer (e.g. a backgrounded tab) can
/// pause for a few seconds without dropping replies. Same cap as
/// pre-Phase-39's per-session broadcast.
const BROADCAST_CAPACITY: usize = 4096;

/// `/notify` handshake timeout. scsynth replies on the same
/// socket; 2 s is generous against pathological GC pauses.
const NOTIFY_TIMEOUT: Duration = Duration::from_secs(2);
/// `/status` handshake timeout. Same shape.
const STATUS_TIMEOUT: Duration = Duration::from_secs(2);
/// Phase 40: `/version` handshake timeout. Bridge probes scsynth
/// directly instead of routing the round-trip through sclang.
const VERSION_TIMEOUT: Duration = Duration::from_secs(2);

/// What kind of server this is. Drives the boot-time handshake +
/// what fields of [`ServerMetadata`] get populated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerRole {
    /// scsynth — runs `/notify 1` + `/status` at boot. Phase 39a
    /// also commits to this server's `clientId` for the bridge's
    /// node-ID space; session_slot allocation partitions further.
    Scsynth,
    /// sclang+SuperDirt. Phase 40: no boot handshake — the
    /// scripts just declare a SynthDef + boot SuperDirt; the
    /// bridge writes scope-pool size + dirt-samples-from-disk to
    /// this Server's metadata in `serve_on`. (Pre-40 a
    /// `/bootstrap/hello` round-trip carried clock + scope-pool
    /// metadata; Phase 40 makes those bridge-owned via config.)
    Sclang,
    /// Any other route target (future MIDI bridge, analyzer, …).
    /// No boot handshake; metadata stays default.
    Generic,
}

/// Per-target metadata cache. Populated by role-specific
/// handshakes at boot and read by sessions / API handlers.
#[derive(Debug, Default, Clone)]
pub struct ServerMetadata {
    // ── Scsynth-side (populated by /notify + /status) ──────
    /// scsynth's assigned `clientId` from `/done /notify`. Bridge
    /// runs `/notify 1` once at boot; this is the bridge-wide
    /// `clientId`. Sessions get a `session_slot` that partitions
    /// the node-ID space within this `clientId`.
    pub scsynth_client_id: Option<i32>,
    /// Nominal sample rate from `/status.reply`. Used by
    /// `tickToTimetag` math + scope chunk geometry.
    pub sample_rate: Option<u32>,

    /// Phase 40: scsynth `/version.reply` snapshot, captured by
    /// the bridge directly during the scsynth boot handshake.
    /// Pre-40 sclang captured it and forwarded via the bootstrap
    /// reply; Phase 40 puts the round-trip back on the bridge.
    /// `None` if the `/version` probe timed out.
    pub scsynth_version: Option<ScsynthVersion>,

    // ── Sclang-side (populated by serve_on) ─────
    /// Phase 39d: full clock metadata, written by the bridge AFTER
    /// the `/s_new \scAppClock` succeeds. Phase 40: the source
    /// values (clockBus + clockNodeId) come from bridge config,
    /// not the bootstrap reply. `None` until the /s_new completes
    /// (or permanently if sclang isn't reachable + retry
    /// exhausted).
    pub clock: Option<ClockMetadata>,
    /// Phase 40: scope-buffer pool size, from bridge config.
    /// Surfaced via [`SessionInfo`] for the frontend's scope-
    /// buffer allocator wrap-around. Default 128 (scsynth's
    /// hardcoded SHM pool).
    pub num_scope_buffers: Option<i32>,
    /// Phase 40: dirt sample bank — `(name, count)` pairs walked
    /// from the `SC_APP_DIRT_SAMPLES` directory on disk. Pre-40
    /// this came via the bootstrap reply; Phase 40 has the
    /// bridge read the same directory SuperDirt loads from.
    /// Empty if the env var is unset, the path doesn't exist, or
    /// the directory has no subdirectories.
    pub dirt_samples: Vec<DirtSample>,
}

/// Clock metadata for the bridge-owned `\scAppClock` synth.
/// Synthesized in [`instantiate_bridge_clock`] from config
/// (clock_audio_bus + clock_node_id + chunk_size) + scsynth's
/// reported sample rate.
#[derive(Debug, Clone, Copy, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClockMetadata {
    pub clock_bus: i32,
    pub clock_node_id: i32,
    pub tick_rate: f64,
    pub chunk_size: i32,
    pub sample_rate: f64,
}

/// One entry in the dirt sample bank.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirtSample {
    pub name: String,
    pub count: i32,
}

/// scsynth version snapshot from `/version.reply`. camelCase JSON
/// to match the frontend's `ScsynthVersion` type.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScsynthVersion {
    pub prog_name: String,
    pub major: i32,
    pub minor: i32,
    /// SC reports patch as a string (e.g. `".0"`); preserved
    /// verbatim.
    pub patch: String,
    pub branch: String,
    pub commit_hash: String,
}

/// One UDP target's bridge-level state: the connected socket, the
/// recv-broadcast plumbing, and a metadata cache populated at
/// boot.
pub struct Server {
    target: SocketAddr,
    /// What handshake to run at boot. Inspected during `build`;
    /// kept for future inspection (e.g. routing decisions that
    /// want to ask "is this the scsynth Server?" without a
    /// SocketAddr equality check).
    #[allow(dead_code)]
    role: ServerRole,
    socket: Arc<UdpSocket>,
    broadcast: broadcast::Sender<Vec<u8>>,
    metadata: Arc<RwLock<ServerMetadata>>,
    /// Phase 31: lazily-opened SHM mmap + scope_buffer layout,
    /// shared across every session in SHM mode. Owned by the
    /// scsynth Server (since the SHM file path is derived from
    /// the scsynth port). Other servers leave this empty.
    scope_shm: tokio::sync::OnceCell<Arc<ScopeShm>>,
    _recv_task: JoinHandle<()>,
}

/// SHM mmap + resolved scope_buffer layout. Phase 31 originally
/// scoped this per-session; Phase 39a hoists it to the scsynth
/// Server (one mmap per bridge, shared across all sessions).
pub struct ScopeShm {
    pub region: scope_shm::MmapRegion,
    pub layout: scope_shm::ScopeBufferLayout,
}

impl Server {
    /// Open the UDP socket, connect to the target, run any
    /// role-specific boot handshake (synchronously, before the
    /// recv task starts so replies don't race the broadcast
    /// channel), then spawn the recv task and return.
    pub async fn build(target: SocketAddr, role: ServerRole) -> Result<Arc<Self>> {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .await
            .with_context(|| format!("bind UDP socket for {target}"))?;
        socket
            .connect(target)
            .await
            .with_context(|| format!("udp connect to {target}"))?;
        let socket = Arc::new(socket);

        let mut metadata = ServerMetadata::default();
        match role {
            ServerRole::Scsynth => {
                // /notify + /status + /version BEFORE the recv task
                // starts. The handshakes read replies directly from
                // the socket; spawning the recv task afterward avoids
                // the broadcast race. Phase 40: /version probed
                // directly here — pre-40 sclang captured it and
                // echoed via the bootstrap reply.
                let client_id = notify_handshake(&socket).await?;
                let sample_rate = status_handshake(&socket).await?;
                let scsynth_version = match version_handshake(&socket).await {
                    Ok(v) => Some(v),
                    Err(e) => {
                        tracing::warn!(
                            target = %target,
                            error = %e,
                            "/version probe failed — dashboard footer will read \"version unknown\""
                        );
                        None
                    }
                };
                metadata.scsynth_client_id = Some(client_id);
                metadata.sample_rate = Some(sample_rate);
                metadata.scsynth_version = scsynth_version.clone();
                tracing::info!(
                    target = %target,
                    client_id,
                    sample_rate,
                    scsynth_version = ?scsynth_version.as_ref().map(|v| format!("{} {}.{}{}", v.prog_name, v.major, v.minor, v.patch)),
                    "scsynth Server bootstrapped"
                );
            }
            ServerRole::Sclang => {
                // Phase 40: sclang Server has no boot handshake. The
                // scripts only declare a SynthDef + boot SuperDirt;
                // the bridge instantiates the clock via /s_new
                // (with retry) once sclang is reachable. Dirt
                // samples are scanned from disk in `serve_on`.
                tracing::info!(target = %target, "sclang Server bootstrapped (no handshake)");
            }
            ServerRole::Generic => {
                tracing::info!(target = %target, ?role, "Server bootstrapped (no handshake)");
            }
        }

        let (tx, _initial_rx) = broadcast::channel::<Vec<u8>>(BROADCAST_CAPACITY);
        let recv_task = spawn_recv(socket.clone(), tx.clone(), target);

        Ok(Arc::new(Self {
            target,
            role,
            socket,
            broadcast: tx,
            metadata: Arc::new(RwLock::new(metadata)),
            scope_shm: tokio::sync::OnceCell::new(),
            _recv_task: recv_task,
        }))
    }

    pub fn target(&self) -> SocketAddr {
        self.target
    }

    #[allow(dead_code)] // future use (39b dispatch decisions).
    pub fn role(&self) -> ServerRole {
        self.role
    }

    /// Send bytes to this server's UDP target. Equivalent to
    /// pre-39's `session.target_sockets[target].send(...)`.
    pub async fn send(&self, bytes: &[u8]) -> std::io::Result<usize> {
        self.socket.send(bytes).await
    }

    /// Subscribe to the broadcast channel. Each WS forwarder gets
    /// its own Receiver; `Lagged` recovery is handled per-receiver.
    pub fn subscribe(&self) -> broadcast::Receiver<Vec<u8>> {
        self.broadcast.subscribe()
    }

    /// Read-locked view of the metadata. Sessions / API handlers
    /// call this to populate `SessionInfo` etc.
    pub async fn metadata(&self) -> tokio::sync::RwLockReadGuard<'_, ServerMetadata> {
        self.metadata.read().await
    }

    /// Phase 39d: write the synthesized [`ClockMetadata`] after
    /// the bridge's `/s_new` of `\scAppClock` completes. Called
    /// by [`instantiate_bridge_clock`].
    pub async fn set_clock_metadata(&self, clock: ClockMetadata) {
        let mut m = self.metadata.write().await;
        m.clock = Some(clock);
    }

    /// Phase 40: write the sclang Server's bridge-owned metadata
    /// (scope-pool size + dirt-samples scan) once at boot. Pre-40
    /// these values arrived via `/bootstrap/hello`; Phase 40 they
    /// come from config + a disk walk respectively.
    pub async fn set_sclang_metadata(
        &self,
        num_scope_buffers: Option<i32>,
        dirt_samples: Vec<DirtSample>,
    ) {
        let mut m = self.metadata.write().await;
        m.num_scope_buffers = num_scope_buffers;
        m.dirt_samples = dirt_samples;
    }

    /// Lazily open the SHM scope-buffer pool for this scsynth
    /// Server. First caller pays the mmap + layout-scan cost;
    /// subsequent callers wait on the `OnceCell` and get the
    /// already-resolved layout. Bridge-wide (shared across all
    /// sessions in SHM mode).
    pub async fn ensure_scope_shm(&self) -> Result<Arc<ScopeShm>> {
        let port = self.target.port();
        self.scope_shm
            .get_or_try_init(|| async move {
                let path = scope_shm::shm_path(port);
                let path_str = path.to_string_lossy().into_owned();
                let region = scope_shm::MmapRegion::open(&path_str)
                    .map_err(|e| anyhow!("scope SHM mmap: {e}"))?;
                let layout = scope_shm::find_scope_buffer_array(&region)
                    .map_err(|e| anyhow!("scope_buffer layout scan: {e}"))?;
                tracing::info!(
                    scsynth_port = port,
                    scope_count = layout.count,
                    path = %path_str,
                    "opened SHM scope-buffer pool"
                );
                Ok(Arc::new(ScopeShm { region, layout }))
            })
            .await
            .cloned()
    }
}

/// Spawn the recv → broadcast task. Each inbound UDP datagram
/// gets fanned out to every active broadcast receiver.
fn spawn_recv(
    socket: Arc<UdpSocket>,
    tx: broadcast::Sender<Vec<u8>>,
    target: SocketAddr,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let mut buf = vec![0u8; 65_536];
        loop {
            match socket.recv(&mut buf).await {
                Ok(n) => {
                    // Err(SendError(_)) when no live receivers —
                    // fine, drop and keep going. Doesn't block on
                    // a full per-receiver buffer; slow consumers
                    // see Lagged on recv.
                    let _ = tx.send(buf[..n].to_vec());
                }
                Err(e) => {
                    tracing::warn!(
                        error = %e,
                        ?target,
                        "Server udp recv error; broadcast task exiting"
                    );
                    break;
                }
            }
        }
    })
}

// ===== Boot handshakes =====

/// Send `/notify 1` and await `/done /notify <clientId>` on the
/// same socket. Runs BEFORE the recv-broadcast task starts;
/// reads the reply directly from the socket.
async fn notify_handshake(sock: &UdpSocket) -> Result<i32> {
    let pkt = OscPacket::Message(OscMessage {
        addr: "/notify".into(),
        args: vec![OscType::Int(1)],
    });
    let bytes = rosc::encoder::encode(&pkt).context("encode /notify 1")?;
    sock.send(&bytes).await.context("send /notify 1")?;

    let mut buf = vec![0u8; 65_536];
    let deadline = tokio::time::Instant::now() + NOTIFY_TIMEOUT;
    loop {
        let remaining = deadline
            .checked_duration_since(tokio::time::Instant::now())
            .ok_or_else(|| anyhow!("/notify 1 timed out (no /done reply from scsynth)"))?;
        let n = match timeout(remaining, sock.recv(&mut buf)).await {
            Ok(Ok(n)) => n,
            Ok(Err(e)) => return Err(anyhow!("recv during /notify handshake: {e}")),
            Err(_) => return Err(anyhow!("/notify 1 timed out (no /done reply from scsynth)")),
        };
        if let Some(client_id) = parse_done_notify(&buf[..n]) {
            return Ok(client_id);
        }
        // Other reply on this socket (e.g. /status.reply from a
        // previous session). Ignore + keep waiting.
    }
}

/// Phase 40: send `/version` and await `/version.reply`. Pre-40
/// sclang owned this round-trip (lib/version.scd) and echoed the
/// result back via the bootstrap reply; Phase 40 puts it on the
/// bridge's scsynth handshake directly. Same shape as the other
/// handshakes — runs before the recv task starts.
async fn version_handshake(sock: &UdpSocket) -> Result<ScsynthVersion> {
    let pkt = OscPacket::Message(OscMessage {
        addr: "/version".into(),
        args: vec![],
    });
    let bytes = rosc::encoder::encode(&pkt).context("encode /version")?;
    sock.send(&bytes).await.context("send /version")?;

    let mut buf = vec![0u8; 65_536];
    let deadline = tokio::time::Instant::now() + VERSION_TIMEOUT;
    loop {
        let remaining = deadline
            .checked_duration_since(tokio::time::Instant::now())
            .ok_or_else(|| anyhow!("/version timed out (no /version.reply from scsynth)"))?;
        let n = match timeout(remaining, sock.recv(&mut buf)).await {
            Ok(Ok(n)) => n,
            Ok(Err(e)) => return Err(anyhow!("recv during /version handshake: {e}")),
            Err(_) => {
                return Err(anyhow!("/version timed out (no /version.reply from scsynth)"))
            }
        };
        if let Some(v) = parse_version_reply(&buf[..n]) {
            return Ok(v);
        }
        // Some other reply on this socket. Ignore + keep waiting.
    }
}

/// Send `/status` and await `/status.reply` to capture
/// `nominalSampleRate`. Same shape as `notify_handshake`.
async fn status_handshake(sock: &UdpSocket) -> Result<u32> {
    let pkt = OscPacket::Message(OscMessage {
        addr: "/status".into(),
        args: vec![],
    });
    let bytes = rosc::encoder::encode(&pkt).context("encode /status")?;
    sock.send(&bytes).await.context("send /status")?;

    let mut buf = vec![0u8; 65_536];
    let deadline = tokio::time::Instant::now() + STATUS_TIMEOUT;
    loop {
        let remaining = deadline
            .checked_duration_since(tokio::time::Instant::now())
            .ok_or_else(|| anyhow!("/status timed out (no /status.reply from scsynth)"))?;
        let n = match timeout(remaining, sock.recv(&mut buf)).await {
            Ok(Ok(n)) => n,
            Ok(Err(e)) => return Err(anyhow!("recv during /status handshake: {e}")),
            Err(_) => {
                return Err(anyhow!("/status timed out (no /status.reply from scsynth)"))
            }
        };
        if let Some(rate) = parse_status_reply(&buf[..n]) {
            return Ok(rate);
        }
    }
}

// ===== Dirt samples disk scan (Phase 40) =====

/// Walk the SuperDirt samples directory (typically
/// `superdirt-deps/Dirt-Samples`) and return one entry per
/// subdirectory: `(bank_name, audio_file_count)`. Replicates the
/// shape SuperDirt's `loadSoundFiles` reports back via
/// `~dirt.buffers` — pre-40 we read that dict over OSC; Phase 40
/// the bridge reads the same directory SuperDirt is pointed at.
///
/// Input is the value of the `SC_APP_DIRT_SAMPLES` env var (the
/// launch script's `start-superdirt-only.sh` sets it). Accepts
/// either a bare directory path or a trailing-`/*` glob — the
/// glob form is what SuperDirt's `loadSoundFiles` wants and what
/// the launch script writes. Anything else returns an empty list
/// rather than erroring (the bridge tolerates "samples not
/// configured" gracefully — the sequencer panel just gets no
/// autocomplete).
pub(crate) fn scan_dirt_samples(env_value: &str) -> Vec<DirtSample> {
    let trimmed = env_value.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let dir_path: std::path::PathBuf = if let Some(stripped) = trimmed.strip_suffix("/*") {
        stripped.into()
    } else {
        trimmed.into()
    };
    let read_dir = match std::fs::read_dir(&dir_path) {
        Ok(it) => it,
        Err(e) => {
            tracing::warn!(
                path = %dir_path.display(),
                error = %e,
                "scan_dirt_samples: read_dir failed; reporting empty sample list"
            );
            return Vec::new();
        }
    };

    let mut out: Vec<DirtSample> = Vec::new();
    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|s| s.to_str()).map(str::to_owned) else {
            continue;
        };
        // Skip quark-meta directories that ship inside
        // Dirt-Samples (e.g. the `.git` subdir, or the
        // `Dirt-Samples.quark` quark-meta entry).
        if name.starts_with('.') || name.ends_with(".quark") {
            continue;
        }
        let count = count_audio_files(&path);
        if count > 0 {
            out.push(DirtSample {
                name,
                count: count as i32,
            });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

/// Count files inside a sample-bank directory whose extension
/// suggests an audio file. Cheap (no header probing). SuperDirt
/// accepts the same set, give or take case-insensitive variants.
fn count_audio_files(dir: &std::path::Path) -> usize {
    const AUDIO_EXTS: &[&str] = &["wav", "aif", "aiff", "flac", "ogg", "mp3"];
    let Ok(read_dir) = std::fs::read_dir(dir) else {
        return 0;
    };
    let mut n = 0usize;
    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(ext) = path.extension().and_then(|s| s.to_str()) else {
            continue;
        };
        let ext_lc = ext.to_ascii_lowercase();
        if AUDIO_EXTS.iter().any(|e| *e == ext_lc) {
            n += 1;
        }
    }
    n
}

fn osc_int(v: &OscType) -> Option<i32> {
    match v {
        OscType::Int(n) => Some(*n),
        OscType::Long(n) => Some(*n as i32),
        OscType::Float(f) => Some(*f as i32),
        OscType::Double(f) => Some(*f as i32),
        _ => None,
    }
}

/// Parse `/version.reply progName major minor patch branch commitHash`.
/// Phase 40: bridge probes /version directly; this is the wire
/// parser for that response. Returns `None` for bytes that don't
/// decode or don't match the expected /version.reply shape (caller
/// keeps waiting on the same socket).
fn parse_version_reply(bytes: &[u8]) -> Option<ScsynthVersion> {
    let packet = rosc::decoder::decode_udp(bytes).ok()?.1;
    let msg = match packet {
        OscPacket::Message(m) => m,
        _ => return None,
    };
    if msg.addr != "/version.reply" {
        return None;
    }
    let args = &msg.args;
    let prog_name = match args.first() {
        Some(OscType::String(s)) => s.clone(),
        _ => "scsynth".to_string(),
    };
    let major = osc_int(args.get(1)?)?;
    let minor = osc_int(args.get(2)?)?;
    let patch = match args.get(3) {
        Some(OscType::String(s)) => s.clone(),
        _ => String::new(),
    };
    let branch = match args.get(4) {
        Some(OscType::String(s)) => s.clone(),
        _ => String::new(),
    };
    let commit_hash = match args.get(5) {
        Some(OscType::String(s)) => s.clone(),
        _ => String::new(),
    };
    Some(ScsynthVersion {
        prog_name,
        major,
        minor,
        patch,
        branch,
        commit_hash,
    })
}

/// Parse a `/done /notify <clientId>` reply. Returns `Some(cid)`
/// if the bytes match this exact reply shape, `None` otherwise.
fn parse_done_notify(bytes: &[u8]) -> Option<i32> {
    let packet = rosc::decoder::decode_udp(bytes).ok()?.1;
    let msg = match packet {
        OscPacket::Message(m) => m,
        _ => return None,
    };
    if msg.addr != "/done" {
        return None;
    }
    if msg.args.first().and_then(|a| match a {
        OscType::String(s) => Some(s.as_str()),
        _ => None,
    }) != Some("/notify")
    {
        return None;
    }
    msg.args.get(1).and_then(|a| match a {
        OscType::Int(v) => Some(*v),
        _ => None,
    })
}

/// Parse a `/status.reply` and extract `nominalSampleRate`. The
/// reply has many args; we want index 8 (per scsynth's
/// status.reply layout).
fn parse_status_reply(bytes: &[u8]) -> Option<u32> {
    let packet = rosc::decoder::decode_udp(bytes).ok()?.1;
    let msg = match packet {
        OscPacket::Message(m) => m,
        _ => return None,
    };
    if msg.addr != "/status.reply" {
        return None;
    }
    // /status.reply layout (scsynth):
    //   args[0..7] = various counts / cpu metrics
    //   args[8] = nominalSampleRate (Float)
    //   args[9] = actualSampleRate (Float)
    let nominal = msg.args.get(8)?;
    let sr = match nominal {
        OscType::Float(f) => *f as f64,
        OscType::Double(d) => *d,
        _ => return None,
    };
    if !sr.is_finite() || sr <= 0.0 {
        return None;
    }
    Some(sr.round() as u32)
}

// ===== Bridge-owned clock /s_new (Phase 39d, retooled in 40) =====

/// `/sync` await timeout for the clock /s_new round-trip.
const CLOCK_SNEW_TIMEOUT: Duration = Duration::from_secs(2);

/// Phase 40: instantiate the `\scAppClock` synth on scsynth.
/// Reads `clock_bus` + `clock_node_id` from bridge config (pre-40
/// they came from sclang's bootstrap reply), reads `sample_rate`
/// from scsynth's `/status` reply, sends `/s_new` wrapped in
/// `/sync`, and writes the synthesized [`ClockMetadata`] back
/// onto the SclangServer's metadata cache so SessionInfo sees the
/// full struct. Idempotent at the caller — re-running after a
/// previous /fail is safe.
///
/// Failure modes:
/// - `/fail /s_new` from scsynth — most commonly because sclang
///   hasn't `.add()`-ed the `\scAppClock` SynthDef yet (bridge
///   started before sclang booted). Caller (lazy bootstrap in
///   api.rs) retries on every session create until this succeeds.
/// - `/sync` timeout — scsynth unreachable or wedged.
pub async fn instantiate_bridge_clock(
    scsynth_server: &Arc<Server>,
    sclang_server: &Arc<Server>,
    chunk_size: u32,
    clock_node_id: i32,
    clock_audio_bus: i32,
) -> Result<()> {
    let sample_rate = {
        let m = scsynth_server.metadata().await;
        m.sample_rate.ok_or_else(|| {
            anyhow!("scsynth handshake didn't report sample rate — clock /s_new aborted")
        })?
    };

    // Subscribe to the scsynth broadcast BEFORE sending so we
    // don't race the reply.
    let mut rx = scsynth_server.subscribe();

    // Sync id unlikely to collide with anything else (frontend
    // syncs start at 0; we use a high constant).
    const CLOCK_SYNC_ID: i32 = 0x5C_A1_C7_0C;

    let bundle = OscPacket::Bundle(rosc::OscBundle {
        timetag: rosc::OscTime {
            seconds: 0,
            fractional: 1,
        },
        content: vec![
            OscPacket::Message(OscMessage {
                addr: "/s_new".into(),
                args: vec![
                    OscType::String("scAppClock".into()),
                    OscType::Int(clock_node_id),
                    OscType::Int(0), // addAction = addToHead
                    OscType::Int(0), // target = root group
                    OscType::String("clockBus".into()),
                    OscType::Int(clock_audio_bus),
                    OscType::String("chunkSize".into()),
                    OscType::Int(chunk_size as i32),
                ],
            }),
            OscPacket::Message(OscMessage {
                addr: "/sync".into(),
                args: vec![OscType::Int(CLOCK_SYNC_ID)],
            }),
        ],
    });
    let bytes = rosc::encoder::encode(&bundle).context("encode clock /s_new bundle")?;
    scsynth_server
        .send(&bytes)
        .await
        .context("send clock /s_new bundle")?;

    // Await /synced <id> or /fail /s_new — first one wins.
    let deadline = tokio::time::Instant::now() + CLOCK_SNEW_TIMEOUT;
    loop {
        let remaining = deadline
            .checked_duration_since(tokio::time::Instant::now())
            .ok_or_else(|| anyhow!("clock /s_new: /synced never arrived (timeout)"))?;
        let payload = match timeout(remaining, rx.recv()).await {
            Ok(Ok(p)) => p,
            Ok(Err(_lagged_or_closed)) => continue,
            Err(_) => {
                anyhow::bail!("clock /s_new: /synced never arrived (timeout)");
            }
        };
        let pkt = rosc::decoder::decode_udp(&payload).ok().map(|x| x.1);
        if let Some(msg) = pkt.and_then(|p| match p {
            OscPacket::Message(m) => Some(m),
            _ => None,
        }) {
            if msg.addr == "/synced" {
                if let Some(OscType::Int(id)) = msg.args.first() {
                    if *id == CLOCK_SYNC_ID {
                        break;
                    }
                }
            } else if msg.addr == "/fail"
                && matches!(msg.args.first(), Some(OscType::String(s)) if s == "/s_new")
            {
                anyhow::bail!(
                    "scsynth refused /s_new scAppClock: {}",
                    msg.args
                        .iter()
                        .skip(1)
                        .map(|a| format!("{:?}", a))
                        .collect::<Vec<_>>()
                        .join(" ")
                );
            }
        }
    }

    // Synthesize + write the full ClockMetadata.
    let tick_rate = sample_rate as f64 / chunk_size as f64;
    let metadata = ClockMetadata {
        clock_bus: clock_audio_bus,
        clock_node_id,
        tick_rate,
        chunk_size: chunk_size as i32,
        sample_rate: sample_rate as f64,
    };
    sclang_server.set_clock_metadata(metadata).await;
    tracing::info!(
        clock_audio_bus,
        clock_node_id,
        tick_rate,
        chunk_size,
        sample_rate,
        "scAppClock /s_new succeeded"
    );
    Ok(())
}

/// Phase 39d shutdown: free the clock synth.
pub async fn free_bridge_clock(
    scsynth_server: &Arc<Server>,
    clock_node_id: i32,
) -> Result<()> {
    let pkt = OscPacket::Message(OscMessage {
        addr: "/n_free".into(),
        args: vec![OscType::Int(clock_node_id)],
    });
    let bytes = rosc::encoder::encode(&pkt).context("encode /n_free clock")?;
    scsynth_server
        .send(&bytes)
        .await
        .context("send /n_free clock")?;
    tracing::info!(clock_node_id, "scAppClock /n_free sent");
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
        let pkt = OscPacket::Message(OscMessage {
            addr: "/done".into(),
            args: vec![OscType::String("/notify".into()), OscType::Int(7)],
        });
        let bytes = encode(pkt);
        assert_eq!(parse_done_notify(&bytes), Some(7));
    }

    #[test]
    fn parse_done_notify_rejects_unrelated_done() {
        let pkt = OscPacket::Message(OscMessage {
            addr: "/done".into(),
            args: vec![OscType::String("/d_recv".into())],
        });
        let bytes = encode(pkt);
        assert_eq!(parse_done_notify(&bytes), None);
    }

    #[test]
    fn parse_status_reply_extracts_nominal_rate() {
        // 9 floats + 1 trailing extra (real /status.reply has more,
        // but only index 8 matters here).
        let mut args = vec![OscType::Int(0); 8];
        args.push(OscType::Float(48000.0));
        args.push(OscType::Float(48000.0));
        let pkt = OscPacket::Message(OscMessage {
            addr: "/status.reply".into(),
            args,
        });
        let bytes = encode(pkt);
        assert_eq!(parse_status_reply(&bytes), Some(48000));
    }

    #[test]
    fn parse_status_reply_rounds_nominal() {
        let mut args = vec![OscType::Int(0); 8];
        args.push(OscType::Float(44099.7));
        let pkt = OscPacket::Message(OscMessage {
            addr: "/status.reply".into(),
            args,
        });
        let bytes = encode(pkt);
        assert_eq!(parse_status_reply(&bytes), Some(44100));
    }

    #[test]
    fn parse_version_reply_extracts_fields() {
        let pkt = OscPacket::Message(OscMessage {
            addr: "/version.reply".into(),
            args: vec![
                OscType::String("scsynth".into()),
                OscType::Int(3),
                OscType::Int(13),
                OscType::String(".0".into()),
                OscType::String("HEAD".into()),
                OscType::String("abc1234".into()),
            ],
        });
        let v = parse_version_reply(&encode(pkt)).expect("version parses");
        assert_eq!(v.prog_name, "scsynth");
        assert_eq!(v.major, 3);
        assert_eq!(v.minor, 13);
        assert_eq!(v.patch, ".0");
        assert_eq!(v.branch, "HEAD");
        assert_eq!(v.commit_hash, "abc1234");
    }

    #[test]
    fn parse_version_reply_rejects_unrelated_address() {
        let pkt = OscPacket::Message(OscMessage {
            addr: "/done".into(),
            args: vec![OscType::String("/version".into())],
        });
        assert!(parse_version_reply(&encode(pkt)).is_none());
    }

    #[test]
    fn scan_dirt_samples_walks_subdirs_and_counts_audio_files() {
        let tmp = tempdir();
        // Two banks: bd (2 .wav), sn (1 .aif). One non-bank
        // (Dirt-Samples.quark) should be skipped. One hidden
        // (.git) should be skipped. One file at top level
        // should be skipped (not a directory).
        std::fs::create_dir_all(tmp.path().join("bd")).unwrap();
        std::fs::write(tmp.path().join("bd/a.wav"), b"x").unwrap();
        std::fs::write(tmp.path().join("bd/b.WAV"), b"x").unwrap();
        std::fs::create_dir_all(tmp.path().join("sn")).unwrap();
        std::fs::write(tmp.path().join("sn/k.aif"), b"x").unwrap();
        std::fs::create_dir_all(tmp.path().join("Dirt-Samples.quark")).unwrap();
        std::fs::write(tmp.path().join("Dirt-Samples.quark/meta.txt"), b"x").unwrap();
        std::fs::create_dir_all(tmp.path().join(".git")).unwrap();
        std::fs::write(tmp.path().join("README.md"), b"x").unwrap();

        // Test both the trailing-/* glob form and the bare-dir form.
        let glob = format!("{}/*", tmp.path().display());
        let out = scan_dirt_samples(&glob);
        assert_eq!(out.len(), 2, "got: {out:?}");
        assert_eq!(out[0].name, "bd");
        assert_eq!(out[0].count, 2);
        assert_eq!(out[1].name, "sn");
        assert_eq!(out[1].count, 1);

        let out2 = scan_dirt_samples(&tmp.path().display().to_string());
        assert_eq!(out2.len(), 2);
    }

    #[test]
    fn scan_dirt_samples_empty_or_missing_returns_empty() {
        assert!(scan_dirt_samples("").is_empty());
        assert!(scan_dirt_samples("   ").is_empty());
        assert!(scan_dirt_samples("/this/path/should/not/exist/anywhere").is_empty());
    }

    /// Tiny tempdir helper to avoid pulling in the `tempfile` crate
    /// just for two tests. Returns a guard whose Drop removes the
    /// directory recursively.
    fn tempdir() -> TempDir {
        let mut p = std::env::temp_dir();
        let name = format!(
            "sc-app-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        p.push(name);
        std::fs::create_dir_all(&p).expect("create tempdir");
        TempDir(p)
    }
    struct TempDir(std::path::PathBuf);
    impl TempDir {
        fn path(&self) -> &std::path::Path {
            &self.0
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
}

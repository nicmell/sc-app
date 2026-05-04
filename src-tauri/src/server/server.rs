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
//! role-specific handshake. Phase 39a fills only
//! `scsynth_client_id` + `sample_rate` (from the scsynth
//! handshake). Phase 39b will add sclang-side fields
//! (`clock_bus`, `clock_node_id`, …) populated by the bootstrap
//! protocol.
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
/// Phase 39b: `/sc-app/bootstrap/hello` round-trip per attempt.
/// Phase 39 hotfix follow-up: also covers the new
/// `/sc-app/bootstrap/scsynth-version` reply (third message), so
/// the budget needs to span all three sclang -> bridge sends.
const BOOTSTRAP_TIMEOUT: Duration = Duration::from_secs(3);
/// Phase 39b: how many bootstrap attempts before giving up
/// (and continuing to serve HTTP/WS without sclang metadata).
const BOOTSTRAP_RETRIES: u32 = 5;

/// What kind of server this is. Drives the boot-time handshake +
/// what fields of [`ServerMetadata`] get populated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerRole {
    /// scsynth — runs `/notify 1` + `/status` at boot. Phase 39a
    /// also commits to this server's `clientId` for the bridge's
    /// node-ID space; sub_client_id allocation partitions further.
    Scsynth,
    /// sclang+SuperDirt — Phase 39b will run
    /// `/sc-app/bootstrap/hello` here. Phase 39a treats it as
    /// generic (no handshake).
    #[allow(dead_code)] // 39b uses this.
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
    /// `clientId`. Sessions get a `sub_client_id` that partitions
    /// the node-ID space within this `clientId`.
    pub scsynth_client_id: Option<i32>,
    /// Nominal sample rate from `/status.reply`. Used by
    /// `tickToTimetag` math + scope chunk geometry.
    pub sample_rate: Option<u32>,

    // ── Sclang-side (populated by /sc-app/bootstrap/*) ─────
    /// Phase 39 hotfix follow-up: scsynth `/version.reply` snapshot,
    /// captured by sclang at its own boot (lib/version.scd) and
    /// echoed back to the bridge in the `/sc-app/bootstrap/scsynth-
    /// version` message. Lives on the sclang Server's metadata
    /// because that's where the bridge received it from; the field
    /// describes scsynth, but the chain of custody runs through
    /// sclang. `None` if sclang's /version capture timed out.
    pub scsynth_version: Option<ScsynthVersion>,
    /// Phase 39d: full clock metadata, populated by the bridge
    /// AFTER the clock /s_new succeeds. Sclang's bootstrap reports
    /// only `clock_bus` + `clock_node_id`; the bridge synthesizes
    /// the full struct from those + scsynth's sampleRate + bridge
    /// config's chunkSize. `None` until the post-bootstrap /s_new
    /// completes; `None` permanently if sclang or scsynth isn't
    /// reachable.
    pub clock: Option<ClockMetadata>,
    /// Phase 39d: audio bus index sclang allocated for the clock
    /// synth. Reported in the bootstrap reply; the bridge uses
    /// it as a /s_new arg.
    pub clock_bus: Option<i32>,
    /// Phase 39d: pinned nodeId for the clock synth (999 by
    /// convention). Reported in the bootstrap reply.
    pub clock_node_id: Option<i32>,
    /// Phase 39b scope-buffer pool size (sclang's
    /// `s.scopeBufferAllocator` range, 128).
    pub num_scope_buffers: Option<i32>,
    /// Phase 39b dirt sample bank — `(name, count)` pairs from
    /// `~dirt.buffers`. Empty if SuperDirt didn't install or no
    /// samples were loaded.
    pub dirt_samples: Vec<DirtSample>,
}

/// Clock metadata from sclang's `\scAppClock` synth + the
/// `~scAppBootstrapCtx[\clock]` dictionary.
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
                // /notify + /status BEFORE the recv task starts.
                // The handshake reads replies directly from the
                // socket; spawning the recv task afterward avoids
                // the broadcast race. /version is fetched by sclang
                // (lib/version.scd) and echoed back via the
                // bootstrap reply, so the bridge doesn't probe
                // scsynth for it directly.
                let client_id = notify_handshake(&socket).await?;
                let sample_rate = status_handshake(&socket).await?;
                metadata.scsynth_client_id = Some(client_id);
                metadata.sample_rate = Some(sample_rate);
                tracing::info!(
                    target = %target,
                    client_id,
                    sample_rate,
                    "scsynth Server bootstrapped"
                );
            }
            ServerRole::Sclang => {
                match bootstrap_handshake(&socket).await {
                    Ok(parsed) => {
                        metadata.clock_bus = parsed.clock_bus;
                        metadata.clock_node_id = parsed.clock_node_id;
                        metadata.num_scope_buffers = parsed.num_scope_buffers;
                        metadata.dirt_samples = parsed.dirt_samples;
                        metadata.scsynth_version = parsed.scsynth_version.clone();
                        tracing::info!(
                            target = %target,
                            clock_bus = ?metadata.clock_bus,
                            clock_node_id = ?metadata.clock_node_id,
                            num_scope_buffers = ?metadata.num_scope_buffers,
                            dirt_sample_count = metadata.dirt_samples.len(),
                            scsynth_version = ?parsed.scsynth_version.as_ref().map(|v| format!("{} {}.{}{}", v.prog_name, v.major, v.minor, v.patch)),
                            "sclang Server bootstrapped (clock /s_new pending)"
                        );
                    }
                    Err(e) => {
                        tracing::warn!(
                            target = %target,
                            error = %e,
                            "sclang bootstrap failed — continuing without sclang metadata. \
                             Clock + scope + sequencer features may not work until sclang \
                             is reachable + the bridge is restarted."
                        );
                    }
                }
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

    /// Phase 39 hotfix: write the parsed bootstrap reply into
    /// metadata. Used by [`ensure_sclang_bootstrapped`] for the
    /// runtime re-bootstrap path (when the boot-time bootstrap
    /// missed sclang because the bridge started before sclang
    /// was up).
    async fn set_bootstrap_metadata(
        &self,
        clock_bus: Option<i32>,
        clock_node_id: Option<i32>,
        num_scope_buffers: Option<i32>,
        dirt_samples: Vec<DirtSample>,
        scsynth_version: Option<ScsynthVersion>,
    ) {
        let mut m = self.metadata.write().await;
        m.clock_bus = clock_bus;
        m.clock_node_id = clock_node_id;
        m.num_scope_buffers = num_scope_buffers;
        m.dirt_samples = dirt_samples;
        m.scsynth_version = scsynth_version;
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

// ===== Sclang bootstrap (Phase 39b) =====

#[derive(Debug, Default)]
struct BootstrapParsed {
    clock_bus: Option<i32>,
    clock_node_id: Option<i32>,
    num_scope_buffers: Option<i32>,
    dirt_samples: Vec<DirtSample>,
    /// Phase 39 hotfix follow-up: scsynth /version snapshot, captured
    /// by sclang at its own boot and forwarded as a third bootstrap
    /// reply message. `None` if sclang's /version capture timed out
    /// (empty args on the wire).
    scsynth_version: Option<ScsynthVersion>,
}

/// Send `/sc-app/bootstrap/hello` and await three reply messages:
/// `/sc-app/bootstrap/info`, `/sc-app/bootstrap/samples`,
/// `/sc-app/bootstrap/scsynth-version`. Retries `BOOTSTRAP_RETRIES`
/// times before giving up.
async fn bootstrap_handshake(sock: &UdpSocket) -> Result<BootstrapParsed> {
    for attempt in 0..BOOTSTRAP_RETRIES {
        match try_bootstrap(sock).await {
            Ok(parsed) => return Ok(parsed),
            Err(e) if attempt + 1 < BOOTSTRAP_RETRIES => {
                tracing::debug!(
                    attempt = attempt + 1,
                    retries = BOOTSTRAP_RETRIES,
                    error = %e,
                    "sclang bootstrap attempt failed; retrying"
                );
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!("loop exits via Ok or final Err")
}

async fn try_bootstrap(sock: &UdpSocket) -> Result<BootstrapParsed> {
    let pkt = OscPacket::Message(OscMessage {
        addr: "/sc-app/bootstrap/hello".into(),
        args: vec![],
    });
    let bytes = rosc::encoder::encode(&pkt).context("encode /sc-app/bootstrap/hello")?;
    sock.send(&bytes).await.context("send /sc-app/bootstrap/hello")?;

    // Sclang sends back three messages: /sc-app/bootstrap/info,
    // /sc-app/bootstrap/samples, and /sc-app/bootstrap/scsynth-
    // version. Wait for all three within the timeout. They may
    // arrive as separate UDP datagrams or (less commonly) as a
    // single bundle.
    let mut parsed = BootstrapParsed::default();
    let mut got_info = false;
    let mut got_samples = false;
    let mut got_version = false;
    let mut buf = vec![0u8; 65_536];
    let deadline = tokio::time::Instant::now() + BOOTSTRAP_TIMEOUT;
    while !got_info || !got_samples || !got_version {
        let remaining = deadline
            .checked_duration_since(tokio::time::Instant::now())
            .ok_or_else(|| anyhow!("bootstrap timed out (no reply from sclang)"))?;
        let n = match timeout(remaining, sock.recv(&mut buf)).await {
            Ok(Ok(n)) => n,
            Ok(Err(e)) => return Err(anyhow!("recv during bootstrap: {e}")),
            Err(_) => return Err(anyhow!("bootstrap timed out (no reply from sclang)")),
        };
        let packet = rosc::decoder::decode_udp(&buf[..n])
            .map_err(|e| anyhow!("bootstrap decode: {e:?}"))?
            .1;
        for msg in flatten_packet(packet) {
            match msg.addr.as_str() {
                "/sc-app/bootstrap/info" => {
                    apply_info_args(&mut parsed, &msg.args);
                    got_info = true;
                }
                "/sc-app/bootstrap/samples" => {
                    parsed.dirt_samples = parse_samples_args(&msg.args);
                    got_samples = true;
                }
                "/sc-app/bootstrap/scsynth-version" => {
                    parsed.scsynth_version = parse_scsynth_version_args(&msg.args);
                    got_version = true;
                }
                _ => {
                    // Some other reply on this socket (rare).
                    // Ignore + keep waiting.
                }
            }
        }
    }
    Ok(parsed)
}

fn flatten_packet(pkt: OscPacket) -> Vec<OscMessage> {
    match pkt {
        OscPacket::Message(m) => vec![m],
        OscPacket::Bundle(b) => b
            .content
            .into_iter()
            .flat_map(flatten_packet)
            .collect(),
    }
}

/// Apply kv pairs from `/sc-app/bootstrap/info` to a parsed
/// metadata struct. Args alternate (string key, primitive
/// value). Unknown keys are ignored.
///
/// Phase 39d: only `clockBus`, `clockNodeId`, and
/// `numScopeBuffers` are required. `tickRate`/`chunkSize`/
/// `sampleRate` come from elsewhere (bridge config + scsynth
/// status); the bridge synthesizes the full ClockMetadata
/// after /s_new.
fn apply_info_args(out: &mut BootstrapParsed, args: &[OscType]) {
    let mut iter = args.iter();
    while let Some(key_arg) = iter.next() {
        let OscType::String(key) = key_arg else {
            tracing::debug!(?key_arg, "bootstrap info: non-string key, skipping");
            continue;
        };
        let Some(value) = iter.next() else {
            tracing::debug!(key, "bootstrap info: dangling key with no value");
            break;
        };
        match key.as_str() {
            "clockBus" => out.clock_bus = osc_int(value),
            "clockNodeId" => out.clock_node_id = osc_int(value),
            "numScopeBuffers" => out.num_scope_buffers = osc_int(value),
            // sclangChunkSizeHint, sampleRate, tickRate, chunkSize:
            // legacy / informational; ignored. Bridge owns
            // chunkSize (config) and gets sampleRate from scsynth's
            // /status reply directly.
            _ => {
                tracing::debug!(key, "bootstrap info: unknown / informational key");
            }
        }
    }
}

fn parse_samples_args(args: &[OscType]) -> Vec<DirtSample> {
    let mut out = Vec::with_capacity(args.len() / 2);
    let mut iter = args.iter();
    while let Some(name_arg) = iter.next() {
        let OscType::String(name) = name_arg else {
            continue;
        };
        let Some(count_arg) = iter.next() else {
            break;
        };
        let Some(count) = osc_int(count_arg) else {
            continue;
        };
        out.push(DirtSample {
            name: name.clone(),
            count,
        });
    }
    out
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

#[allow(dead_code)] // future: bootstrap may carry float fields again
fn osc_float(v: &OscType) -> Option<f64> {
    match v {
        OscType::Float(f) => Some(*f as f64),
        OscType::Double(f) => Some(*f),
        OscType::Int(n) => Some(*n as f64),
        OscType::Long(n) => Some(*n as f64),
        _ => None,
    }
}

/// Parse the args of a `/sc-app/bootstrap/scsynth-version` reply.
/// Args layout: `progName major minor patch branch commitHash`.
/// Empty args = sclang's /version capture timed out at its own
/// boot; returns `None` so the bridge surfaces version=null on
/// SessionInfo. Partial / malformed args defensively return
/// `None` rather than throwing.
fn parse_scsynth_version_args(args: &[OscType]) -> Option<ScsynthVersion> {
    if args.is_empty() {
        return None;
    }
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

// ===== Lazy re-bootstrap (Phase 39 hotfix) =====

/// Re-bootstrap timeout for runtime re-attempts. Shorter than
/// the boot-time per-attempt timeout because the recv task is
/// already running and broadcasting; sclang's reply lands as
/// soon as it's processed.
const LAZY_BOOTSTRAP_TIMEOUT: Duration = Duration::from_secs(2);

/// Run the sclang bootstrap handshake AGAIN, this time reading
/// the reply via the Server's broadcast channel (the recv task
/// is already running). Used by `post_session` when the
/// boot-time bootstrap missed sclang (e.g. bridge started
/// before sclang). Idempotent: if metadata is already populated,
/// returns Ok(()) immediately.
///
/// Concurrency: serialized via [`Server`]'s internal lock so two
/// concurrent session creates don't both attempt to bootstrap.
pub async fn ensure_sclang_bootstrapped(
    sclang_server: &Arc<Server>,
) -> Result<()> {
    // Fast path: metadata already populated.
    if sclang_server.metadata().await.clock_bus.is_some() {
        return Ok(());
    }

    // Subscribe BEFORE sending so we don't race the broadcast.
    let mut rx = sclang_server.subscribe();

    let pkt = OscPacket::Message(OscMessage {
        addr: "/sc-app/bootstrap/hello".into(),
        args: vec![],
    });
    let bytes =
        rosc::encoder::encode(&pkt).context("encode /sc-app/bootstrap/hello")?;
    sclang_server
        .send(&bytes)
        .await
        .context("send /sc-app/bootstrap/hello")?;

    let mut parsed = BootstrapParsed::default();
    let mut got_info = false;
    let mut got_samples = false;
    let mut got_version = false;
    let deadline = tokio::time::Instant::now() + LAZY_BOOTSTRAP_TIMEOUT;
    while !got_info || !got_samples || !got_version {
        let remaining = deadline
            .checked_duration_since(tokio::time::Instant::now())
            .ok_or_else(|| {
                anyhow!("lazy bootstrap timed out (no reply from sclang)")
            })?;
        let payload = match timeout(remaining, rx.recv()).await {
            Ok(Ok(p)) => p,
            Ok(Err(_lagged_or_closed)) => continue,
            Err(_) => {
                anyhow::bail!("lazy bootstrap timed out (no reply from sclang)")
            }
        };
        let pkt = match rosc::decoder::decode_udp(&payload) {
            Ok((_, p)) => p,
            Err(_) => continue,
        };
        for msg in flatten_packet(pkt) {
            match msg.addr.as_str() {
                "/sc-app/bootstrap/info" => {
                    apply_info_args(&mut parsed, &msg.args);
                    got_info = true;
                }
                "/sc-app/bootstrap/samples" => {
                    parsed.dirt_samples = parse_samples_args(&msg.args);
                    got_samples = true;
                }
                "/sc-app/bootstrap/scsynth-version" => {
                    parsed.scsynth_version = parse_scsynth_version_args(&msg.args);
                    got_version = true;
                }
                _ => {}
            }
        }
    }

    sclang_server
        .set_bootstrap_metadata(
            parsed.clock_bus,
            parsed.clock_node_id,
            parsed.num_scope_buffers,
            parsed.dirt_samples,
            parsed.scsynth_version,
        )
        .await;

    tracing::info!(
        target = %sclang_server.target(),
        "sclang lazy bootstrap succeeded"
    );

    Ok(())
}

// ===== Bridge-owned clock /s_new (Phase 39d) =====

/// `/sync` await timeout for the clock /s_new round-trip.
const CLOCK_SNEW_TIMEOUT: Duration = Duration::from_secs(2);

/// Phase 39d: instantiate the `\scAppClock` synth on scsynth.
/// Reads `clockBus` + `clockNodeId` from the SclangServer's
/// metadata (populated by the bootstrap reply), reads
/// `chunkSize` from bridge config, sends `/s_new` wrapped in
/// `/sync`, and writes the synthesized [`ClockMetadata`] back
/// onto the SclangServer's metadata cache so SessionInfo sees
/// the full struct.
pub async fn instantiate_bridge_clock(
    scsynth_server: &Arc<Server>,
    sclang_server: &Arc<Server>,
    chunk_size: u32,
) -> Result<()> {
    let (clock_bus, clock_node_id) = {
        let m = sclang_server.metadata().await;
        (
            m.clock_bus.ok_or_else(|| {
                anyhow!("sclang bootstrap didn't report clockBus — clock /s_new aborted")
            })?,
            m.clock_node_id.ok_or_else(|| {
                anyhow!("sclang bootstrap didn't report clockNodeId — clock /s_new aborted")
            })?,
        )
    };
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
                    OscType::Int(clock_bus),
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
        clock_bus,
        clock_node_id,
        tick_rate,
        chunk_size: chunk_size as i32,
        sample_rate: sample_rate as f64,
    };
    sclang_server.set_clock_metadata(metadata).await;
    tracing::info!(
        clock_bus,
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
}

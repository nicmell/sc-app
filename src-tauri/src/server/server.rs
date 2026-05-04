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
    /// scsynth's assigned `clientId` from `/done /notify`. Bridge
    /// runs `/notify 1` once at boot; this is the bridge-wide
    /// `clientId`. Sessions get a `sub_client_id` that partitions
    /// the node-ID space within this `clientId`.
    pub scsynth_client_id: Option<i32>,
    /// Nominal sample rate from `/status.reply`. Used by
    /// `tickToTimetag` math + scope chunk geometry.
    pub sample_rate: Option<u32>,
    // Phase 39b will add: clock_bus, clock_node_id, tick_rate,
    // chunk_size, num_scope_buffers, dirt_buffers, sc_app_synthdefs.
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
                // socket; spawning the recv task afterward
                // avoids the broadcast race.
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
            ServerRole::Sclang | ServerRole::Generic => {
                // No-op for 39a. Phase 39b adds the
                // /sc-app/bootstrap/hello round-trip here for
                // ServerRole::Sclang.
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

use crate::clock::{ClockService, ClockState};
use rosc::{decoder, encoder, OscMessage, OscPacket, OscType};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tokio::net::UdpSocket;
use tokio::sync::{mpsc, Mutex};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;

pub type SubId = u64;

pub trait BufferSink: Send {
    fn send(&mut self, tick: &[f32]) -> bool;
    fn close(&mut self);
}

pub struct TauriChannelSink {
    pub channel: Channel<Vec<f32>>,
}

impl BufferSink for TauriChannelSink {
    fn send(&mut self, tick: &[f32]) -> bool {
        self.channel.send(tick.to_vec()).is_ok()
    }
    fn close(&mut self) {}
}

pub struct WsSink {
    pub tx: mpsc::Sender<Message>,
}

impl BufferSink for WsSink {
    fn send(&mut self, tick: &[f32]) -> bool {
        let mut buf = Vec::with_capacity(4 + tick.len() * 4);
        buf.extend_from_slice(&(tick.len() as u32).to_le_bytes());
        for s in tick {
            buf.extend_from_slice(&s.to_le_bytes());
        }
        match self.tx.try_send(Message::Binary(buf.into())) {
            Ok(()) => true,
            Err(mpsc::error::TrySendError::Full(_)) => true,
            Err(mpsc::error::TrySendError::Closed(_)) => false,
        }
    }
    fn close(&mut self) {}
}

struct ReaderHandle {
    task: JoinHandle<()>,
    sinks: Arc<Mutex<HashMap<SubId, Box<dyn BufferSink>>>>,
}

pub struct BufferStreamState {
    readers: Mutex<HashMap<i32, ReaderHandle>>,
    index: Mutex<HashMap<SubId, i32>>,
    next_id: AtomicU64,
}

impl BufferStreamState {
    pub fn new() -> Self {
        Self {
            readers: Mutex::new(HashMap::new()),
            index: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
        }
    }

    /// Subscribe a sink to a buffer's sample stream. Passing `clock = Some(_)`
    /// activates phase-tracked mode: the reader anchors its `/b_getn` target
    /// to the shared clock's `samples_now()` — appropriate for writers that
    /// read the shared `PHASE_BUS`. `clock = None` keeps wall-clock mode for
    /// plain `sc-buffer + RecordBuf` consumers.
    pub async fn subscribe(
        &self,
        bufnum: i32,
        frames: i32,
        chunk: i32,
        sample_rate: i32,
        scsynth_addr: &str,
        clock: Option<Arc<ClockService>>,
        sink: Box<dyn BufferSink>,
    ) -> Result<SubId, String> {
        let sub_id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let mut readers = self.readers.lock().await;
        if let Some(h) = readers.get(&bufnum) {
            h.sinks.lock().await.insert(sub_id, sink);
        } else {
            let mut initial = HashMap::new();
            initial.insert(sub_id, sink);
            let sinks = Arc::new(Mutex::new(initial));
            let task = spawn_reader(
                bufnum,
                frames,
                chunk,
                sample_rate,
                scsynth_addr.to_string(),
                clock,
                sinks.clone(),
            );
            readers.insert(bufnum, ReaderHandle { task, sinks });
        }
        drop(readers);
        self.index.lock().await.insert(sub_id, bufnum);
        Ok(sub_id)
    }

    pub async fn unsubscribe(&self, sub_id: SubId) {
        let Some(bufnum) = self.index.lock().await.remove(&sub_id) else {
            return;
        };
        let mut readers = self.readers.lock().await;
        let Some(h) = readers.get(&bufnum) else { return };
        let empty = {
            let mut sinks = h.sinks.lock().await;
            if let Some(mut sink) = sinks.remove(&sub_id) {
                sink.close();
            }
            sinks.is_empty()
        };
        if empty {
            if let Some(h) = readers.remove(&bufnum) {
                h.task.abort();
            }
        }
    }
}

/// Catch-up reader loop. Each tick we compute a `target` absolute sample
/// count the reader should have issued by now and fire `/b_getn` until
/// `samples_issued` catches up. Two modes, selected at subscription:
///
///   1. **Clocked** (`clock = Some(_)`): `target = clock.samples_now() -
///      safety`, where `samples_now()` is the shared broadcaster's Phasor
///      position extrapolated from the last `/tr`. The reader stays exactly
///      `safety_samples` behind the writer's head — no seam risk, and every
///      phase-tracked buffer (sc-test etc.) shares the same anchor so there
///      is no per-buffer /tr traffic.
///   2. **Wall-clock** (`clock = None`): `target = elapsed_ms * sr / 1000`.
///      Reader and writer heads start at arbitrary phase relative to each
///      other; when that phase puts the writer inside the read range, a
///      single /b_getn returns samples interleaved between two cycles (the
///      "seam zone"). Kept for plain `sc-buffer + RecordBuf` consumers that
///      don't participate in the shared clock.
fn spawn_reader(
    bufnum: i32,
    frames: i32,
    chunk: i32,
    sample_rate: i32,
    addr: String,
    clock: Option<Arc<ClockService>>,
    sinks: Arc<Mutex<HashMap<SubId, Box<dyn BufferSink>>>>,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let sock = match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => s,
            Err(e) => {
                eprintln!("buffer reader bind failed: {e}");
                return;
            }
        };
        if let Err(e) = sock.connect(&addr).await {
            eprintln!("buffer reader connect {addr} failed: {e}");
            return;
        }

        // Clocked mode listens for /tr on the shared ClockService socket, so
        // the reader socket doesn't need /notify — it only receives /b_setn
        // replies to its own /b_getn (which scsynth unicasts back to the
        // sender regardless of notify state). Wall-clock mode is the same.

        let mut interval = tokio::time::interval(Duration::from_millis(16));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let start_time = Instant::now();
        let mut samples_issued: i64 = 0;
        let mut buf = [0u8; 65536];
        let sr = sample_rate.max(1) as i64;
        let frames_i64 = frames.max(1) as i64;
        let safety_samples: i64 = (2 * chunk as i64).min(frames_i64 / 2);

        // Clocked mode uses this to snap `samples_issued` on the first Running
        // state observed (and on every transition out of Silent).
        let mut first_anchor = true;
        // For state-transition logging — we only want to log the first tick
        // that enters Silent, not every subsequent tick during a long pause.
        let mut was_silent = false;
        // Wall-clock mode grace: defers the first /b_getn ~100 ms so plain
        // RecordBuf writers have time to fill one cycle before we read.
        const WALLCLOCK_GRACE_MS: u64 = 100;

        let mut samples_requested: i64 = 0;
        let mut samples_received: i64 = 0;
        let mut reads_issued: u64 = 0;
        // Heartbeat ~1 Hz (62 × 16 ms). Dead reckoning — cheaper than another
        // tokio::time::interval branch in the select!.
        let mut tick_count: u64 = 0;
        const HEARTBEAT_EVERY: u64 = 62;

        eprintln!(
            "reader[buf {bufnum}] started; mode={} frames={frames} chunk={chunk} safety={safety_samples}",
            if clock.is_some() { "clocked" } else { "wallclock" }
        );

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    tick_count += 1;
                    let target = match &clock {
                        Some(c) => match c.state().await {
                            ClockState::Waiting => {
                                // Broadcaster hasn't anchored yet — hold off
                                // on reads entirely.
                                continue;
                            }
                            ClockState::Silent => {
                                if !was_silent {
                                    eprintln!("reader[buf {bufnum}] clock silent — injecting zeros");
                                    was_silent = true;
                                }
                                // Broadcaster paused: push zeros, don't poll
                                // the stale buffer. Re-snap on next Running.
                                let zeros = vec![0.0_f32; chunk.max(1) as usize];
                                let mut guard = sinks.lock().await;
                                guard.retain(|_, sink| sink.send(&zeros));
                                if guard.is_empty() {
                                    break;
                                }
                                first_anchor = true;
                                continue;
                            }
                            ClockState::Running { samples: writer_virtual } => {
                                if was_silent {
                                    eprintln!("reader[buf {bufnum}] clock resumed");
                                    was_silent = false;
                                }
                                if first_anchor {
                                    samples_issued = writer_virtual - safety_samples;
                                    first_anchor = false;
                                    eprintln!(
                                        "reader[buf {bufnum}] clock anchor; virtual={writer_virtual} samples_issued={samples_issued}"
                                    );
                                }
                                writer_virtual - safety_samples
                            }
                        },
                        None => {
                            let elapsed_ms = start_time.elapsed().as_millis() as u64;
                            if elapsed_ms < WALLCLOCK_GRACE_MS {
                                continue;
                            }
                            ((elapsed_ms as i64) * sr) / 1000
                        }
                    };

                    while samples_issued < target {
                        let pos_mod = ((samples_issued % frames_i64) + frames_i64) % frames_i64;
                        let pos = pos_mod as i32;
                        let until_wrap = frames - pos;
                        let delta = (target - samples_issued)
                            .min(chunk as i64)
                            .min(until_wrap as i64) as i32;
                        if delta <= 0 {
                            break;
                        }
                        let msg = OscMessage {
                            addr: "/b_getn".into(),
                            args: vec![
                                OscType::Int(bufnum),
                                OscType::Int(pos),
                                OscType::Int(delta),
                            ],
                        };
                        if let Ok(bytes) = encoder::encode(&OscPacket::Message(msg)) {
                            let _ = sock.send(&bytes).await;
                        }
                        samples_issued += delta as i64;
                        samples_requested += delta as i64;
                        reads_issued += 1;
                    }

                    if tick_count % HEARTBEAT_EVERY == 0 {
                        let in_flight = samples_requested - samples_received;
                        eprintln!(
                            "reader[buf {bufnum}] heartbeat: requested={samples_requested} received={samples_received} in_flight={in_flight} reads={reads_issued}"
                        );
                    }
                }
                r = sock.recv(&mut buf) => {
                    match r {
                        Ok(n) => {
                            let Ok((_, packet)) = decoder::decode_udp(&buf[..n]) else { continue };
                            let mut samples = Vec::new();
                            walk_b_setn(&packet, bufnum, &mut samples);
                            if !samples.is_empty() {
                                samples_received += samples.len() as i64;
                                let mut guard = sinks.lock().await;
                                guard.retain(|_, sink| sink.send(&samples));
                                if guard.is_empty() {
                                    break;
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
            }
        }
    })
}

fn walk_b_setn(packet: &OscPacket, target: i32, out: &mut Vec<f32>) {
    match packet {
        OscPacket::Message(m) => {
            if m.addr != "/b_setn" {
                return;
            }
            let mut it = m.args.iter();
            match it.next() {
                Some(OscType::Int(b)) if *b == target => {}
                _ => return,
            }
            it.next(); // start
            it.next(); // count
            for a in it {
                if let OscType::Float(f) = a {
                    out.push(*f);
                }
            }
        }
        OscPacket::Bundle(b) => {
            for p in &b.content {
                walk_b_setn(p, target, out);
            }
        }
    }
}

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

    pub async fn subscribe(
        &self,
        bufnum: i32,
        frames: i32,
        chunk: i32,
        sample_rate: i32,
        scsynth_addr: &str,
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

/// The reader runs a time-tracked catch-up loop. Each tick we compute a
/// `target` absolute sample count the reader should have issued by now, and
/// issue as many `/b_getn` requests as needed to keep `samples_issued` level
/// with `target`. `chunk` caps the max samples per single request, and reads
/// never cross the buffer wrap.
///
/// Two modes of `target` computation, switching automatically:
///
///   1. **Wall-clock mode** (default, applies to plain `RecordBuf`
///      producers): `target = elapsed_ms * sample_rate / 1000`. Reader and
///      writer heads start at arbitrary phase relative to each other; if
///      that phase puts the writer inside one of the reader's read ranges,
///      the returned samples are seam-interleaved between two buffer cycles.
///
///   2. **Phase-tracked mode** (activates on first `/tr` with id == bufnum,
///      emitted by synthdefs that use `SendTrig.kr` + `A2K.kr(Phasor.ar)`):
///      `target` is derived from the writer's reported phase + elapsed,
///      minus a safety margin of `2 × chunk` samples. The reader stays
///      safely behind the write head — reads never straddle the writer,
///      so samples are always from one continuous cycle. This is required
///      for gap-free recording quality; for scope-style visual use cases
///      wall-clock mode is usually good enough.
fn spawn_reader(
    bufnum: i32,
    frames: i32,
    chunk: i32,
    sample_rate: i32,
    addr: String,
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

        // Register this socket for server-side reply broadcasts. scsynth's
        // SendTrig uses `SendDoneToAllNotified`, so /tr messages reach every
        // notified client — not only the one that created the synth. This
        // means the reader can observe phase reports from synths owned by
        // the frontend's main OSC socket.
        let notify = OscMessage {
            addr: "/notify".into(),
            args: vec![OscType::Int(1)],
        };
        if let Ok(bytes) = encoder::encode(&OscPacket::Message(notify)) {
            let _ = sock.send(&bytes).await;
        }
        eprintln!("reader[buf {bufnum}] started; /notify 1 sent, awaiting /tr");

        let mut interval = tokio::time::interval(Duration::from_millis(16));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let start_time = Instant::now();
        let mut samples_issued: i64 = 0;
        let mut buf = [0u8; 65536];
        let sr = sample_rate.max(1) as i64;
        let frames_i64 = frames.max(1) as i64;
        // Phase-tracked safety: keep reader this many samples behind the
        // writer's head. Needs to exceed chunk (so reads don't straddle
        // the writer) plus a jitter budget. `2 * chunk` is comfortable for
        // localhost; for tiny buffers, clamp so the safety plus one chunk
        // still fits within a cycle.
        let safety_samples: i64 = (2 * chunk as i64).min(frames_i64 / 2);

        // Set when we first hear a /tr reply with id == bufnum, switching
        // the reader into phase-tracked mode. `anchor.0` is the writer's
        // **unwrapped** virtual phase (cumulative samples written) at
        // anchor time — in the same coordinate system as `samples_issued`.
        let mut writer_anchor: Option<(i64, Instant)> = None;
        // Phasor reports its buffer-position phase in [0, frames); we unwrap
        // it to a monotonic counter by tracking each time it falls backward
        // (a wrap). Without this, re-anchoring on every /tr would snap
        // `anchor_samples` back to ~0 after each wrap while `samples_issued`
        // keeps growing — target drops far below samples_issued and the
        // reader stops issuing /b_getn.
        let mut last_phase: Option<i64> = None;
        let mut wrap_count: i64 = 0;
        let mut tr_count: u64 = 0;
        // Accounting for the heartbeat diagnostic:
        //   samples_requested = sum of `delta` across every /b_getn we sent
        //   samples_received  = total floats delivered in /b_setn replies
        //   reads_issued      = total /b_getn count
        // At steady state, `requested == received` (localhost has no drops);
        // any persistent gap points at UDP loss or decode mismatch.
        let mut samples_requested: i64 = 0;
        let mut samples_received: i64 = 0;
        let mut reads_issued: u64 = 0;
        // SendTrig fires at 200 Hz; log one in every 200 so the console gets
        // a heartbeat at ~1 Hz instead of drowning in phase updates. Set to 0
        // to silence — useful to flip on/off during diagnosis.
        const TR_LOG_EVERY: u64 = 200;

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let target = if let Some((anchor_samples, anchor_time)) = writer_anchor {
                        let elapsed_secs = anchor_time.elapsed().as_secs_f64();
                        anchor_samples + (elapsed_secs * sr as f64) as i64 - safety_samples
                    } else {
                        let elapsed_ms = start_time.elapsed().as_millis() as i64;
                        (elapsed_ms * sr) / 1000
                    };
                    while samples_issued < target {
                        let pos_mod = ((samples_issued % frames_i64) + frames_i64) % frames_i64;
                        let pos = pos_mod as i32;
                        let until_wrap = frames - pos;
                        let delta = (target - samples_issued).min(chunk as i64).min(until_wrap as i64) as i32;
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
                }
                r = sock.recv(&mut buf) => {
                    match r {
                        Ok(n) => {
                            let Ok((_, packet)) = decoder::decode_udp(&buf[..n]) else { continue };

                            // /b_setn replies — forward samples to sinks.
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

                            // /tr phase updates — re-anchor on every arrival.
                            // Wall-clock extrapolation drifts against the DSP
                            // clock (tens of ppm) so a single anchor slowly
                            // eats into the safety margin; refreshing on each
                            // `/tr` keeps the reader pinned at
                            // `safety_samples` behind the writer's head.
                            //
                            // On the FIRST anchor, also snap `samples_issued`
                            // to `phase - safety` (in the same linear counter
                            // as `target`). Do NOT wrap to positive — the
                            // `pos_mod` step below handles negative counters,
                            // and wrapping here would put `samples_issued`
                            // `frames` samples ahead of `target` and stall
                            // the reader for `frames / sr` seconds.
                            if let Some(phase) = extract_tr_phase(&packet, bufnum) {
                                let phase_i = phase as i64;
                                // Detect Phasor wrap: phase jumped backward by
                                // more than half the buffer. Bump wrap_count so
                                // `writer_virtual` stays monotonic across
                                // cycles.
                                if let Some(lp) = last_phase {
                                    if phase_i + frames_i64 / 2 < lp {
                                        wrap_count += 1;
                                    }
                                }
                                last_phase = Some(phase_i);
                                let writer_virtual = phase_i + wrap_count * frames_i64;

                                if writer_anchor.is_none() {
                                    samples_issued = writer_virtual - safety_samples;
                                    eprintln!(
                                        "reader[buf {bufnum}] first /tr; anchor virtual={writer_virtual} samples_issued={samples_issued} safety={safety_samples}"
                                    );
                                }
                                writer_anchor = Some((writer_virtual, Instant::now()));
                                tr_count += 1;
                                if TR_LOG_EVERY > 0 && tr_count % TR_LOG_EVERY == 0 {
                                    // Writer_virtual == extrapolated writer
                                    // position right now (we just anchored).
                                    // `gap` is how far the writer is ahead of
                                    // the reader — expected value is
                                    // `safety_samples` ± one chunk.
                                    let gap = writer_virtual - samples_issued;
                                    let in_flight = samples_requested - samples_received;
                                    eprintln!(
                                        "reader[buf {bufnum}] /tr heartbeat: count={tr_count} virtual={writer_virtual} phase={phase_i} wraps={wrap_count} gap={gap} (expect ~{safety_samples}) requested={samples_requested} received={samples_received} in_flight={in_flight} reads={reads_issued}"
                                    );
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

/// Extract the phase value from a `/tr [nodeId, triggerId, value]` reply
/// when `triggerId == bufnum`. The synthdef uses `SendTrig.kr(trig, bufnum,
/// A2K.kr(phase))` so the third arg is the writer's buffer phase in samples.
fn extract_tr_phase(packet: &OscPacket, bufnum: i32) -> Option<f32> {
    match packet {
        OscPacket::Message(m) => {
            if m.addr != "/tr" {
                return None;
            }
            let mut it = m.args.iter();
            let _node = it.next()?;
            let id = match it.next()? {
                OscType::Int(i) => *i,
                _ => return None,
            };
            if id != bufnum {
                return None;
            }
            match it.next()? {
                OscType::Float(f) => Some(*f),
                _ => None,
            }
        }
        OscPacket::Bundle(b) => {
            for p in &b.content {
                if let Some(v) = extract_tr_phase(p, bufnum) {
                    return Some(v);
                }
            }
            None
        }
    }
}

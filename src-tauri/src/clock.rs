//! Global phase clock for phase-tracked buffer readers.
//!
//! A single scsynth-side synth (spawned client-side, `__global_clock__`)
//! runs `Phasor.ar` → `Out.ar` on `PHASE_BUS` plus `SendTrig.kr` firing
//! `/tr` tagged with `CLOCK_TRIGGER_ID` at ~10 Hz. This service binds a
//! dedicated UDP socket, registers with `/notify 1`, and maintains a
//! drift-corrected anchor from the /tr stream. Callers query it via
//! `state()` to find the writer's current virtual sample position —
//! independent of any particular buffer, since all phase-tracked buffers
//! share the same Phasor.
//!
//! The TS side owns the broadcaster synthdef and its `/s_new` / `/n_free`
//! lifecycle. This service owns only the UDP listener and the anchor
//! state; it's restartable via `start()` which re-binds and resets.

use rosc::{decoder, encoder, OscMessage, OscPacket, OscType};
use std::sync::Arc;
use std::time::Instant;
use tokio::net::UdpSocket;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

// Mirror of src/constants/osc.ts — must stay in sync.
pub const CLOCK_TRIGGER_ID: i32 = 4242;
pub const SHARED_FRAMES: i64 = 8192;

/// If no `/tr` has arrived for this long after we had an anchor, the
/// broadcaster is paused (plugin group or default group stopped from UI).
/// State flips to `Silent`; readers consume it by emitting zeros.
/// ~3× the broadcaster's 10 Hz tick keeps us robust to scheduler jitter.
const TR_SILENCE_MS: u64 = 300;

#[derive(Debug, Clone, Copy, serde::Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ClockState {
    /// No `/tr` ever received; broadcaster still warming up (or not started).
    Waiting,
    /// Anchor fresh; `samples` is the writer's current virtual sample index,
    /// extrapolated from the last anchor via the configured sample rate.
    Running { samples: i64 },
    /// Anchor present but stale — writer is paused.
    Silent,
}

struct Inner {
    /// `(unwrapped virtual phase, wall-clock time of that phase)` from the
    /// most recent `/tr`. `None` before the first /tr.
    anchor: Option<(i64, Instant)>,
    /// Most recent /tr receipt time, for silence detection.
    last_tr: Option<Instant>,
    /// Last raw (wrapped) phase, for wrap detection.
    last_phase: Option<i64>,
    /// Number of Phasor wraps observed, so `writer_virtual = phase + wrap_count * frames`.
    wrap_count: i64,
    /// Sample rate for extrapolation between anchors. Set at `start()`.
    sr: f64,
}

impl Inner {
    fn reset(&mut self, sr: i32) {
        self.anchor = None;
        self.last_tr = None;
        self.last_phase = None;
        self.wrap_count = 0;
        self.sr = (sr.max(1)) as f64;
    }
}

pub struct ClockService {
    inner: Arc<Mutex<Inner>>,
    task: Mutex<Option<JoinHandle<()>>>,
}

impl ClockService {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner {
                anchor: None,
                last_tr: None,
                last_phase: None,
                wrap_count: 0,
                sr: 48_000.0,
            })),
            task: Mutex::new(None),
        }
    }

    /// (Re)bind a UDP socket to `scsynth_addr`, register for broadcasts via
    /// `/notify 1`, and spawn the listener task. If a previous task exists,
    /// abort it and wipe anchor state first. Safe to call on every connect.
    pub async fn start(&self, scsynth_addr: &str, sample_rate: i32) -> Result<(), String> {
        if let Some(handle) = self.task.lock().await.take() {
            handle.abort();
        }
        self.inner.lock().await.reset(sample_rate);

        let sock = UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("clock bind failed: {e}"))?;
        sock.connect(scsynth_addr)
            .await
            .map_err(|e| format!("clock connect {scsynth_addr} failed: {e}"))?;

        // Register for /tr broadcasts. `SendTrig` in the broadcaster synth uses
        // `SendDoneToAllNotified`, so /tr reaches every notified client.
        let notify = OscMessage {
            addr: "/notify".into(),
            args: vec![OscType::Int(1)],
        };
        if let Ok(bytes) = encoder::encode(&OscPacket::Message(notify)) {
            let _ = sock.send(&bytes).await;
        }
        eprintln!(
            "clock[svc] started on {scsynth_addr}; sr={sample_rate}; awaiting /tr id={CLOCK_TRIGGER_ID}"
        );

        let inner = self.inner.clone();
        let handle = tokio::spawn(async move {
            let mut buf = [0u8; 4096];
            // 10 Hz broadcaster × 10 → ~1 Hz log line; drops to 0 to silence.
            const TR_LOG_EVERY: u64 = 10;
            let mut tr_count: u64 = 0;
            loop {
                let n = match sock.recv(&mut buf).await {
                    Ok(n) => n,
                    Err(_) => break,
                };
                let Ok((_, packet)) = decoder::decode_udp(&buf[..n]) else { continue };
                let Some(phase) = extract_clock_phase(&packet) else { continue };
                let phase_i = phase as i64;

                let mut g = inner.lock().await;
                let first_anchor = g.anchor.is_none();
                let gap_ms = g.last_tr.map(|t| t.elapsed().as_millis() as u64);
                let recovering = gap_ms
                    .map(|ms| ms > TR_SILENCE_MS)
                    .unwrap_or(false);
                // Wrap detection: Phasor.ar advances monotonically at sample
                // rate, so any observed backward movement means the Phasor
                // wrapped. We assume at most one wrap per /tr, which holds as
                // long as the broadcaster's /tr period advances phase by less
                // than `SHARED_FRAMES` samples (10 Hz × 48 kHz = 4800 per
                // /tr ≪ 8192, safe margin).
                //
                // The earlier threshold (`phase_i + SHARED_FRAMES / 2 < lp`)
                // silently failed here: 4800-sample advance leaves only a
                // 3392-sample apparent backward jump on wrap, below the
                // 4096 threshold.
                if let Some(lp) = g.last_phase {
                    if phase_i < lp {
                        g.wrap_count += 1;
                    }
                }
                g.last_phase = Some(phase_i);
                let virt = phase_i + g.wrap_count * SHARED_FRAMES;
                let now = Instant::now();
                g.anchor = Some((virt, now));
                g.last_tr = Some(now);
                tr_count += 1;
                if first_anchor {
                    eprintln!("clock[svc] anchored; virtual={virt}");
                } else if recovering {
                    eprintln!(
                        "clock[svc] recovered from silence (gap={}ms); virtual={virt}",
                        gap_ms.unwrap_or(0)
                    );
                }
                if TR_LOG_EVERY > 0 && tr_count % TR_LOG_EVERY == 0 {
                    eprintln!(
                        "clock[svc] /tr heartbeat: count={tr_count} phase={phase_i} virtual={virt} wraps={}",
                        g.wrap_count
                    );
                }
            }
            eprintln!("clock[svc] listener exited");
        });
        *self.task.lock().await = Some(handle);
        Ok(())
    }

    /// Abort the listener task and reset anchor state. State becomes `Waiting`.
    pub async fn stop(&self) {
        if let Some(handle) = self.task.lock().await.take() {
            handle.abort();
        }
        self.inner.lock().await.reset(48_000);
    }

    /// Snapshot of clock state. Cheap (one mutex acquisition, no I/O).
    pub async fn state(&self) -> ClockState {
        let g = self.inner.lock().await;
        match (g.anchor, g.last_tr) {
            (None, _) => ClockState::Waiting,
            (Some(_), Some(ltt)) if ltt.elapsed().as_millis() as u64 > TR_SILENCE_MS => {
                ClockState::Silent
            }
            (Some((virt, at)), _) => {
                let elapsed = at.elapsed().as_secs_f64();
                ClockState::Running {
                    samples: virt + (elapsed * g.sr) as i64,
                }
            }
        }
    }
}

fn extract_clock_phase(packet: &OscPacket) -> Option<f32> {
    match packet {
        OscPacket::Message(m) if m.addr == "/tr" => {
            let mut it = m.args.iter();
            let _node = it.next()?;
            let id = match it.next()? {
                OscType::Int(i) => *i,
                _ => return None,
            };
            if id != CLOCK_TRIGGER_ID {
                return None;
            }
            match it.next()? {
                OscType::Float(f) => Some(*f),
                _ => None,
            }
        }
        OscPacket::Bundle(b) => b.content.iter().find_map(extract_clock_phase),
        _ => None,
    }
}

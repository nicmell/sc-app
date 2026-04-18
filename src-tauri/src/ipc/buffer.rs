use rosc::{decoder, encoder, OscMessage, OscPacket, OscType};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
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
            let task = spawn_reader(bufnum, frames, chunk, scsynth_addr.to_string(), sinks.clone());
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

fn spawn_reader(
    bufnum: i32,
    frames: i32,
    chunk: i32,
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

        let mut interval = tokio::time::interval(Duration::from_millis(33));
        let mut start: i32 = 0;
        let mut buf = [0u8; 65536];

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let remaining = (frames - start).max(1);
                    let count = chunk.min(remaining);
                    let msg = OscMessage {
                        addr: "/b_getn".into(),
                        args: vec![
                            OscType::Int(bufnum),
                            OscType::Int(start),
                            OscType::Int(count),
                        ],
                    };
                    if let Ok(bytes) = encoder::encode(&OscPacket::Message(msg)) {
                        let _ = sock.send(&bytes).await;
                    }
                    start = (start + count) % frames.max(1);
                }
                r = sock.recv(&mut buf) => {
                    match r {
                        Ok(n) => {
                            if let Some(samples) = extract_b_setn(&buf[..n], bufnum) {
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

fn extract_b_setn(bytes: &[u8], target: i32) -> Option<Vec<f32>> {
    let packet = decoder::decode_udp(bytes).ok()?.1;
    let mut samples = Vec::new();
    walk(&packet, target, &mut samples);
    if samples.is_empty() {
        None
    } else {
        Some(samples)
    }
}

fn walk(packet: &OscPacket, target: i32, out: &mut Vec<f32>) {
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
                walk(p, target, out);
            }
        }
    }
}

use super::buffer::BufferSink;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

/// Standard RIFF/WAVE canonical header size. scsynth writes a 44-byte header
/// for `wav` + `float` format (write it once, patch data size on close).
const WAV_HEADER_BYTES: u64 = 44;

struct Session {
    path: PathBuf,
    tail_task: Mutex<Option<JoinHandle<()>>>,
}

pub struct RecordingState {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
    seq: AtomicU64,
}

impl RecordingState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            seq: AtomicU64::new(0),
        }
    }

    /// Reserve a fresh recording slot. Produces a unique id + an absolute path
    /// under the system temp dir. The file is NOT created here — scsynth creates
    /// it in response to `/b_write`.
    pub async fn open(&self) -> (String, PathBuf) {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let n = self.seq.fetch_add(1, Ordering::SeqCst);
        let id = format!("{nanos:x}-{n:x}");
        let path = std::env::temp_dir().join(format!("sc-record-{id}.wav"));
        let session = Arc::new(Session {
            path: path.clone(),
            tail_task: Mutex::new(None),
        });
        self.sessions.lock().await.insert(id.clone(), session);
        (id, path)
    }

    pub async fn path_of(&self, id: &str) -> Option<PathBuf> {
        self.sessions.lock().await.get(id).map(|s| s.path.clone())
    }

    pub async fn start_tail(&self, id: &str, sink: Box<dyn BufferSink>) -> Result<(), String> {
        let session = self
            .sessions
            .lock()
            .await
            .get(id)
            .cloned()
            .ok_or_else(|| format!("unknown recording id: {id}"))?;
        let mut guard = session.tail_task.lock().await;
        if let Some(t) = guard.take() {
            t.abort();
        }
        let path = session.path.clone();
        let sink = Arc::new(Mutex::new(sink));
        let task = spawn_tail_reader(path, sink);
        *guard = Some(task);
        Ok(())
    }

    pub async fn stop_tail(&self, id: &str) {
        if let Some(session) = self.sessions.lock().await.get(id).cloned() {
            if let Some(t) = session.tail_task.lock().await.take() {
                t.abort();
            }
        }
    }

    pub async fn read_all(&self, id: &str) -> Result<Vec<u8>, String> {
        let path = self
            .path_of(id)
            .await
            .ok_or_else(|| format!("unknown recording id: {id}"))?;
        tokio::fs::read(&path)
            .await
            .map_err(|e| format!("read {}: {e}", path.display()))
    }

    pub async fn cleanup(&self, id: &str) {
        let session = self.sessions.lock().await.remove(id);
        if let Some(session) = session {
            if let Some(t) = session.tail_task.lock().await.take() {
                t.abort();
            }
            let _ = tokio::fs::remove_file(&session.path).await;
        }
    }
}

fn spawn_tail_reader(
    path: PathBuf,
    sink: Arc<Mutex<Box<dyn BufferSink>>>,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        // Wait for scsynth to create the file (bundle latency + disk).
        let file = match wait_for_file(&path, Duration::from_secs(5)).await {
            Some(f) => f,
            None => {
                eprintln!("record tail: file never appeared: {}", path.display());
                return;
            }
        };
        if let Err(e) = tail_loop(file, path.clone(), sink).await {
            eprintln!("record tail {}: {e}", path.display());
        }
    })
}

async fn wait_for_file(path: &Path, timeout: Duration) -> Option<File> {
    let start = std::time::Instant::now();
    loop {
        if let Ok(f) = File::open(path).await {
            // Also wait for the WAV header to be flushed.
            if let Ok(meta) = tokio::fs::metadata(path).await {
                if meta.len() >= WAV_HEADER_BYTES {
                    return Some(f);
                }
            }
        }
        if start.elapsed() > timeout {
            return None;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

async fn tail_loop(
    mut file: File,
    path: PathBuf,
    sink: Arc<Mutex<Box<dyn BufferSink>>>,
) -> std::io::Result<()> {
    let mut pos: u64 = WAV_HEADER_BYTES;
    let mut interval = tokio::time::interval(Duration::from_millis(33));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;
        let size = match tokio::fs::metadata(&path).await {
            Ok(m) => m.len(),
            Err(_) => continue,
        };
        if size <= pos {
            continue;
        }
        // Only read a 4-byte-aligned chunk; the next tick will pick up any
        // partial float that wasn't fully written yet.
        let available = size - pos;
        let aligned = available - (available % 4);
        if aligned == 0 {
            continue;
        }
        file.seek(SeekFrom::Start(pos)).await?;
        let mut buf = vec![0u8; aligned as usize];
        file.read_exact(&mut buf).await?;
        let samples: Vec<f32> = buf
            .chunks_exact(4)
            .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect();
        pos += aligned;

        let alive = {
            let mut s = sink.lock().await;
            s.send(&samples)
        };
        if !alive {
            break;
        }
    }
    Ok(())
}

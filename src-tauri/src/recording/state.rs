use crate::ipc::buffer::BufferSink;
use crate::recording::manager;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

/// Standard RIFF/WAVE canonical header size. scsynth writes a 44-byte header
/// for `wav` + `float` format (write it once, patch data size on close).
const WAV_HEADER_BYTES: u64 = 44;

struct Session {
    tail_task: Mutex<Option<JoinHandle<()>>>,
}

/// In-memory registry of active file-tail tasks, keyed by recording id.
/// Persistent state (the WAV files) lives on disk and is managed by
/// `recording::manager`.
pub struct RecordingState {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
}

impl RecordingState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub async fn start_tail(
        &self,
        data_dir: &Path,
        id: &str,
        sink: Box<dyn BufferSink>,
    ) -> Result<(), String> {
        let path = manager::path_for(data_dir, id);
        let session = self
            .sessions
            .lock()
            .await
            .entry(id.to_string())
            .or_insert_with(|| {
                Arc::new(Session {
                    tail_task: Mutex::new(None),
                })
            })
            .clone();
        let mut guard = session.tail_task.lock().await;
        if let Some(t) = guard.take() {
            t.abort();
        }
        *guard = Some(spawn_tail_reader(path, Arc::new(Mutex::new(sink))));
        Ok(())
    }

    pub async fn stop_tail(&self, id: &str) {
        if let Some(session) = self.sessions.lock().await.get(id).cloned() {
            if let Some(t) = session.tail_task.lock().await.take() {
                t.abort();
            }
        }
    }
}

fn spawn_tail_reader(
    path: PathBuf,
    sink: Arc<Mutex<Box<dyn BufferSink>>>,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let file = match wait_for_file(&path, Duration::from_secs(5)).await {
            Some(f) => f,
            None => {
                eprintln!(
                    "record tail: file never appeared after 5s: {}. scsynth and \
                     the sc-app process must share a filesystem.",
                    path.display()
                );
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
        // Read a 4-byte-aligned chunk; the next tick will pick up any partial
        // float that wasn't fully written yet.
        let available = size - pos;
        let aligned_bytes = (available - (available % 4)) as usize;
        if aligned_bytes == 0 {
            continue;
        }
        file.seek(SeekFrom::Start(pos)).await?;
        let mut buf = vec![0u8; aligned_bytes];
        file.read_exact(&mut buf).await?;
        let samples: Vec<f32> = buf
            .chunks_exact(4)
            .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect();
        pos += aligned_bytes as u64;

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

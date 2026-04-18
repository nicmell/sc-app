use crate::config;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Clone)]
pub struct RecordingInfo {
    pub id: String,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Serialize, Clone)]
pub struct RecordingHandle {
    pub id: String,
    pub path: String,
}

fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() < 128
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

pub fn path_for(data_dir: &Path, id: &str) -> PathBuf {
    config::recordings_dir(data_dir).join(format!("{id}.wav"))
}

/// Reserve a fresh recording slot. Generates a unique id + an absolute path
/// under `{data_dir}/recordings/`. The file is NOT created here — scsynth
/// creates it in response to `/b_write`.
pub fn create(data_dir: &Path) -> Result<RecordingHandle, String> {
    let dir = config::recordings_dir(data_dir);
    std::fs::create_dir_all(&dir).map_err(|e| format!("create recordings dir: {e}"))?;

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let id = format!("{nanos:x}-{n:x}");
    let path = path_for(data_dir, &id);
    Ok(RecordingHandle {
        id,
        path: path.to_string_lossy().into_owned(),
    })
}

/// List all recordings on disk.
pub fn list(data_dir: &Path) -> Result<Vec<RecordingInfo>, String> {
    let dir = config::recordings_dir(data_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let entries = std::fs::read_dir(&dir).map_err(|e| format!("read_dir: {e}"))?;
    let mut result = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some(id) = name.strip_suffix(".wav") else { continue };
        if !is_safe_id(id) {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !meta.is_file() {
            continue;
        }
        result.push(RecordingInfo {
            id: id.to_string(),
            path: entry.path().to_string_lossy().into_owned(),
            size_bytes: meta.len(),
        });
    }
    result.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(result)
}

/// Read the raw WAV bytes for an id. 404 if missing.
pub fn read(data_dir: &Path, id: &str) -> Result<Vec<u8>, String> {
    if !is_safe_id(id) {
        return Err("invalid recording id".to_string());
    }
    let path = path_for(data_dir, id);
    std::fs::read(&path).map_err(|e| format!("read {}: {e}", path.display()))
}

/// Remove a recording file from disk. No-op if the file doesn't exist.
pub fn remove(data_dir: &Path, id: &str) -> Result<(), String> {
    if !is_safe_id(id) {
        return Err("invalid recording id".to_string());
    }
    let path = path_for(data_dir, id);
    if !path.exists() {
        return Ok(());
    }
    std::fs::remove_file(&path).map_err(|e| format!("remove {}: {e}", path.display()))
}

//! Shared memory reader for SuperCollider's scope buffers.
//!
//! scsynth creates a Boost.Interprocess managed_shared_memory segment at
//! `/tmp/boost_interprocess/SuperColliderServer_<port>` (8MB on macOS).
//! This is created automatically for any running scsynth — no special flags needed.
//!
//! The segment contains scope buffer data written by ScopeOut2 UGens using a
//! lock-free triple-buffer pattern. This module mmaps the file and reads scope
//! buffer float data directly from mapped memory — zero network, zero serialization.
//!
//! ## Why not shm_open?
//! Boost.Interprocess on macOS uses regular files in /tmp/boost_interprocess/
//! rather than POSIX shared memory (shm_open). We open it as a regular file.

use std::fs::File;
use std::os::unix::io::AsRawFd;
use std::ptr;
use std::sync::{Mutex, OnceLock, atomic::{AtomicUsize, Ordering}};

/// RAII wrapper for a mmap'd file region.
struct MmapRegion {
    ptr: *mut u8,
    size: usize,
}

// Safety: the mmap'd region is read-only and lives for the struct's lifetime.
unsafe impl Send for MmapRegion {}
unsafe impl Sync for MmapRegion {}

impl MmapRegion {
    fn open(path: &str) -> Result<Self, String> {
        let file = File::open(path).map_err(|e| format!("open('{}') failed: {}", path, e))?;
        let size = file.metadata().map_err(|e| e.to_string())?.len() as usize;
        if size == 0 {
            return Err("SHM file is empty".to_string());
        }

        unsafe {
            let ptr = libc::mmap(
                ptr::null_mut(),
                size,
                libc::PROT_READ,
                libc::MAP_SHARED,
                file.as_raw_fd(),
                0,
            );
            if ptr == libc::MAP_FAILED {
                return Err(format!("mmap failed: {}", std::io::Error::last_os_error()));
            }
            Ok(MmapRegion {
                ptr: ptr as *mut u8,
                size,
            })
        }
    }

    fn as_slice(&self) -> &[u8] {
        unsafe { std::slice::from_raw_parts(self.ptr, self.size) }
    }

    fn read_f32_ne(&self, offset: usize) -> Option<f32> {
        if offset + 4 > self.size {
            return None;
        }
        let bytes: [u8; 4] = self.as_slice()[offset..offset + 4].try_into().ok()?;
        Some(f32::from_ne_bytes(bytes))
    }
}

impl Drop for MmapRegion {
    fn drop(&mut self) {
        unsafe {
            libc::munmap(self.ptr as *mut libc::c_void, self.size);
        }
    }
}

/// Cached offset of the scope buffer data within the SHM segment.
static SCOPE_DATA_OFFSET: AtomicUsize = AtomicUsize::new(0);

/// Persistent mmap handle — opened once, reused across reads.
static SHM_REGION: OnceLock<Mutex<Option<(MmapRegion, u16)>>> = OnceLock::new();

fn get_or_open_shm(port: u16) -> Result<std::sync::MutexGuard<'static, Option<(MmapRegion, u16)>>, String> {
    let mutex = SHM_REGION.get_or_init(|| Mutex::new(None));
    let mut guard = mutex.lock().map_err(|e| e.to_string())?;
    if guard.as_ref().map_or(true, |(_, p)| *p != port) {
        let path = format!("/tmp/boost_interprocess/SuperColliderServer_{}", port);
        let region = MmapRegion::open(&path)?;
        *guard = Some((region, port));
        SCOPE_DATA_OFFSET.store(0, Ordering::Relaxed);
    }
    Ok(guard)
}

/// Scan the SHM for the first block of audio-like float data.
fn find_audio_offset(shm: &MmapRegion) -> Option<usize> {
    let mut offset = 0;
    while offset + 32 <= shm.size {
        if let Some(f) = shm.read_f32_ne(offset) {
            if f.is_finite() && f.abs() > 0.01 && f.abs() <= 1.0 {
                let mut count = 0;
                for j in 0..8 {
                    if let Some(v) = shm.read_f32_ne(offset + j * 4) {
                        if v.is_finite() && v.abs() <= 1.0 && v.abs() > 0.001 {
                            count += 1;
                        }
                    }
                }
                if count >= 4 {
                    return Some(offset);
                }
            }
        }
        offset += 4;
    }
    None
}

/// Read scope buffer floats directly from the SHM file.
/// First call: opens mmap + scans for audio data offset. Subsequent calls:
/// just read from the cached mmap + cached offset — effectively a memcpy.
pub fn read_scope(port: u16, max_samples: usize) -> Result<Vec<f32>, String> {
    let guard = get_or_open_shm(port)?;
    let (shm, _) = guard.as_ref().ok_or("SHM not open")?;

    let mut start = SCOPE_DATA_OFFSET.load(Ordering::Relaxed);
    if start == 0 {
        start = find_audio_offset(shm).ok_or("no audio data found in SHM")?;
        SCOPE_DATA_OFFSET.store(start, Ordering::Relaxed);
    }

    let n = max_samples.min((shm.size - start) / 4);
    let bytes = shm.as_slice();
    let mut floats = Vec::with_capacity(n);
    for i in 0..n {
        let off = start + i * 4;
        let val = f32::from_ne_bytes(bytes[off..off + 4].try_into().unwrap());
        floats.push(val);
    }
    Ok(floats)
}

//! Phase 31 — SHM scope buffer reader.
//!
//! scsynth allocates a Boost.Interprocess `managed_shared_memory`
//! segment at startup and writes scope buffer data into it via the
//! `ScopeOut2` UGen. The segment is process-local but mmap-able by
//! any other process on the same machine with the right permissions
//! — that's how the SuperCollider IDE's scope window works.
//!
//! sc-app's bridge uses the same mechanism: tap synths Phase 30+
//! ScopeOut2 into a sclang-allocated scope buffer index; the bridge
//! mmaps the SHM segment and reads slots directly, bypassing the
//! `/b_getn` / `/b_setn` OSC round-trip entirely. See
//! [`plan.md`](../../plan.md) Phase 31 for the full design.
//!
//! ## Cross-platform paths
//!
//! - **macOS**: `/tmp/boost_interprocess/SuperColliderServer_<port>`.
//!   Boost.Interprocess on macOS uses regular files in `/tmp/...`
//!   (not POSIX `shm_open`), so we open it as a normal file and
//!   mmap.
//! - **Linux**: `/dev/shm/SuperColliderServer_<port>` (best guess —
//!   verify on the Pi target before committing). Boost.Interprocess
//!   on Linux uses POSIX `shm_open`, which surfaces the segment as
//!   a file under `/dev/shm/`.
//!
//! ## Layout reference
//!
//! Source-of-truth: SuperCollider's `common/scope_buffer.hpp` and
//! `common/server_shm.hpp` (read at the time of writing this
//! module — relevant excerpts captured below for posterity).
//!
//! **Segment creation** (`server_shared_memory_creator`):
//! - Segment name: `"SuperColliderServer_<port>"` (matches our path).
//! - Segment size: `8192 * 1024` = 8 MB.
//! - Construct order:
//!   1. Allocate `control_busses_` (= `numControlBuses × float`).
//!   2. Allocate `scope_pool` (~4 MB pessimized for 128 scope buffers).
//!   3. Construct named object `server_shared_memory` keyed by the
//!      same `"SuperColliderServer_<port>"` string.
//!   4. Inside that, allocate 128 `scope_buffer` instances, push
//!      `offset_ptr` to each into a `bi::vector<scope_buffer_ptr>`.
//!
//! **`scope_buffer` struct layout** (per `scope_buffer.hpp`):
//! ```cpp
//! class scope_buffer {
//!     atomic<int> _status;        // 4B, status::free=0, status::initialized=1
//!     unsigned int _size;         // 4B, max frames per slot
//!     unsigned int _channels;     // 4B
//!     offset_ptr<float> _data;    // 8B, points at the 3-slot float array
//!
//!     atomic<int> _stage;         // 4B, slot index (0|1|2)
//!     int _in;                    // 4B, slot index (0|1|2)
//!     int _out;                   // 4B, slot index (0|1|2)
//!
//!     struct data_desc {
//!         offset_ptr<float> data;  // 8B, points at one slot
//!         unsigned int frames;     // 4B, frames pushed in this slot
//!         atomic<bool> changed;    // 1B (+padding)
//!     } _state[3];                 // 3 entries
//! };
//! ```
//! Plus alignment padding. Approx ~120 bytes per `scope_buffer`.
//!
//! **Triple-buffer pull protocol** (per `scope_buffer::pull`):
//! ```cpp
//! unsigned int pull() {
//!     int stage = _stage.load(memory_order_relaxed);
//!     bool changed = _state[stage].changed.load(memory_order_relaxed);
//!     if (changed) {
//!         _state[_out].changed.store(false, memory_order_relaxed);
//!         _out = _stage.exchange(_out, memory_order_acquire);
//!     }
//!     return _state[_out].frames;
//! }
//! // After pull, read_address() returns _state[_out].data.
//! ```
//!
//! Note: the SC source uses the `_state[i].changed` *flag* (boolean),
//! not a generation counter. The reader detects "new data available"
//! via the flag, swaps stage↔out, and returns the new frame count.
//! There's no explicit per-write counter visible in `scope_buffer.hpp`.
//!
//! **Implication for gap detection.** The protocol is "did the
//! writer signal a change since I last looked?" — not "how many
//! writes did I miss?". For a 47 Hz reader and 47 Hz writer, this
//! is fine: every poll observes one new slot. But if the reader
//! ever falls behind (writer writes 2 slots between polls), the
//! reader sees `changed = true` once and reads the most-recent
//! slot — implicitly skipping the intermediate one.
//!
//! For sc-app's recording use case this means: **gap detection
//! must run on top of this protocol, not within it.** Either:
//! (a) pair every read with the bridge's tick counter from
//!     `/clock/tick` and detect skipped ticks at the bridge layer,
//!     OR
//! (b) trust that bridge-side polling at tick rate keeps pace
//!     (which it does on healthy systems).
//! Both are tractable; this is a 31c open question, not a 31b
//! blocker.
//!
//! ## Implementation challenge: addressing scope_buffer by index
//!
//! `scope_buffer` instances are allocated through Boost.Interprocess'
//! managed_shared_memory and stored in a `bi::vector<offset_ptr<scope_buffer>>`
//! inside a NAMED OBJECT (`server_shared_memory`). To find a specific
//! buffer by index we need to:
//!
//! 1. Locate the segment manager metadata at the start of the file
//!    (Boost.Interprocess header: magic, version, allocator state,
//!    named-object index).
//! 2. Walk the named-object index to find the entry keyed by
//!    `"SuperColliderServer_<port>"`.
//! 3. Resolve its offset → `server_shared_memory` instance.
//! 4. Read its `scope_buffers` field (a `bi::vector` — its own
//!    layout: pointer + size + capacity, with `offset_ptr<T>`
//!    elements).
//! 5. Read `scope_buffers[idx]` → offset_ptr<scope_buffer> →
//!    resolve to the descriptor.
//! 6. From the descriptor, read the triple-buffer state and resolve
//!    `_state[_out].data` to a slot pointer.
//! 7. Read `_state[_out].frames × _channels` floats from that slot.
//!
//! Boost.Interprocess' segment manager layout is internal but
//! stable across patch versions. Two implementation paths:
//!
//! - **(A) Pure-Rust reader.** Parse Boost's segment-manager
//!   metadata directly. ~1 day of careful work; brittle against
//!   Boost major-version changes; no extra build deps.
//! - **(B) C++ shim via FFI.** Compile a tiny C++ wrapper that
//!   uses `bi::managed_shared_memory(open_only, ...).find<...>()`
//!   directly, exposes a C ABI for Rust. Robust against Boost
//!   version changes (Boost handles its own layout); adds a Boost
//!   + C++ build dependency, painful for the Pi cross-compile.
//!
//! ## Status (31b — in flight)
//!
//! This module currently provides the mmap RAII wrapper + path
//! discovery + a basic byte-read function. The triple-buffer-aware
//! reader and the gap-detecting protocol come in 31b.3 once the
//! implementation choice (A vs B above) is settled.
//!
//! Inspired by commit `b4139ea` from a sibling project that ported
//! a working SHM reader for visualization-grade scope display
//! (using a naive offset-scan, not a proper segment-manager walk).

use std::fs::File;
use std::os::unix::io::AsRawFd;
use std::path::PathBuf;
use std::ptr;

/// RAII wrapper for an mmap'd file region. Opens read-only, shared
/// (so writes by scsynth are visible). Drops munmap the region on
/// scope exit.
pub struct MmapRegion {
    ptr: *mut u8,
    size: usize,
}

// The mmap'd region is read-only and lives for the struct's
// lifetime; safe to share across threads.
unsafe impl Send for MmapRegion {}
unsafe impl Sync for MmapRegion {}

impl MmapRegion {
    /// Open the file at `path` and mmap its full length read-only.
    pub fn open(path: &str) -> Result<Self, String> {
        let file =
            File::open(path).map_err(|e| format!("open('{}') failed: {}", path, e))?;
        let size = file
            .metadata()
            .map_err(|e| format!("stat('{}') failed: {}", path, e))?
            .len() as usize;
        if size == 0 {
            return Err(format!("SHM file '{}' is empty", path));
        }

        // Safety: file is open, fd is valid, size comes from
        // metadata. PROT_READ + MAP_SHARED means writes by scsynth
        // are visible, but our process can't modify.
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
                return Err(format!(
                    "mmap('{}') failed: {}",
                    path,
                    std::io::Error::last_os_error()
                ));
            }
            Ok(MmapRegion {
                ptr: ptr as *mut u8,
                size,
            })
        }
    }

    /// Total mapped size in bytes.
    pub fn size(&self) -> usize {
        self.size
    }

    /// Read-only view of the entire region as bytes.
    pub fn as_slice(&self) -> &[u8] {
        // Safety: ptr + size came from mmap, region is valid for
        // self's lifetime, only read access.
        unsafe { std::slice::from_raw_parts(self.ptr, self.size) }
    }

    /// Read a native-endian f32 at byte offset. Bounds-checked.
    pub fn read_f32_ne(&self, offset: usize) -> Option<f32> {
        if offset + 4 > self.size {
            return None;
        }
        let bytes: [u8; 4] = self.as_slice()[offset..offset + 4].try_into().ok()?;
        Some(f32::from_ne_bytes(bytes))
    }

    /// Read a native-endian i32 at byte offset. Bounds-checked.
    pub fn read_i32_ne(&self, offset: usize) -> Option<i32> {
        if offset + 4 > self.size {
            return None;
        }
        let bytes: [u8; 4] = self.as_slice()[offset..offset + 4].try_into().ok()?;
        Some(i32::from_ne_bytes(bytes))
    }

    /// Read a native-endian u32 at byte offset. Bounds-checked.
    pub fn read_u32_ne(&self, offset: usize) -> Option<u32> {
        if offset + 4 > self.size {
            return None;
        }
        let bytes: [u8; 4] = self.as_slice()[offset..offset + 4].try_into().ok()?;
        Some(u32::from_ne_bytes(bytes))
    }

    /// Read a native-endian i64 at byte offset. Bounds-checked.
    /// Used for `offset_ptr<T>` reads (Boost.Interprocess stores
    /// these as a single intptr_t-sized signed offset).
    pub fn read_i64_ne(&self, offset: usize) -> Option<i64> {
        if offset + 8 > self.size {
            return None;
        }
        let bytes: [u8; 8] = self.as_slice()[offset..offset + 8].try_into().ok()?;
        Some(i64::from_ne_bytes(bytes))
    }
}

impl Drop for MmapRegion {
    fn drop(&mut self) {
        // Safety: ptr + size came from mmap, region is no longer
        // accessed after this.
        unsafe {
            libc::munmap(self.ptr as *mut libc::c_void, self.size);
        }
    }
}

/// Compute the platform-appropriate SHM file path for a given
/// scsynth UDP port. Returns the path even if the file doesn't
/// exist — caller should `MmapRegion::open` to test availability.
pub fn shm_path(port: u16) -> PathBuf {
    let name = format!("SuperColliderServer_{}", port);
    if cfg!(target_os = "macos") {
        // Boost.Interprocess on macOS uses regular files in
        // /tmp/boost_interprocess/.
        PathBuf::from("/tmp/boost_interprocess").join(name)
    } else if cfg!(target_os = "linux") {
        // POSIX shm_open surfaces under /dev/shm/. Best-guess
        // until verified on the Pi target.
        PathBuf::from("/dev/shm").join(name)
    } else {
        // Other Unixes — fall through to /tmp pattern as the most
        // likely default. Will likely need adjustment when/if we
        // target Windows or BSD.
        PathBuf::from("/tmp/boost_interprocess").join(name)
    }
}

/// Probe result returned by `GET /api/scope/probe`. Frontend uses
/// this once at session attach to decide whether the Phase 31 SHM
/// path is usable on this deployment.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProbeResult {
    pub available: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// Test whether the SHM segment for `port` exists and can be
/// mmap'd. Returns the result of an actual mmap attempt — not just
/// a `Path::exists` check, since permission errors only surface on
/// open. Drops the mapping immediately; this is just a probe.
pub fn probe(port: u16) -> ProbeResult {
    let path = shm_path(port);
    let path_str = path.to_string_lossy().into_owned();
    match MmapRegion::open(&path_str) {
        Ok(_region) => ProbeResult {
            available: true,
            path: Some(path_str),
            error: None,
        },
        Err(e) => ProbeResult {
            available: false,
            path: Some(path_str),
            error: Some(e),
        },
    }
}

/// Layout probe result returned by `GET /api/scope/layout`. Used for
/// 31b verification: confirms the heuristic scan finds the expected
/// 128-buffer scope_buffer array and reports the inferred geometry.
/// Subsequent reads (31c+) use the same `find_scope_buffer_array`
/// function internally.
#[derive(Debug, Clone, serde::Serialize)]
pub struct LayoutProbeResult {
    /// True if the SHM segment was openable and the scan ran (even
    /// if the scan itself failed — `error` carries the detail).
    pub mmap_ok: bool,
    /// Resolved SHM file path (always reported, even on failure, so
    /// the user can confirm the platform path discovery picked the
    /// expected one).
    pub path: String,
    /// Total mmap'd segment size in bytes. None if mmap failed.
    pub segment_size: Option<usize>,
    /// Inferred scope_buffer array geometry. None if the scan
    /// failed; `error` describes why.
    pub layout: Option<ScopeBufferLayout>,
    /// Human-readable error for any non-success case (mmap failure,
    /// scan failure, etc.).
    pub error: Option<String>,
}

// ScopeBufferLayout is defined later in this file; add the
// Serialize impl via attribute on its definition.

/// Debug-only diagnostic dump. Lets us see segment layout
/// without round-tripping the binary file out.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DebugDump {
    pub mmap_ok: bool,
    pub path: String,
    pub segment_size: Option<usize>,
    /// All offsets where the `(stage=0, in=1, out=2)` + status=0
    /// scope_buffer signature was found.
    pub match_offsets: Vec<usize>,
    /// Stride counts (top 20).
    pub stride_histogram: Vec<(usize, usize)>,
    /// Per-stride: list of (run_start_offset, run_length) for runs
    /// ≥ 5 matches.
    pub runs_by_stride: Vec<StrideRuns>,
    /// First 256 bytes of the segment, hex-encoded.
    pub head_hex: String,
    /// Last 256 bytes of the segment, hex-encoded. Boost named-object
    /// indexes often live at the END of the segment.
    pub tail_hex: String,
    /// Offsets where the literal name string `SuperColliderServer_<port>`
    /// appears. Used to locate the named-object index entry that
    /// points at `server_shared_memory`.
    pub name_string_offsets: Vec<usize>,
    /// Per name-string occurrence: 64 bytes BEFORE the string and
    /// 64 bytes AFTER the string, hex-encoded. The bytes before
    /// likely contain a length-prefix or pointer-to-string entry
    /// in the index.
    pub name_string_neighborhoods: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct StrideRuns {
    pub stride: usize,
    /// (start_offset, length) per run ≥ 5 elements at this stride.
    pub runs: Vec<(usize, usize)>,
}

pub fn debug_dump(port: u16) -> DebugDump {
    let path = shm_path(port);
    let path_str = path.to_string_lossy().into_owned();
    let region = match MmapRegion::open(&path_str) {
        Ok(r) => r,
        Err(e) => {
            return DebugDump {
                mmap_ok: false,
                path: path_str,
                segment_size: None,
                match_offsets: vec![],
                stride_histogram: vec![],
                runs_by_stride: vec![],
                head_hex: String::new(),
                tail_hex: String::new(),
                name_string_offsets: vec![],
                name_string_neighborhoods: vec![],
                error: Some(e),
            };
        }
    };
    let segment_size = region.size();
    let bytes = region.as_slice();

    let format_hex = |slice: &[u8]| {
        let mut s = String::with_capacity(slice.len() * 3);
        for (i, b) in slice.iter().enumerate() {
            if i > 0 && i % 16 == 0 {
                s.push('\n');
            } else if i > 0 && i % 4 == 0 {
                s.push(' ');
            }
            s.push_str(&format!("{:02x}", b));
        }
        s
    };

    let head_size = 256.min(bytes.len());
    let head_hex = format_hex(&bytes[..head_size]);

    let tail_size = 256.min(bytes.len());
    let tail_hex = format_hex(&bytes[bytes.len() - tail_size..]);

    // Search for the literal name string.
    let name = format!("SuperColliderServer_{}", port);
    let name_bytes = name.as_bytes();
    let mut name_string_offsets: Vec<usize> = Vec::new();
    let mut name_string_neighborhoods: Vec<String> = Vec::new();
    if !name_bytes.is_empty() {
        let mut i = 0;
        while i + name_bytes.len() <= bytes.len() {
            if &bytes[i..i + name_bytes.len()] == name_bytes {
                name_string_offsets.push(i);
                let pre_start = i.saturating_sub(64);
                let post_end = (i + name_bytes.len() + 64).min(bytes.len());
                let mut block = String::new();
                block.push_str(&format!("@offset {}\n", i));
                block.push_str("PRE  ");
                block.push_str(&format_hex(&bytes[pre_start..i]));
                block.push_str("\nNAME ");
                block.push_str(&format_hex(&bytes[i..i + name_bytes.len()]));
                block.push_str("\nPOST ");
                block.push_str(&format_hex(
                    &bytes[i + name_bytes.len()..post_end],
                ));
                name_string_neighborhoods.push(block);
                i += name_bytes.len();
            } else {
                i += 1;
            }
        }
    }

    // Re-run the scan logic but record everything.
    const TRAILER: [u8; 12] = [
        0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00,
    ];
    let mut match_offsets: Vec<usize> = Vec::new();
    let mut i = SB_OFF_STAGE;
    while i + TRAILER.len() <= bytes.len() {
        if bytes[i..i + TRAILER.len()] == TRAILER {
            let prefix_zero =
                bytes[i - SB_OFF_STAGE..i - SB_OFF_STAGE + 12].iter().all(|&b| b == 0);
            if prefix_zero {
                match_offsets.push(i - SB_OFF_STAGE);
            }
        }
        i += 4;
    }

    // Full stride histogram across all consecutive pairs.
    use std::collections::HashMap;
    let mut hist: HashMap<usize, usize> = HashMap::new();
    for w in match_offsets.windows(2) {
        *hist.entry(w[1] - w[0]).or_insert(0) += 1;
    }
    let mut stride_histogram: Vec<(usize, usize)> = hist.into_iter().collect();
    stride_histogram.sort_by(|a, b| b.1.cmp(&a.1));
    stride_histogram.truncate(20); // top 20 strides

    // For each top stride, find all runs ≥ 5.
    let mut runs_by_stride: Vec<StrideRuns> = Vec::new();
    for &(stride, _) in stride_histogram.iter().take(8) {
        let mut runs: Vec<(usize, usize)> = Vec::new();
        let mut start = match_offsets.first().copied().unwrap_or(0);
        let mut len: usize = 1;
        for w in match_offsets.windows(2) {
            if w[1] - w[0] == stride {
                len += 1;
            } else {
                if len >= 5 {
                    runs.push((start, len));
                }
                start = w[1];
                len = 1;
            }
        }
        if len >= 5 {
            runs.push((start, len));
        }
        if !runs.is_empty() {
            runs_by_stride.push(StrideRuns { stride, runs });
        }
    }

    DebugDump {
        mmap_ok: true,
        path: path_str,
        segment_size: Some(segment_size),
        match_offsets,
        stride_histogram,
        runs_by_stride,
        head_hex,
        tail_hex,
        name_string_offsets,
        name_string_neighborhoods,
        error: None,
    }
}

/// One scope_buffer's header fields, as decoded by walking the
/// resolved offset from the vector. Used by `/api/scope/headers`
/// to validate the parser end-to-end without needing ScopeOut2 to
/// be running. For unused buffers all fields should be `(0, 0, 0)`
/// + the `(0,1,2)` stage/in/out trailer.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScopeBufferHeader {
    pub idx: usize,
    pub offset: usize,
    pub status: i32,
    pub size: u32,
    pub channels: u32,
    pub stage: i32,
    pub in_: i32,
    pub out_: i32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct HeadersDump {
    pub count: usize,
    pub headers: Vec<ScopeBufferHeader>,
    pub error: Option<String>,
}

/// Read every scope_buffer's header. Confirms the layout-resolved
/// offsets all point at valid scope_buffer-shaped structures.
pub fn dump_all_headers(port: u16) -> HeadersDump {
    let path = shm_path(port);
    let path_str = path.to_string_lossy().into_owned();
    let region = match MmapRegion::open(&path_str) {
        Ok(r) => r,
        Err(e) => {
            return HeadersDump {
                count: 0,
                headers: vec![],
                error: Some(e),
            };
        }
    };
    let layout = match find_scope_buffer_array(&region) {
        Ok(l) => l,
        Err(e) => {
            return HeadersDump {
                count: 0,
                headers: vec![],
                error: Some(e),
            };
        }
    };
    let mut headers = Vec::with_capacity(layout.count);
    for (idx, &offset) in layout.scope_offsets.iter().enumerate() {
        let status = region.read_i32_ne(offset).unwrap_or(-1);
        let size = region.read_u32_ne(offset + 4).unwrap_or(0);
        let channels = region.read_u32_ne(offset + 8).unwrap_or(0);
        let stage = region.read_i32_ne(offset + SB_OFF_STAGE).unwrap_or(-1);
        let in_ = region.read_i32_ne(offset + SB_OFF_STAGE + 4).unwrap_or(-1);
        let out_ = region.read_i32_ne(offset + SB_OFF_STAGE + 8).unwrap_or(-1);
        headers.push(ScopeBufferHeader {
            idx,
            offset,
            status,
            size,
            channels,
            stage,
            in_,
            out_,
        });
    }
    HeadersDump {
        count: layout.count,
        headers,
        error: None,
    }
}

/// Run the SHM mmap + scope_buffer scan together; return a
/// JSON-friendly diagnostic result. Used by `GET /api/scope/layout`
/// to verify Phase 31b empirically before wiring up scope subscribe
/// protocols.
pub fn probe_layout(port: u16) -> LayoutProbeResult {
    let path = shm_path(port);
    let path_str = path.to_string_lossy().into_owned();
    let region = match MmapRegion::open(&path_str) {
        Ok(r) => r,
        Err(e) => {
            return LayoutProbeResult {
                mmap_ok: false,
                path: path_str,
                segment_size: None,
                layout: None,
                error: Some(e),
            };
        }
    };
    let segment_size = region.size();
    match find_scope_buffer_array(&region) {
        Ok(layout) => LayoutProbeResult {
            mmap_ok: true,
            path: path_str,
            segment_size: Some(segment_size),
            layout: Some(layout),
            error: None,
        },
        Err(e) => LayoutProbeResult {
            mmap_ok: true,
            path: path_str,
            segment_size: Some(segment_size),
            layout: None,
            error: Some(e),
        },
    }
}

// ── scope_buffer layout constants ────────────────────────────────
//
// Tentative offsets within `scope_buffer`, derived from
// `common/scope_buffer.hpp` and natural x86-64 / arm64 alignment.
// May need adjustment if the empirical scan disagrees on a real
// SHM segment — see `find_scope_buffer_array` for the verification
// path. If these change, update the layout doc at the top of this
// module too.

/// Byte offset of `_stage` (atomic<int>) within scope_buffer. Also
/// where the unused-buffer signature trailer starts.
const SB_OFF_STAGE: usize = 24;
/// Byte offset of `_in` within scope_buffer. Documented for layout
/// reference; the read protocol only needs `_stage` for non-mutating
/// reads, so this is currently unused at runtime.
#[allow(dead_code)]
const SB_OFF_IN: usize = 28;
/// Byte offset of `_out` within scope_buffer. Same note as `SB_OFF_IN`.
#[allow(dead_code)]
const SB_OFF_OUT: usize = 32;
/// Byte offset of the `_state[3]` array within scope_buffer.
const SB_OFF_STATE_ARRAY: usize = 40;
/// Size of one `data_desc` entry in `_state`.
const SB_DATA_DESC_SIZE: usize = 16;
/// Within a `data_desc`: byte offset of the `data` offset_ptr.
const DD_OFF_DATA: usize = 0;
/// Within a `data_desc`: byte offset of the `frames` field.
const DD_OFF_FRAMES: usize = 8;

/// scsynth allocates this many scope_buffers at boot (per
/// `server_shm.hpp`, `num_scope_buffers = 128`).
const EXPECTED_SCOPE_BUFFER_COUNT: usize = 128;

// Phase 31 post-shipping: the in-band op-tag wire format that
// originally multiplexed scope chunks onto the main WebSocket
// alongside OSC traffic has been retired in favour of per-scope
// WebSockets at `/ws/scope` (see `server/ws_scope.rs`). The new
// frame layout is documented there. The only wire-format helper
// left in this module is the SHM mmap reader itself; encoders
// and decoders for the op-tag protocol are gone.

/// Boost.Interprocess `offset_ptr<T>` "null" sentinel. Per Boost
/// convention, an offset of 1 means null (offset of 0 would mean
/// "point to self", which is also useless).
const OFFSET_PTR_NULL: i64 = 1;

/// Result of locating the scope_buffer pointer-vector in the SHM
/// segment. Phase 31b: Boost.Interprocess' allocator scatters the
/// 128 scope_buffer instances throughout the segment (not contiguous
/// — they're individually `segment.allocate(sizeof(scope_buffer))`'d
/// in a for-loop and may end up at different offsets). The
/// `bi::vector<offset_ptr<scope_buffer>>` inside `server_shared_memory`
/// is the canonical index → SHM offset map; we find that vector and
/// resolve each entry separately.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScopeBufferLayout {
    /// Byte offset of the offset_ptr-vector's data in the segment.
    /// 128 consecutive 8-byte offset_ptr<scope_buffer> values starting
    /// here.
    pub vector_data_offset: usize,
    /// Number of offset_ptrs in the vector (should be 128).
    pub count: usize,
    /// Resolved byte offsets of each scope_buffer in the segment,
    /// indexed by vector position. `scope_offsets[N]` is the byte
    /// offset of scope_buffer index N.
    pub scope_offsets: Vec<usize>,
}

/// Locate the `bi::vector<offset_ptr<scope_buffer>>` data array
/// inside the SHM segment.
///
/// Boost's TLSF allocator scatters the 128 individually-allocated
/// scope_buffer instances throughout the segment, so we can't find
/// them by stride. The vector itself, however, is contiguous: 128
/// consecutive 8-byte `offset_ptr<scope_buffer>` values, each
/// pointing at one of those scattered scope_buffer instances.
/// That vector IS the index → SHM offset map.
///
/// Algorithm:
/// 1. First, find every "scope_buffer-shaped" structure in the
///    segment (status ∈ {0, 1}, plus stage/in/out all in [0,2]
///    and distinct). This gets every scope_buffer regardless of
///    its current state, no stride assumption.
/// 2. Convert that set into a HashSet for O(1) "is X a scope_buffer?"
///    lookups.
/// 3. Scan the segment 8 bytes at a time, treating each i64 value
///    as a candidate `offset_ptr` (offset = field_position +
///    raw_value). Test if the resolved target hits a known
///    scope_buffer location.
/// 4. Look for runs of 128 consecutive successful resolutions —
///    that's the vector data.
pub fn find_scope_buffer_array(region: &MmapRegion) -> Result<ScopeBufferLayout, String> {
    let bytes = region.as_slice();

    // Step 1: find every scope_buffer-shaped structure.
    let scope_buffer_offsets = find_scope_buffer_candidates(bytes);
    if scope_buffer_offsets.is_empty() {
        return Err("no scope_buffer-shaped structures found".to_string());
    }

    use std::collections::HashSet;
    let scope_set: HashSet<usize> = scope_buffer_offsets.iter().copied().collect();

    // Step 2: scan for runs of consecutive 8-byte offset_ptrs that
    // each resolve to a known scope_buffer offset. Two passes:
    // first, mark each 8-byte slot as "valid offset_ptr" or not;
    // then find the longest run of valid slots.
    let n_slots = bytes.len() / 8;
    let mut valid: Vec<bool> = vec![false; n_slots];
    for slot in 0..n_slots {
        let off = slot * 8;
        let raw = i64::from_ne_bytes(
            bytes[off..off + 8].try_into().unwrap_or([0; 8]),
        );
        // offset_ptr semantics: target_offset = field_offset + raw
        // (with raw == 1 meaning null). raw == 0 means "point to
        // self" (also useless for our purpose).
        if raw == 0 || raw == OFFSET_PTR_NULL {
            continue;
        }
        let Some(target) = (off as i64).checked_add(raw) else {
            continue;
        };
        if target < 0 || (target as usize) >= bytes.len() {
            continue;
        }
        if scope_set.contains(&(target as usize)) {
            valid[slot] = true;
        }
    }

    // Step 3: longest run of consecutive valid slots.
    let mut best_run_start: Option<usize> = None;
    let mut best_run_len: usize = 0;
    let mut current_start: usize = 0;
    let mut current_len: usize = 0;
    for (i, &v) in valid.iter().enumerate() {
        if v {
            if current_len == 0 {
                current_start = i;
            }
            current_len += 1;
        } else if current_len > 0 {
            if current_len > best_run_len {
                best_run_len = current_len;
                best_run_start = Some(current_start);
            }
            current_len = 0;
        }
    }
    if current_len > best_run_len {
        best_run_len = current_len;
        best_run_start = Some(current_start);
    }

    let run_slot = best_run_start.ok_or_else(|| {
        "no run of valid offset_ptrs found".to_string()
    })?;
    if best_run_len < EXPECTED_SCOPE_BUFFER_COUNT {
        return Err(format!(
            "longest offset_ptr run was {} (expected ≥{}); \
             found {} scope_buffer candidates total",
            best_run_len,
            EXPECTED_SCOPE_BUFFER_COUNT,
            scope_buffer_offsets.len()
        ));
    }

    // Step 4: resolve all 128 entries to absolute offsets.
    let vector_data_offset = run_slot * 8;
    let mut scope_offsets = Vec::with_capacity(EXPECTED_SCOPE_BUFFER_COUNT);
    for i in 0..EXPECTED_SCOPE_BUFFER_COUNT {
        let off = vector_data_offset + i * 8;
        let raw = i64::from_ne_bytes(bytes[off..off + 8].try_into().unwrap());
        let target = (off as i64 + raw) as usize;
        scope_offsets.push(target);
    }

    Ok(ScopeBufferLayout {
        vector_data_offset,
        count: EXPECTED_SCOPE_BUFFER_COUNT,
        scope_offsets,
    })
}

/// Find every scope_buffer-shaped structure in the segment.
///
/// Signature: at offsets `i+24, i+28, i+32` we have three int32
/// values that are: (a) all in [0, 2], (b) all distinct (so the
/// triple is a permutation of {0, 1, 2}). Plus `_status` at offset
/// `i` is in {0, 1}. This catches both unused and in-use
/// scope_buffers, regardless of which slot is currently `_stage`.
fn find_scope_buffer_candidates(bytes: &[u8]) -> Vec<usize> {
    let mut out = Vec::new();
    if bytes.len() < SB_OFF_STAGE + 12 {
        return out;
    }
    let max = bytes.len() - 12;
    let mut i = 0;
    while i <= max && i.checked_add(SB_OFF_STAGE + 12).map_or(false, |e| e <= bytes.len()) {
        // _status check
        let status = i32::from_ne_bytes(bytes[i..i + 4].try_into().unwrap());
        if status != 0 && status != 1 {
            i += 4;
            continue;
        }
        // _stage, _in, _out: each in [0,2], all distinct
        let stage = i32::from_ne_bytes(
            bytes[i + SB_OFF_STAGE..i + SB_OFF_STAGE + 4].try_into().unwrap(),
        );
        let in_ = i32::from_ne_bytes(
            bytes[i + SB_OFF_STAGE + 4..i + SB_OFF_STAGE + 8].try_into().unwrap(),
        );
        let out_ = i32::from_ne_bytes(
            bytes[i + SB_OFF_STAGE + 8..i + SB_OFF_STAGE + 12].try_into().unwrap(),
        );
        if (0..=2).contains(&stage)
            && (0..=2).contains(&in_)
            && (0..=2).contains(&out_)
            && stage != in_
            && in_ != out_
            && stage != out_
        {
            out.push(i);
        }
        i += 4;
    }
    out
}

/// Result of `read_scope_slot`. The bridge dispatches each variant
/// differently when fanning frames over the WS.
#[derive(Debug)]
pub enum ScopeReadResult {
    /// scope_buffer at this index hasn't been initialized by a
    /// running ScopeOut2 — `_status` is `free` or fields are
    /// zero. Caller should ignore until the writer wakes up.
    NotInitialized,
    /// scope_buffer is initialized but no slot has been pushed
    /// yet (offset_ptr<float> _state[stage].data is null).
    NoData,
    /// Successful read of one slot.
    Data {
        /// Interleaved float samples: `frames × channels` total.
        floats: Vec<f32>,
        channels: usize,
        frames: usize,
        /// Index of the slot we read (`_stage` value at read time).
        /// Caller can compare against the previous read's stage to
        /// detect "no new slot since last poll" externally.
        stage: usize,
    },
}

/// Read the most-recently-completed slot of `scope_buffer[scope_idx]`
/// using a non-mutating, read-only protocol. We sample `_stage`,
/// resolve `_state[stage].data` via offset_ptr math, copy the
/// floats out, and return.
///
/// **Tearing window.** The writer can swap `_stage` between our
/// reads; we don't re-check after copying. For 47 Hz reader vs
/// 47 Hz writer with sub-millisecond reads, tearing is rare. If
/// it becomes a problem, the fix is a re-check-after-copy with
/// retry — see `pull()` in `scope_buffer.hpp` for the canonical
/// lock-free protocol.
///
/// **Gap detection** is not done in this function. The bridge
/// layer detects "missed slots" by comparing tick deltas against
/// the per-subscription expected cadence — see Phase 31c.
pub fn read_scope_slot(
    region: &MmapRegion,
    layout: &ScopeBufferLayout,
    scope_idx: usize,
) -> Result<ScopeReadResult, String> {
    if scope_idx >= layout.count {
        return Err(format!(
            "scope_idx {} out of range (count {})",
            scope_idx, layout.count
        ));
    }

    // Phase 31b: Boost scatters scope_buffers throughout the
    // segment, so we look up the resolved offset from the vector.
    let buf_offset = layout.scope_offsets[scope_idx];

    // Read scope_buffer header.
    let status = region
        .read_i32_ne(buf_offset)
        .ok_or_else(|| "scope_buffer status field OOB".to_string())?;
    if status != 1 {
        return Ok(ScopeReadResult::NotInitialized);
    }
    let size = region
        .read_u32_ne(buf_offset + 4)
        .ok_or_else(|| "scope_buffer size field OOB".to_string())? as usize;
    let channels = region
        .read_u32_ne(buf_offset + 8)
        .ok_or_else(|| "scope_buffer channels field OOB".to_string())? as usize;
    if channels == 0 || size == 0 {
        return Ok(ScopeReadResult::NotInitialized);
    }

    // Read _stage (which slot index has the most-recently-completed data).
    let stage = region
        .read_i32_ne(buf_offset + SB_OFF_STAGE)
        .ok_or_else(|| "scope_buffer _stage field OOB".to_string())?;
    if !(0..=2).contains(&stage) {
        return Err(format!(
            "scope_buffer[{}] _stage out of range: {}",
            scope_idx, stage
        ));
    }
    let stage = stage as usize;

    // Read _state[stage]: data offset_ptr + frames count.
    let state_offset = buf_offset + SB_OFF_STATE_ARRAY + stage * SB_DATA_DESC_SIZE;
    let data_field_offset = state_offset + DD_OFF_DATA;
    let raw_offset_ptr = region
        .read_i64_ne(data_field_offset)
        .ok_or_else(|| "scope_buffer _state[stage].data field OOB".to_string())?;
    if raw_offset_ptr == OFFSET_PTR_NULL || raw_offset_ptr == 0 {
        return Ok(ScopeReadResult::NoData);
    }
    let data_byte_offset = (data_field_offset as i64 + raw_offset_ptr) as usize;

    let frames = region
        .read_u32_ne(state_offset + DD_OFF_FRAMES)
        .ok_or_else(|| "scope_buffer _state[stage].frames field OOB".to_string())?
        as usize;
    if frames == 0 || frames > size {
        return Ok(ScopeReadResult::NoData);
    }

    // Read the slot data: frames × channels interleaved float32s.
    let total_floats = frames.checked_mul(channels).ok_or_else(|| {
        format!(
            "scope_buffer[{}] frames*channels overflow: {} * {}",
            scope_idx, frames, channels
        )
    })?;
    let total_bytes = total_floats.checked_mul(4).ok_or_else(|| {
        "scope_buffer total byte count overflow".to_string()
    })?;
    if data_byte_offset + total_bytes > region.size() {
        return Err(format!(
            "scope_buffer[{}] slot data OOB: offset {} + {} bytes > segment size {}",
            scope_idx,
            data_byte_offset,
            total_bytes,
            region.size()
        ));
    }

    let mut floats = Vec::with_capacity(total_floats);
    for i in 0..total_floats {
        let f = region
            .read_f32_ne(data_byte_offset + i * 4)
            .ok_or_else(|| "scope_buffer slot data read OOB".to_string())?;
        floats.push(f);
    }

    Ok(ScopeReadResult::Data {
        floats,
        channels,
        frames,
        stage,
    })
}

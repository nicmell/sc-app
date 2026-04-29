//! Phase 23 — `POST /api/logs` ingest.
//!
//! Frontend ships log entries as NDJSON (one JSON object per line)
//! to this endpoint; we parse each line and re-emit as a `tracing`
//! event at the matching level. The tracing subscriber routes them
//! to stderr + (when `--log-dir` was given) the daily-rotated file.
//!
//! Wire format (matches `src/util/logShipper.ts`):
//!
//!   {"timestamp": <ms-since-epoch>, "level": "log|info|warn|error",
//!    "message": "...", "source": "frontend"}
//!
//! Bad lines are skipped (don't fail the whole batch on a single
//! malformed entry — frontend may have shipped partially-corrupted
//! NDJSON if it crashed mid-write). Body size is capped by axum's
//! `DefaultBodyLimit` middleware applied at the route registration
//! site in `mod.rs`.

use axum::http::StatusCode;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct FrontendLogEntry {
    /// ms since epoch (Date.now() on the frontend).
    #[serde(default)]
    timestamp: Option<u64>,
    level: String,
    message: String,
    /// Optional context flag — typically `"frontend"`. Not currently
    /// load-bearing; included so consumers grepping the file can
    /// distinguish frontend events from bridge events without
    /// inferring from the level.
    #[serde(default)]
    #[allow(dead_code)]
    source: Option<String>,
}

/// `POST /api/logs` handler. Accepts a UTF-8 body of NDJSON lines.
/// Returns 204 on success (empty body), 400 only if the body itself
/// is non-UTF-8 — individual malformed lines are silently skipped.
pub async fn logs_handler(body: String) -> StatusCode {
    let mut accepted = 0usize;
    let mut dropped = 0usize;

    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        match serde_json::from_str::<FrontendLogEntry>(line) {
            Ok(entry) => {
                emit_tracing(entry);
                accepted += 1;
            }
            Err(_) => {
                dropped += 1;
            }
        }
    }

    if dropped > 0 {
        tracing::warn!(
            target: "frontend",
            "log ingest dropped {dropped} malformed entries (accepted {accepted})"
        );
    }

    StatusCode::NO_CONTENT
}

/// Re-emit a frontend entry as a tracing event at the matching
/// level. The `target = "frontend"` field lets file-side filters
/// distinguish frontend events from bridge events at grep time.
fn emit_tracing(entry: FrontendLogEntry) {
    let ts = entry.timestamp.unwrap_or(0);
    match entry.level.as_str() {
        "error" => {
            tracing::error!(target: "frontend", ts_ms = ts, "{}", entry.message);
        }
        "warn" => {
            tracing::warn!(target: "frontend", ts_ms = ts, "{}", entry.message);
        }
        "info" => {
            tracing::info!(target: "frontend", ts_ms = ts, "{}", entry.message);
        }
        // Treat unknown / "log" / anything else as debug-level so it
        // still lands in the file but doesn't clutter stderr unless
        // RUST_LOG explicitly opts in.
        _ => {
            tracing::debug!(target: "frontend", ts_ms = ts, "{}", entry.message);
        }
    }
}

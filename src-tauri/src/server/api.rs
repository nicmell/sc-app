//! HTTP API for bridge-managed sessions.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use super::session::{session_info, Session};
use super::AppState;
use crate::scope::shm as scope_shm;

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

fn error_response(status: StatusCode, message: impl Into<String>) -> Response {
    (
        status,
        Json(ErrorBody {
            error: message.into(),
        }),
    )
        .into_response()
}

/// `POST /api/session` — mint a new session. Phase 39a: pure
/// bookkeeping (no UDP). Returns 503 if the bridge isn't yet
/// fully bootstrapped (e.g. scsynth handshake hasn't completed —
/// shouldn't happen post-`serve_on`, but defensive).
pub async fn post_session(State(state): State<AppState>) -> Response {
    let session = match Session::create(
        &state.sub_client_id_allocator,
        &state.scsynth_server,
        state.force_osc_mode,
    )
    .await
    {
        Ok(s) => Arc::new(s),
        Err(e) => {
            tracing::warn!(error = ?e, "POST /api/session failed");
            return error_response(StatusCode::SERVICE_UNAVAILABLE, format!("{:#}", e));
        }
    };
    let info = match session_info(
        &session,
        &state.scsynth_server,
        state.sclang_server.as_ref(),
    )
    .await
    {
        Ok(info) => info,
        Err(e) => {
            tracing::error!(error = ?e, "session_info failed");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("{:#}", e));
        }
    };
    state.sessions.insert(session).await;
    (StatusCode::CREATED, Json(info)).into_response()
}

/// `GET /api/session/:id` — read an existing session. Touches
/// `last_active` as a side effect so an idle frontend hitting
/// this on a timer counts as a TTL keep-alive.
pub async fn get_session(State(state): State<AppState>, Path(id): Path<Uuid>) -> Response {
    let Some(session) = state.sessions.get_and_touch(&id).await else {
        return error_response(
            StatusCode::NOT_FOUND,
            format!("session {id} not found (expired or never existed)"),
        );
    };
    match session_info(
        &session,
        &state.scsynth_server,
        state.sclang_server.as_ref(),
    )
    .await
    {
        Ok(info) => Json(info).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("{:#}", e)),
    }
}

/// `DELETE /api/session/:id` — run the cleanup bundle and remove
/// the session from the store.
pub async fn delete_session(State(state): State<AppState>, Path(id): Path<Uuid>) -> Response {
    let Some(session) = state.sessions.remove(&id).await else {
        return error_response(StatusCode::NOT_FOUND, format!("session {id} not found"));
    };
    session
        .cleanup(&state.scsynth_server, &state.sub_client_id_allocator)
        .await;
    match session_info(
        &session,
        &state.scsynth_server,
        state.sclang_server.as_ref(),
    )
    .await
    {
        Ok(info) => Json(info).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("{:#}", e)),
    }
}

/// `GET /api/scope/probe` — Phase 31/36/39: report SHM
/// availability + chosen mode. Reads scsynth port from the
/// shared scsynth Server.
pub async fn get_scope_probe(State(state): State<AppState>) -> Response {
    let port = state.scsynth_server.target().port();
    let probe = scope_shm::probe(port);
    let mode = if state.force_osc_mode || !probe.available {
        "osc"
    } else {
        "shm"
    };
    Json(serde_json::json!({
        "available": probe.available,
        "path": probe.path,
        "error": probe.error,
        "mode": mode,
    }))
    .into_response()
}

/// `GET /api/scope/layout` — Phase 31b verification.
pub async fn get_scope_layout(State(state): State<AppState>) -> Response {
    let port = state.scsynth_server.target().port();
    let result = scope_shm::probe_layout(port);
    Json(result).into_response()
}

/// `GET /api/scope/debug` — Phase 31b diagnostic dump.
pub async fn get_scope_debug(State(state): State<AppState>) -> Response {
    let port = state.scsynth_server.target().port();
    let result = scope_shm::debug_dump(port);
    Json(result).into_response()
}

/// `GET /api/scope/headers` — Phase 31b: every scope_buffer's
/// header fields after layout resolution.
pub async fn get_scope_headers(State(state): State<AppState>) -> Response {
    let port = state.scsynth_server.target().port();
    let result = scope_shm::dump_all_headers(port);
    Json(result).into_response()
}

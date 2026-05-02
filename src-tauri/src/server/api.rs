//! Phase 29 — HTTP API for bridge-managed sessions.
//!
//! Three endpoints:
//! - `POST /api/session` — mint a new session (opens UDP sockets,
//!   runs `/notify 1` + `/status` round-trips on scsynth, returns
//!   the captured handshake values).
//! - `GET  /api/session/:id` — read-back. 404 if not found.
//! - `DELETE /api/session/:id` — explicit teardown. Frontend
//!   "Reset session" button uses this; otherwise the future TTL
//!   task (29d) cleans up idle sessions.
//!
//! Request shape: empty body for POST. ID-as-path-param for GET
//! and DELETE. Response shape: see [`super::session::SessionInfo`].
//!
//! Errors render as `{ "error": "...message..." }` with an
//! appropriate HTTP status. The frontend's recovery surface (the
//! ConnectScreen, after Phase 29c) uses the message verbatim.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use super::session::{Session, SessionInfo};
use super::AppState;

/// JSON error envelope. One field, one shape — the frontend
/// reads `error` and renders it inline.
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

/// `POST /api/session` — create a new session and return its
/// info. Body is ignored (reserved for future fields like a
/// returning client_id hint).
pub async fn post_session(State(state): State<AppState>) -> Response {
    let session = match Session::create(state.routes.clone()).await {
        Ok(s) => Arc::new(s),
        Err(e) => {
            tracing::warn!(error = ?e, "POST /api/session failed");
            // 503 — the bridge is up but scsynth (its dependency)
            // didn't reply. Frontend treats this as a recoverable
            // "Try again" error. `{:#}` flattens the anyhow chain
            // into a one-line message including each `.context()`,
            // so the user sees "couldn't reach scsynth at X:
            // <root cause>" instead of just the topmost context.
            return error_response(
                StatusCode::SERVICE_UNAVAILABLE,
                format!("{:#}", e),
            );
        }
    };
    let info = session.info();
    state.sessions.insert(session).await;
    (StatusCode::CREATED, Json(info)).into_response()
}

/// `GET /api/session/:id` — read an existing session. Touches
/// `last_active` as a side effect so an idle frontend hitting
/// this on a timer counts as a TTL keep-alive.
pub async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Response {
    match state.sessions.get_and_touch(&id).await {
        Some(session) => Json(session.info()).into_response(),
        None => error_response(
            StatusCode::NOT_FOUND,
            format!("session {id} not found (expired or never existed)"),
        ),
    }
}

/// `DELETE /api/session/:id` — run the cleanup bundle and remove
/// the session from the store. Returns the freshly-cleaned-up
/// info on success (so callers can confirm what was torn down).
/// 404 on unknown id.
pub async fn delete_session(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Response {
    let Some(session) = state.sessions.remove(&id).await else {
        return error_response(
            StatusCode::NOT_FOUND,
            format!("session {id} not found"),
        );
    };
    session.cleanup().await;
    let info: SessionInfo = session.info();
    Json(info).into_response()
}

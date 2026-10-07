//! `/focus-sessions`: one handler per use case.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch};
use axum::{Json, Router};
use cero_core::{FocusSession, FocusSessionsService, PauseFocusSession, StartFocusSession};
use serde_json::json;

use crate::http::{ApiError, JsonBody};

/// The `/focus-sessions` routes, with the one service they need as their state.
pub fn routes(focus_sessions: FocusSessionsService) -> Router {
    Router::new()
        .route("/", get(list_sessions).post(start_session))
        .route("/active", get(get_current_session))
        .route("/finish", patch(finish_current_session))
        .route("/pause", patch(pause_current_session))
        .route("/resume", patch(resume_current_session))
        .route("/{id}/finish", patch(finish_session))
        .route("/{id}/pause", patch(pause_session))
        .route("/{id}/resume", patch(resume_session))
        .with_state(focus_sessions)
}

async fn list_sessions(
    State(focus_sessions): State<FocusSessionsService>,
) -> Result<Json<Vec<FocusSession>>, ApiError> {
    Ok(Json(focus_sessions.list().await?))
}

async fn get_current_session(
    State(focus_sessions): State<FocusSessionsService>,
) -> Result<Response, ApiError> {
    // The contract answers an empty object, not null, when no session is current.
    Ok(match focus_sessions.get_current().await? {
        Some(session) => Json(session).into_response(),
        None => Json(json!({})).into_response(),
    })
}

async fn start_session(
    State(focus_sessions): State<FocusSessionsService>,
    body: Option<JsonBody<StartFocusSession>>,
) -> Result<(StatusCode, Json<FocusSession>), ApiError> {
    let request = body.map(|JsonBody(request)| request).unwrap_or_default();
    Ok((
        StatusCode::CREATED,
        Json(focus_sessions.start(request).await?),
    ))
}

async fn finish_current_session(
    State(focus_sessions): State<FocusSessionsService>,
) -> Result<Json<FocusSession>, ApiError> {
    Ok(Json(focus_sessions.finish_current().await?))
}

async fn pause_current_session(
    State(focus_sessions): State<FocusSessionsService>,
    body: Option<JsonBody<PauseFocusSession>>,
) -> Result<Json<FocusSession>, ApiError> {
    let request = body.map(|JsonBody(request)| request).unwrap_or_default();
    Ok(Json(focus_sessions.pause_current(request).await?))
}

async fn resume_current_session(
    State(focus_sessions): State<FocusSessionsService>,
) -> Result<Json<FocusSession>, ApiError> {
    Ok(Json(focus_sessions.resume_current().await?))
}

async fn finish_session(
    State(focus_sessions): State<FocusSessionsService>,
    Path(id): Path<String>,
) -> Result<Json<FocusSession>, ApiError> {
    Ok(Json(focus_sessions.finish(&id).await?))
}

async fn pause_session(
    State(focus_sessions): State<FocusSessionsService>,
    Path(id): Path<String>,
) -> Result<Json<FocusSession>, ApiError> {
    Ok(Json(focus_sessions.pause(&id).await?))
}

async fn resume_session(
    State(focus_sessions): State<FocusSessionsService>,
    Path(id): Path<String>,
) -> Result<Json<FocusSession>, ApiError> {
    Ok(Json(focus_sessions.resume(&id).await?))
}

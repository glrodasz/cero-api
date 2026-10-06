//! `/focus-sessions`: one handler per use case.

use actix_web::{HttpResponse, web};
use cero_core::{FocusSessionsService, PauseFocusSession, StartFocusSession};
use serde_json::json;

use crate::http::{ApiError, OptionalJson};

/// Registers the `/focus-sessions` routes. The service comes from the app data (`web::Data`).
pub fn routes(config: &mut web::ServiceConfig) {
    config
        .route("", web::get().to(list_sessions))
        .route("", web::post().to(start_session))
        .route("/active", web::get().to(get_current_session))
        .route("/finish", web::patch().to(finish_current_session))
        .route("/pause", web::patch().to(pause_current_session))
        .route("/resume", web::patch().to(resume_current_session))
        .route("/{id}/finish", web::patch().to(finish_session))
        .route("/{id}/pause", web::patch().to(pause_session))
        .route("/{id}/resume", web::patch().to(resume_session));
}

async fn list_sessions(
    focus_sessions: web::Data<FocusSessionsService>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(focus_sessions.list().await?))
}

async fn get_current_session(
    focus_sessions: web::Data<FocusSessionsService>,
) -> Result<HttpResponse, ApiError> {
    // The contract answers an empty object, not null, when no session is current.
    Ok(match focus_sessions.get_current().await? {
        Some(session) => HttpResponse::Ok().json(session),
        None => HttpResponse::Ok().json(json!({})),
    })
}

async fn start_session(
    focus_sessions: web::Data<FocusSessionsService>,
    OptionalJson(request): OptionalJson<StartFocusSession>,
) -> Result<HttpResponse, ApiError> {
    let session = focus_sessions.start(request.unwrap_or_default()).await?;
    Ok(HttpResponse::Created().json(session))
}

async fn finish_current_session(
    focus_sessions: web::Data<FocusSessionsService>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(focus_sessions.finish_current().await?))
}

async fn pause_current_session(
    focus_sessions: web::Data<FocusSessionsService>,
    OptionalJson(request): OptionalJson<PauseFocusSession>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(
        focus_sessions
            .pause_current(request.unwrap_or_default())
            .await?,
    ))
}

async fn resume_current_session(
    focus_sessions: web::Data<FocusSessionsService>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(focus_sessions.resume_current().await?))
}

async fn finish_session(
    focus_sessions: web::Data<FocusSessionsService>,
    id: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(focus_sessions.finish(&id).await?))
}

async fn pause_session(
    focus_sessions: web::Data<FocusSessionsService>,
    id: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(focus_sessions.pause(&id).await?))
}

async fn resume_session(
    focus_sessions: web::Data<FocusSessionsService>,
    id: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
    Ok(HttpResponse::Ok().json(focus_sessions.resume(&id).await?))
}

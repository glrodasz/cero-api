use actix_web::http::StatusCode;
use actix_web::{HttpResponse, ResponseError};
use cero_core::{CoreError, messages};
use serde_json::json;

/// What a handler fails with: a core error, answered as `{ "message": ... }`.
///
/// A newtype, because the orphan rule forbids implementing Actix's
/// `ResponseError` for `CoreError` here: both are foreign to this crate.
/// With `From<CoreError>`, handlers can still use `?` on any use case.
#[derive(Debug, thiserror::Error)]
#[error(transparent)]
pub struct ApiError(#[from] CoreError);

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        match self.0 {
            CoreError::NotFound(_) => StatusCode::NOT_FOUND,
            CoreError::Invalid(_) => StatusCode::BAD_REQUEST,
            CoreError::Repository(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let message = match &self.0 {
            CoreError::NotFound(message) => message,
            CoreError::Invalid(message) => message.as_str(),
            CoreError::Repository(error) => {
                // The details go to the logs; the client only learns that something broke.
                tracing::error!(%error, "unexpected failure");
                messages::INTERNAL_ERROR
            }
        };
        HttpResponse::build(self.status_code()).json(json!({ "message": message }))
    }
}

/// Unknown routes, and known routes called with the wrong method, answer like any other 404.
pub async fn route_not_found() -> HttpResponse {
    ApiError(CoreError::NotFound(messages::ROUTE_NOT_FOUND)).error_response()
}

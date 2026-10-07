use axum::Json;
use axum::extract::rejection::JsonRejection;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use cero_core::{CoreError, messages};
use serde_json::json;

/// What a handler fails with: a core error, answered as `{ "message": ... }`.
///
/// A newtype, because the orphan rule forbids implementing Axum's
/// `IntoResponse` for `CoreError` here: both are foreign to this crate.
/// With `From<CoreError>`, handlers can still use `?` on any use case.
#[derive(Debug)]
pub struct ApiError(CoreError);

impl From<CoreError> for ApiError {
    fn from(error: CoreError) -> Self {
        Self(error)
    }
}

/// A body that is not JSON, does not parse, or has the wrong shape is the client's fault: 400.
impl From<JsonRejection> for ApiError {
    fn from(rejection: JsonRejection) -> Self {
        Self(CoreError::Invalid(rejection.body_text()))
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self.0 {
            CoreError::NotFound(message) => (StatusCode::NOT_FOUND, message.to_owned()),
            CoreError::Invalid(message) => (StatusCode::BAD_REQUEST, message),
            CoreError::Repository(error) => {
                // The details go to the logs; the client only learns that something broke.
                tracing::error!(%error, "unexpected failure");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    messages::INTERNAL_ERROR.to_owned(),
                )
            }
        };
        (status, Json(json!({ "message": message }))).into_response()
    }
}

/// Unknown routes, and known routes called with the wrong method, answer like any other 404.
pub async fn route_not_found() -> ApiError {
    ApiError(CoreError::NotFound(messages::ROUTE_NOT_FOUND))
}

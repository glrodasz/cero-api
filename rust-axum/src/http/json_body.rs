use axum::extract::{FromRequest, OptionalFromRequest, Request};
use serde::de::DeserializeOwned;

use super::ApiError;

/// `axum::Json` as a request extractor, with its rejections (not JSON, does
/// not parse, wrong shape) turned into the API's 400 `{ "message" }`.
///
/// Take `Option<JsonBody<T>>` for a body that clients may leave out: a request
/// without a `Content-Type` has no body and gives `None`, while a body that is
/// sent must still be valid.
pub struct JsonBody<T>(pub T);

impl<T, S> FromRequest<S> for JsonBody<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        let axum::Json(value) =
            <axum::Json<T> as FromRequest<S>>::from_request(request, state).await?;
        Ok(Self(value))
    }
}

impl<T, S> OptionalFromRequest<S> for JsonBody<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Option<Self>, Self::Rejection> {
        let body = <axum::Json<T> as OptionalFromRequest<S>>::from_request(request, state).await?;
        Ok(body.map(|axum::Json(value)| Self(value)))
    }
}

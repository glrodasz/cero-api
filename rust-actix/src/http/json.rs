use std::future::{Future, ready};
use std::pin::Pin;

use actix_web::dev::Payload;
use actix_web::error::JsonPayloadError;
use actix_web::http::header;
use actix_web::{FromRequest, HttpRequest, web};
use cero_core::CoreError;
use serde::de::DeserializeOwned;

use super::ApiError;

/// Makes `web::Json` answer the API's 400 `{ "message" }` when a body is not
/// JSON, does not parse, or has the wrong shape.
pub fn json_config() -> web::JsonConfig {
    web::JsonConfig::default().error_handler(|error, _request| ApiError::from(error).into())
}

impl From<JsonPayloadError> for ApiError {
    fn from(error: JsonPayloadError) -> Self {
        CoreError::Invalid(error.to_string()).into()
    }
}

/// A JSON body that clients may leave out. A request without a `Content-Type`
/// has no body and gives `None`; a body that is sent must be valid, exactly as
/// with `web::Json`.
///
/// `Option<web::Json<T>>` would not do: Actix turns *any* failed extraction
/// into `None`, so an invalid body would be silently ignored.
pub struct OptionalJson<T>(pub Option<T>);

impl<T: DeserializeOwned + 'static> FromRequest for OptionalJson<T> {
    type Error = actix_web::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(request: &HttpRequest, payload: &mut Payload) -> Self::Future {
        if !request.headers().contains_key(header::CONTENT_TYPE) {
            return Box::pin(ready(Ok(Self(None))));
        }

        let body = web::Json::<T>::from_request(request, payload);
        Box::pin(async move { Ok(Self(Some(body.await?.into_inner()))) })
    }
}

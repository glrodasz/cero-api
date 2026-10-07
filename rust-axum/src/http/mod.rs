//! What every route shares: the error type and the JSON body extractor.

mod error;
mod json_body;

pub use error::{ApiError, route_not_found};
pub use json_body::JsonBody;

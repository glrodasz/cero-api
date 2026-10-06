//! What every route shares: the error type and how JSON bodies are read.

mod error;
mod json;

pub use error::{ApiError, route_not_found};
pub use json::{OptionalJson, json_config};

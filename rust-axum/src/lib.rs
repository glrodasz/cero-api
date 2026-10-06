//! The Cero API on Axum 0.8. The library is the HTTP application, reusable
//! and testable without a network; `main.rs` wires it to storage and serves it.

mod focus_sessions;
mod http;
mod tasks;

use axum::Router;
use cero_core::Services;
use tower_http::cors::{Any, CorsLayer};

/// Builds the Axum application around the use cases. It knows nothing about storage.
pub fn app(services: Services) -> Router {
    Router::new()
        .nest("/tasks", tasks::routes(services.tasks))
        .nest(
            "/focus-sessions",
            focus_sessions::routes(services.focus_sessions),
        )
        .fallback(http::route_not_found)
        .method_not_allowed_fallback(http::route_not_found)
        // Any origin may call the API, like Express's `cors()`.
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
}

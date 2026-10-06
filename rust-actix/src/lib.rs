//! The Cero API on Actix Web 4. The library registers the HTTP routes, so the
//! tests can use them without a network; `main.rs` wires them to storage and serves them.

mod focus_sessions;
mod http;
mod tasks;

use actix_web::web;
use cero_core::Services;

/// Registers the whole API on an Actix `App`:
/// `App::new().configure(rust_actix::configure(services))`.
///
/// The services become app data, which handlers extract as `web::Data<…>`.
pub fn configure(services: Services) -> impl FnOnce(&mut web::ServiceConfig) {
    move |config| {
        config
            .app_data(web::Data::new(services.tasks))
            .app_data(web::Data::new(services.focus_sessions))
            .app_data(http::json_config())
            .service(web::scope("/tasks").configure(tasks::routes))
            .service(web::scope("/focus-sessions").configure(focus_sessions::routes))
            // `.route()` guards each path by its method, so a request with another
            // method falls through to here too: a 404, as the contract wants, not a 405.
            .default_service(web::to(http::route_not_found));
    }
}

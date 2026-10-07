//! Composition root: read the configuration, choose the storage, build the use
//! cases, hand them to Actix and serve until Ctrl+C or SIGTERM.

mod config;

use std::error::Error;

use actix_cors::Cors;
use actix_web::{App, HttpServer};
use cero_core::{Services, in_memory};

use crate::config::{Config, Storage};

#[actix_web::main]
async fn main() -> Result<(), Box<dyn Error>> {
    tracing_subscriber::fmt::init();
    let config = Config::from_env()?;

    let repositories = match config.storage {
        Storage::Memory => in_memory::repositories(),
        Storage::Postgres => {
            let pool = cero_postgres::connect(&config.database_url).await?;
            cero_postgres::migrate(&pool).await?;
            cero_postgres::repositories(pool)
        }
    };
    let services = Services::new(repositories);

    tracing::info!(
        "rust-actix listening on http://localhost:{} (storage: {})",
        config.port,
        config.storage,
    );
    // Actix calls this factory once per worker thread. Every worker gets a
    // clone of the services, and the clones share the same repositories.
    // Middleware wraps an `App`, not a `ServiceConfig`, so CORS is set here.
    HttpServer::new(move || {
        App::new()
            // Any origin may call the API, like Express's `cors()`.
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header(),
            )
            .configure(rust_actix::configure(services.clone()))
    })
    .bind(("0.0.0.0", config.port))?
    .run() // stops gracefully on SIGINT and SIGTERM
    .await?;
    Ok(())
}

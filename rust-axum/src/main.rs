//! Composition root: read the configuration, choose the storage, build the use
//! cases, hand them to Axum and serve until Ctrl+C or SIGTERM.

mod config;

use std::error::Error;

use cero_core::{Services, in_memory};
use tokio::net::TcpListener;

use crate::config::{Config, Storage};

#[tokio::main]
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
    let app = rust_axum::app(Services::new(repositories));

    let listener = TcpListener::bind(("0.0.0.0", config.port)).await?;
    tracing::info!(
        "rust-axum listening on http://localhost:{} (storage: {})",
        config.port,
        config.storage,
    );
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

/// Resolves on Ctrl+C or SIGTERM. Axum then stops accepting connections and
/// lets the requests in flight finish.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("the Ctrl+C handler installs");
    };

    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{SignalKind, signal};
        signal(SignalKind::terminate())
            .expect("the SIGTERM handler installs")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
}

//! Postgres storage for `cero-core`, built on sqlx.
//!
//! Queries are checked at runtime (`sqlx::query_as` + `#[derive(FromRow)]`),
//! not at compile time, so building needs neither a live database nor a
//! `.sqlx` cache. The schema lives in `migrations/`, embedded in the binary by
//! [`sqlx::migrate!`].
//!
//! ```no_run
//! # async fn open() -> Result<(), Box<dyn std::error::Error>> {
//! let pool = cero_postgres::connect("postgres://root:root@127.0.0.1:5432/cero_rust").await?;
//! cero_postgres::migrate(&pool).await?;
//! let services = cero_core::Services::new(cero_postgres::repositories(pool));
//! # Ok(())
//! # }
//! ```

use std::sync::Arc;

use cero_core::{CoreError, Repositories};
use sqlx::PgPool;
use sqlx::migrate::MigrateError;
use uuid::Uuid;

mod focus_session_repository;
mod task_repository;

pub use focus_session_repository::PostgresFocusSessionRepository;
pub use task_repository::PostgresTaskRepository;

/// Opens a pool of connections to the database.
pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPool::connect(database_url).await
}

/// Brings the schema up to date by applying the migrations that have not run yet.
/// Safe to call on every start.
pub async fn migrate(pool: &PgPool) -> Result<(), MigrateError> {
    sqlx::migrate!().run(pool).await
}

/// Both repositories over one pool (cloning a pool shares its connections).
pub fn repositories(pool: PgPool) -> Repositories {
    Repositories {
        tasks: Arc::new(PostgresTaskRepository::new(pool.clone())),
        focus_sessions: Arc::new(PostgresFocusSessionRepository::new(pool)),
    }
}

/// Ids are UUIDs here. Anything else can match no row, so a lookup by a
/// malformed id finds nothing instead of failing.
fn parse_id(id: &str) -> Option<Uuid> {
    Uuid::try_parse(id).ok()
}

/// A reference that is about to be stored must be a real id: a malformed one
/// is a bug in the caller, not a lookup that found nothing.
fn parse_reference(id: &str) -> Result<Uuid, CoreError> {
    Uuid::try_parse(id).map_err(CoreError::repository)
}

//! Runs the core's repository contract against a real Postgres:
//! `docker compose up -d postgres` from the repository root.
//! A database of its own keeps the test run away from your development data.

use std::borrow::Borrow;

use cero_core::Repositories;
use tokio::sync::{Mutex, MutexGuard};

const DEFAULT_TEST_DATABASE_URL: &str = "postgres://root:root@127.0.0.1:5432/cero_rust_test";

/// Cargo runs tests in parallel, but every case needs the test database to itself.
static DATABASE: Mutex<()> = Mutex::const_new(());

/// Repositories over the emptied test database, which stays reserved for the
/// case until this value is dropped.
struct EmptyDatabase {
    repositories: Repositories,
    _reserved: MutexGuard<'static, ()>,
}

impl Borrow<Repositories> for EmptyDatabase {
    fn borrow(&self) -> &Repositories {
        &self.repositories
    }
}

async fn empty_database() -> EmptyDatabase {
    let reserved = DATABASE.lock().await;
    let database_url =
        std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| DEFAULT_TEST_DATABASE_URL.to_owned());

    let pool = cero_postgres::connect(&database_url)
        .await
        .expect("the test database is reachable");
    cero_postgres::migrate(&pool)
        .await
        .expect("the migrations apply");
    sqlx::query("TRUNCATE tasks, focus_sessions")
        .execute(&pool)
        .await
        .expect("the tables are emptied");

    EmptyDatabase {
        repositories: cero_postgres::repositories(pool),
        _reserved: reserved,
    }
}

cero_core::repository_contract_tests!(empty_database);

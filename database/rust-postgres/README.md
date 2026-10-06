# cero-postgres

Postgres storage for [`cero-core`](../../shared/rust-core), built on
[sqlx](https://crates.io/crates/sqlx). Used by
[`rust-axum`](../../rust-axum) and [`rust-actix`](../../rust-actix).

- [`migrations/`](migrations): the [reference schema](../postgres/schema.sql)
  as sqlx migrations. `sqlx::migrate!()` embeds them in the binary and
  `migrate(&pool)` applies the ones that have not run yet, so apps call it on
  every start.
- [`src/task_repository.rs`](src/task_repository.rs) and
  [`src/focus_session_repository.rs`](src/focus_session_repository.rs): the two
  ports. Queries are checked at runtime (`sqlx::query_as` into a
  `#[derive(FromRow)]` row), not at compile time, so building needs neither a
  database nor a `.sqlx` cache. Each row converts into its domain type with
  `TryFrom`.
- Pauses live in a `jsonb` column, read and written through `sqlx::types::Json`.
- Ids are UUIDs. A malformed id is "not found", as the contract asks: a lookup
  by one finds nothing, and saving or deleting one does nothing.
- [`src/lib.rs`](src/lib.rs): `connect(url)`, `migrate(&pool)` and
  `repositories(pool)` for an app's `main`.

## Test it

The tests run the core's repository contract against a real Postgres, in the
`cero_rust_test` database (override with `TEST_DATABASE_URL`):

```bash
docker compose up -d postgres
cargo test -p cero-postgres
```

Without Docker, leave this crate out: `cargo test --workspace --exclude cero-postgres`.

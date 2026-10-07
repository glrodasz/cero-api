# rust-actix

The Cero API on **Actix Web 4**, storing data in Postgres through
[`cero-postgres`](../database/rust-postgres), or in memory.

Compare it with [`rust-axum`](../rust-axum): same core, same storage, only the
framework changes.

## What this stack shows

- **Shared state is app data.** The services are registered with
  `web::Data::new(...)` and handlers ask for them by type
  (`tasks: web::Data<TasksService>`) ([`src/lib.rs`](src/lib.rs)).
- **Route order matters.** Actix tries routes in the order they are
  registered, so `/{id}/complete` and `/{id}/reset` come before
  `/{id}/{status}`, which would capture them ([`src/tasks.rs`](src/tasks.rs)).
  A test proves it ([`tests/app.rs`](tests/app.rs)).
- **Errors implement `ResponseError`.** `ApiError` wraps `CoreError` and picks
  the status code and the `{ "message" }` body. It is a newtype because the
  orphan rule forbids implementing Actix's trait on the core's type
  ([`src/http/error.rs`](src/http/error.rs)).
- **Body errors are configured once.** `JsonConfig::error_handler` turns every
  `web::Json` failure into a 400. Optional bodies need a small custom
  extractor, `OptionalJson<T>`: Actix's `Option<web::Json<T>>` turns *any*
  failure into `None`, so it would accept invalid bodies ([`src/http/json.rs`](src/http/json.rs)).
- **`ServiceConfig` packages the routes.** `configure(services)` registers
  everything on an `App`; the default service answers the contract's 404.
- **One `App` per worker.** `HttpServer` runs one worker per CPU core and calls
  the app factory in each, so the services are cloned (cheap: they share the
  repositories). CORS comes from `actix-cors`, and the server stops gracefully
  on SIGINT and SIGTERM on its own ([`src/main.rs`](src/main.rs)).
- **Tests need no port.** `actix_web::test::init_service` builds the app in
  memory and `call_service` sends it requests ([`tests/app.rs`](tests/app.rs)).

## Where things live

```
src/
├── main.rs              composition root: config → storage → services → HttpServer
├── config.rs            environment variables
├── lib.rs               configure(services): app data, scopes, default 404
├── http/error.rs        ApiError: ResponseError; 404 for unknown routes
├── http/json.rs         JsonConfig for 400s, OptionalJson<T> for optional bodies
├── tasks.rs             /tasks
└── focus_sessions.rs    /focus-sessions
tests/app.rs             Actix-specific behaviour
```

The business rules are not here: they live in
[`shared/rust-core`](../shared/rust-core).

## Run it

From the repository root:

```bash
docker compose up -d postgres     # or skip it and use STORAGE=memory
cd rust-actix
cargo run                         # or: STORAGE=memory cargo run
```

The API listens on http://localhost:8091 and applies the database migrations
on start. It shares the `cero_rust` database with `rust-axum`, so run one of
them at a time against it.

| Variable | Default |
| --- | --- |
| `PORT` | `8091` |
| `STORAGE` | `postgres` (or `memory`: no database, data is lost on restart) |
| `DATABASE_URL` | `postgres://root:root@127.0.0.1:5432/cero_rust` |

## Test it

```bash
cargo test -p rust-actix          # Actix-specific behaviour
yarn contract rust-actix          # the shared API contract, end to end
```

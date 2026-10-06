# rust-axum

The Cero API on **Axum 0.8**, storing data in Postgres through
[`cero-postgres`](../database/rust-postgres), or in memory.

Compare it with [`rust-actix`](../rust-actix): same core, same storage, only
the framework changes.

## What this stack shows

- **Handlers are plain async functions; their arguments are extractors.**
  `State`, `Path` and the JSON body are pulled out of the request before the
  handler runs ([`src/tasks.rs`](src/tasks.rs)).
- **Each router owns its state.** `tasks::routes(tasks)` builds a router with
  `.with_state(tasks)`, so every handler receives only the service it needs.
  The app nests one router per feature ([`src/lib.rs`](src/lib.rs)).
- **Errors are values.** Handlers return `Result<_, ApiError>` and use `?` on
  the use cases. `ApiError` wraps `CoreError` and implements `IntoResponse`; it
  is a newtype because the orphan rule forbids implementing Axum's trait on the
  core's type ([`src/http/error.rs`](src/http/error.rs)).
- **A custom extractor shapes body errors.** `JsonBody<T>` wraps `axum::Json`
  and turns its rejections into 400 `{ "message" }`. Axum 0.8's
  `OptionalFromRequest` makes `Option<JsonBody<T>>` work for optional bodies
  without hiding invalid ones ([`src/http/json_body.rs`](src/http/json_body.rs)).
- **Routes use `/{id}` syntax, and fixed segments win.** `/{id}/complete` beats
  `/{id}/{status}` whatever the order. `fallback` and
  `method_not_allowed_fallback` answer the contract's 404.
- **Middleware is Tower.** CORS is a `tower-http` layer.
- **Graceful shutdown.** On Ctrl+C or SIGTERM, Axum stops accepting
  connections and lets the requests in flight finish ([`src/main.rs`](src/main.rs)).
- **Tests need no port.** A `Router` is a Tower service, so
  `ServiceExt::oneshot` sends requests straight into it ([`tests/app.rs`](tests/app.rs)).

## Where things live

```
src/
├── main.rs              composition root: config → storage → services → app → serve
├── config.rs            environment variables
├── lib.rs               app(services): routers, 404 fallbacks, CORS
├── http/error.rs        ApiError: core error → status code; 404 for unknown routes
├── http/json_body.rs    JsonBody<T>: JSON bodies, rejections → 400
├── tasks.rs             /tasks
└── focus_sessions.rs    /focus-sessions
tests/app.rs             Axum-specific behaviour
```

The business rules are not here: they live in
[`shared/rust-core`](../shared/rust-core).

## Run it

From the repository root:

```bash
docker compose up -d postgres     # or skip it and use STORAGE=memory
cd rust-axum
cargo run                         # or: STORAGE=memory cargo run
```

The API listens on http://localhost:8090 and applies the database migrations
on start. It shares the `cero_rust` database with `rust-actix`, so run one of
them at a time against it.

| Variable | Default |
| --- | --- |
| `PORT` | `8090` |
| `STORAGE` | `postgres` (or `memory`: no database, data is lost on restart) |
| `DATABASE_URL` | `postgres://root:root@127.0.0.1:5432/cero_rust` |

## Test it

```bash
cargo test -p rust-axum           # Axum-specific behaviour
yarn contract rust-axum           # the shared API contract, end to end
```

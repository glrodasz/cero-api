# go-fiber

The Cero API on **Fiber v3**, storing data in PostgreSQL through
[`go-postgres`](../database/go-postgres), or in memory.

Compare it with [`go-gin`](../go-gin): same core, same storage, only the
framework changes.

## What this stack shows

- **Handlers return errors.** Every handler is `func(fiber.Ctx) error`; what it
  returns reaches the app's `ErrorHandler`, which maps core errors to 404/400,
  bodies that do not bind to 400, and anything else to a 500 that does not
  leak internals ([`internal/api/errors.go`](internal/api/errors.go)). The
  `recover` middleware turns panics into errors for the same handler.
- **Binding, validation of your choice.** `c.Bind().JSON` decodes the body and
  then calls the app's `StructValidator`. Fiber ships none; this app plugs in
  go-playground/validator for the `validate` tags
  ([`internal/api/binding.go`](internal/api/binding.go)).
- **Routes match in declaration order.** `/tasks/:id/complete` must come before
  `/tasks/:id/:status`, and the 404 catch-all comes last, as an `app.Use`
  ([`internal/api/app.go`](internal/api/app.go)).
- **`fiber.Ctx` is a `context.Context`**, so handlers pass it straight to the
  services ([`tasks.go`](internal/api/tasks.go),
  [`focus_sessions.go`](internal/api/focus_sessions.go)).
- **Zero allocation has a price.** Fiber runs on fasthttp, and the strings it
  hands out point into buffers it reuses after each request. The in-memory
  storage keeps one of them (the status of `PATCH /tasks/:id/:status`), so the
  app turns on `Immutable`; a test proves the value survives
  ([`internal/api/app_test.go`](internal/api/app_test.go)).
- **`app.Test` for tests.** Requests go straight into the app, without opening
  a port. **Graceful shutdown** is `fiber.ListenConfig{GracefulContext}`
  ([`cmd/server/main.go`](cmd/server/main.go)).

## Where things live

```
cmd/server/
├── main.go                    composition root: storage → services → app → listen, graceful shutdown
└── config.go                  environment variables
internal/api/
├── app.go                     NewApp(services): config, middleware, routes, 404
├── errors.go                  ErrorHandler and unknown routes
├── binding.go                 StructValidator, optional bodies
├── tasks.go                   /tasks
└── focus_sessions.go          /focus-sessions
```

The business rules are not here: they live in
[`shared/go-core`](../shared/go-core).

## Run it

```bash
docker compose up -d postgres     # from the repository root, or skip it and use STORAGE=memory
cd go-fiber
go run ./cmd/server
```

The API listens on http://localhost:8081. Go downloads the toolchain it needs
(Go 1.27) on first run. go-gin uses the same `cero_go` database: run one of
them at a time.

| Variable | Default |
| --- | --- |
| `PORT` | `8081` |
| `STORAGE` | `postgres` (or `memory`: no database, data is lost on restart) |
| `DATABASE_URL` | `postgres://root:root@127.0.0.1:5432/cero_go` |

## Test it

```bash
go test ./...                     # Fiber-specific behaviour
yarn contract go-fiber            # from the repository root: the shared API contract, end to end
```

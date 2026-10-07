# go-gin

The Cero API on **Gin**, storing data in PostgreSQL through
[`go-postgres`](../database/go-postgres), or in memory.

Compare it with [`go-fiber`](../go-fiber): same core, same storage, only the
framework changes.

## Architecture

```mermaid
flowchart LR
  client(["HTTP client"]) --> router
  subgraph transport["go-gin"]
    main["cmd/server/main.go<br/>composition root"]
    router["internal/api/router.go<br/>NewRouter"]
    handlers["tasks.go<br/>focus_sessions.go"]
    errors["errors.go<br/>handleErrors"]
  end
  subgraph core["shared/go-core"]
    services["TasksService<br/>FocusSessionsService"]
    ports{{"repository ports"}}
  end
  pg[("database/go-postgres<br/>Postgres")]
  mem[("go-core/memory<br/>in-memory")]
  main -.->|"core.NewServices"| router
  router --> handlers --> services --> ports
  handlers -.->|"c.Error(err)"| errors
  ports --> pg & mem
```

1. `main.go` reads `STORAGE` (`postgres` by default, or `memory`), opens those repositories and passes `core.NewServices(...)` to `api.NewRouter`.
2. A handler binds the body with `c.ShouldBindJSON` and its `binding` tags ([`binding.go`](internal/api/binding.go)), then calls one service method.
3. The service applies the rules of [`shared/go-core`](../shared/go-core) and reaches storage only through the repository ports.
4. Errors go to `c.Error`; the `handleErrors` middleware turns them into a 404, 400 or 500 `{ "message" }`.

## What this stack shows

- **Handlers record errors, one middleware answers them.** Gin handlers return
  nothing: on failure they call `c.Error(err)` and return. `handleErrors` runs
  `c.Next()` and turns the last error into a status code: core errors become
  404/400, bodies that do not bind 400, anything else a 500 that does not leak
  internals ([`internal/api/errors.go`](internal/api/errors.go)). Panics reach
  the same 500 through `gin.CustomRecovery`.
- **Binding and validation.** `c.ShouldBindJSON` decodes the body and checks
  its `binding` tags with Gin's validator (`binding:"required"`); a wrong type
  is a decoding error ([`internal/api/binding.go`](internal/api/binding.go)).
  `PATCH /tasks/:id` binds straight into `core.TaskChanges`, which keeps
  absent, null and given fields apart.
- **Static segments win.** Gin's radix tree prefers `/tasks/:id/complete` over
  `/tasks/:id/:status` whatever the declaration order, and backtracks, so
  `/tasks/:id/completed` still reaches `:status`
  ([`internal/api/router_test.go`](internal/api/router_test.go)).
- **Handler structs.** One struct per resource holds the service it needs
  ([`tasks.go`](internal/api/tasks.go),
  [`focus_sessions.go`](internal/api/focus_sessions.go)); `NewRouter` wires
  them ([`internal/api/router.go`](internal/api/router.go)).
- **`net/http` underneath.** `main` serves the router with an `http.Server` and
  shuts it down gracefully on SIGINT/SIGTERM
  ([`cmd/server/main.go`](cmd/server/main.go)); tests drive it with `httptest`.

## Where things live

```
cmd/server/
├── main.go                    composition root: storage → services → router → serve, graceful shutdown
└── config.go                  environment variables
internal/api/
├── router.go                  NewRouter(services): middleware, routes, 404
├── errors.go                  error middleware, unknown routes, panics
├── binding.go                 JSON bodies → 400 on failure
├── tasks.go                   /tasks
└── focus_sessions.go          /focus-sessions
```

The business rules are not here: they live in
[`shared/go-core`](../shared/go-core).

## Run it

```bash
docker compose up -d postgres     # from the repository root, or skip it and use STORAGE=memory
cd go-gin
go run ./cmd/server
```

The API listens on http://localhost:8080. Go downloads the toolchain it needs
(Go 1.27) on first run. go-fiber uses the same `cero_go` database: run one of
them at a time.

| Variable | Default |
| --- | --- |
| `PORT` | `8080` |
| `STORAGE` | `postgres` (or `memory`: no database, data is lost on restart) |
| `DATABASE_URL` | `postgres://root:root@127.0.0.1:5432/cero_go` |
| `GIN_MODE` | `debug` (`release` silences Gin's startup output) |

## Test it

```bash
go test ./...                     # Gin-specific behaviour
yarn contract go-gin              # from the repository root: the shared API contract, end to end
```

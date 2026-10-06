# shared/

Everything the implementations have in common: the contract they all honour,
the tests that prove it, and, per language, the core every framework reuses.

| Path | What it is |
| --- | --- |
| [`api-contract.md`](./api-contract.md) | The REST API every implementation serves |
| [`graphql/schema.graphql`](./graphql/schema.graphql) | The same API as a GraphQL schema |
| [`contract-tests/`](./contract-tests) | Black-box suite that runs against any running implementation |
| [`core-test-plan.md`](./core-test-plan.md) | The unit tests every language core implements, by name |
| `<language>-core/` | Domain, business rules and storage ports for one language |

## The layers

```
             ┌──────────────────────────────────────────────┐
  transport  │ typescript-express  typescript-fastify  ...  │  routes, validation, HTTP status codes
             └──────────────────────┬───────────────────────┘
                                    │ calls
             ┌──────────────────────▼───────────────────────┐
  core       │ shared/<language>-core                       │  use cases (services), domain rules,
             │   TasksService · FocusSessionsService        │  repository ports (interfaces),
             │   TaskRepository · FocusSessionRepository    │  in-memory adapter
             └──────────────────────▲───────────────────────┘
                                    │ implements the ports
             ┌──────────────────────┴───────────────────────┐
  storage    │ database/<language>-<database>               │  MongoDB, Postgres, Firestore, Supabase
             └──────────────────────────────────────────────┘
```

- **The core knows nothing** about HTTP or databases. It is plain code you can
  unit-test with the in-memory repositories.
- **A storage adapter** implements the two repository ports for one database
  and proves it by running the core's *repository contract* test suite.
- **A framework folder** wires one adapter into the core (its composition root,
  usually `main`) and translates HTTP to service calls and errors to status
  codes. That is all it does, so comparing two frameworks of the same language
  shows only what is genuinely different about them.

Laravel and Phoenix are the exception: they are the only framework in their
language, so they use their framework's own layering (Eloquent models and
actions; Ecto contexts), following the same rules.

## One endpoint, one service method

| Endpoint | Service method |
| --- | --- |
| `GET /tasks` | `tasks.list()` |
| `GET /tasks/:id` | `tasks.get(id)` |
| `POST /tasks` | `tasks.create({ description })` |
| `PATCH /tasks/:id/complete` | `tasks.complete(id)` |
| `PATCH /tasks/:id/reset` | `tasks.reset(id)` |
| `PATCH /tasks/:id/:status` | `tasks.changeStatus(id, status)` |
| `PATCH /tasks/:id` | `tasks.update(id, changes)` |
| `DELETE /tasks/:id` | `tasks.delete(id)` |
| `GET /focus-sessions` | `focusSessions.list()` |
| `GET /focus-sessions/active` | `focusSessions.getCurrent()` |
| `POST /focus-sessions` | `focusSessions.start({ taskIds, startTime })` |
| `PATCH /focus-sessions/finish` | `focusSessions.finishCurrent()` |
| `PATCH /focus-sessions/:id/finish` | `focusSessions.finish(id)` |
| `PATCH /focus-sessions/pause` | `focusSessions.pauseCurrent({ time })` |
| `PATCH /focus-sessions/:id/pause` | `focusSessions.pause(id)` |
| `PATCH /focus-sessions/resume` | `focusSessions.resumeCurrent()` |
| `PATCH /focus-sessions/:id/resume` | `focusSessions.resume(id)` |

## The same names in every language

Each language follows its own naming style; the words stay the same.

| Concept | TypeScript | Python | Go | Rust |
| --- | --- | --- | --- | --- |
| Use cases | `TasksService`, `FocusSessionsService` | same | same | same |
| A method | `getCurrent` | `get_current` | `GetCurrent` | `get_current` |
| Storage ports | `TaskRepository`, `FocusSessionRepository` | `Protocol`s | `interface`s | `trait`s |
| Port methods | `findById`, `findMany`, `countByStatus`, `create`, `save`, `delete`, `assignFocusSession`, `findAll`, `findCurrent` | snake_case | PascalCase | snake_case |
| Query filter | `TaskFilter { ids?, statuses?, focusSessionId? }` | dataclass | struct | struct |
| Errors | `NotFoundError`, `ValidationError` | exceptions | error types + sentinels | `CoreError::{NotFound, Invalid}` |
| Messages | `MESSAGES.TASK_NOT_FOUND` | `Messages.TASK_NOT_FOUND` | `MsgTaskNotFound` | `messages::TASK_NOT_FOUND` |
| Clock | `() => number` | `Callable[[], int]` | `func() int64` | `Clock` trait |
| Wiring | `createServices(repositories, { clock })` | `create_services` | `NewServices` | `Services::new` |
| In-memory storage | `@cero/core/in-memory` | `cero_core.in_memory` | `memory` package | `cero_core::in_memory` |

## Running conventions

Every implementation reads the same environment variables:

| Variable | Meaning |
| --- | --- |
| `PORT` | Where to listen (defaults below, so every stack can run side by side) |
| `STORAGE` | `memory` (no database needed), `mongodb` or `postgres`, depending on what the stack supports |
| `MONGODB_URI` | e.g. `mongodb://root:root@127.0.0.1:27017/cero_typescript?authSource=admin` |
| `DATABASE_URL` | e.g. `postgres://root:root@127.0.0.1:5432/cero_go` |

The databases come from the root [`docker-compose.yml`](../docker-compose.yml);
each language has its own database inside the server (`cero_python`, `cero_go`, ...).

| Implementation | Port | Storage |
| --- | --- | --- |
| typescript-express | 3000 | mongodb, memory |
| typescript-fastify | 3001 | mongodb, memory |
| typescript-nest | 3002 | mongodb, memory |
| typescript-graphql | 3003 (`/graphql`) | mongodb, memory |
| typescript-firebase | 5001 (emulator) | Firestore |
| typescript-supabase | 54321 (Supabase local) | Supabase Postgres |
| python-fastapi | 8000 | postgres, mongodb, memory |
| python-graphql | 8001 (`/graphql`) | postgres, mongodb, memory |
| python-supabase | 8002 | Supabase Postgres |
| python-firebase | 5002 (emulator) | Firestore |
| go-gin | 8080 | postgres, memory |
| go-fiber | 8081 | postgres, memory |
| rust-axum | 8090 | postgres, memory |
| rust-actix | 8091 | postgres, memory |
| php-laravel | 8100 | postgres |
| elixir-phoenix | 4000 | postgres |

<img src="docs/assets/logo.svg" width="164" align="left" alt="Cero API logo: three stacked bars for the transport, core and storage layers, with { 0 } in the middle">

# Cero API

**The RETO backend, built 16 times in 6 languages, all held to one contract suite.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white) ![Go](https://img.shields.io/badge/Go-00ADD8?logo=go&logoColor=white) ![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white) ![PHP · Elixir](https://img.shields.io/badge/PHP%20%C2%B7%20Elixir-6B4FBB)

<br clear="left">

[**Cero project**](https://github.com/glrodasz/cero) · [API contract](shared/api-contract.md) · [How it works](#how-it-works) · [Architecture](#architecture) · [Quick start](#quick-start)

<img src="docs/assets/og-image.png" alt="Cero API: the backend of RETO · Cero a Producción. One API. 16 implementations. One black-box suite to prove it. TypeScript, Python, Go, Rust, PHP, Elixir. REST + GraphQL." width="860">

## Why

Part of [Cero](https://github.com/glrodasz/cero), the project that builds
**RETO**, a productivity app, from scratch to production.

Framework comparisons usually stop at "hello world", where every stack looks the
same. This repository is the **backend** of RETO (tasks and focus sessions)
implemented over and over in different languages and frameworks: a *TodoMVC for
backends*. Every implementation serves **the same API**
([`shared/api-contract.md`](shared/api-contract.md)) and passes **the same
black-box test suite** ([`shared/contract-tests`](shared/contract-tests)), so
the differences you see between two stacks are the real ones.

It is for developers choosing a stack, learning a new one by reading the same
problem solved in a language they know, and anyone following the Cero project.

### Design principles

| Principle | In practice |
| --- | --- |
| One contract, written down | [`api-contract.md`](shared/api-contract.md) fixes every route, body, status code and `404` message |
| Proven from the outside | The contract suite only speaks HTTP or GraphQL, so it runs unchanged against any stack |
| One core per language | Frameworks of the same language share `TasksService` and `FocusSessionsService`; only the transport differs |
| Storage behind ports | Each database is an adapter that passes the core's repository contract tests |
| Idiomatic where it stands alone | Laravel and Phoenix use their framework's own layering instead of a shared core |

## Quick start

Prerequisites: Node.js ≥ 22.18 with Corepack (for Yarn 4), plus the toolchain
of the stack you want to run (Go, Rust, uv, PHP, Elixir…).

```bash
corepack enable
yarn install
STORAGE=memory yarn contract typescript-express   # boots the app, runs the suite, stops it
```

`yarn contract` takes any name from
[`shared/contract-tests/apps.json`](shared/contract-tests/apps.json). With a real
database, start one first; a single `docker-compose.yml` serves every stack,
with a database per language inside each server:

```bash
docker compose up -d       # MongoDB on 27017, Postgres on 5432 (root / root)
yarn contract go-gin
```

<details>
<summary>Run the suite against a server that is already running</summary>

```bash
API_URL=http://127.0.0.1:8080 yarn workspace @cero/contract-tests suite
API_PROTOCOL=graphql API_URL=http://127.0.0.1:8001/graphql yarn workspace @cero/contract-tests suite
```

</details>

Each implementation's README explains its idioms, where things live, and how to
run and test it on its own.

## How it works

**The API.** Two resources, tasks and focus sessions, served as JSON with ids as
opaque strings and times in epoch milliseconds. Every error is `{ "message" }`.

| Resource | Routes | Rules worth knowing |
| --- | --- | --- |
| Tasks | `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/:id`, `PATCH /tasks/:id/{complete,reset,:status}` | A new task is `in-progress` while fewer than 3 are, otherwise `pending`; completing or resetting renumbers its group |
| Focus sessions | `GET/POST /focus-sessions`, `GET /focus-sessions/active`, `PATCH /focus-sessions[/:id]/{pause,resume,finish}` | The *current* session is the newest `active` or `paused` one; finishing closes the open pause and detaches unfinished tasks |

The GraphQL implementations expose the same behaviour through
[`shared/graphql/schema.graphql`](shared/graphql/schema.graphql).

**The proof.** The runner reads `apps.json`, boots the implementation with its
own start command, waits for it to answer, runs the black-box suite over HTTP
(or GraphQL), and stops it. Platform limits are declared per app as
`knownFailures` with a reason; the runner skips those tests and prints why.

**The layers.** Each language splits the work into transport, core and storage,
so two frameworks of the same language differ only where the frameworks really
differ:

| Layer | Where | Holds |
| --- | --- | --- |
| **Core** | `shared/<language>-core` | Domain rules, use cases (`TasksService`, `FocusSessionsService`), storage ports, an in-memory adapter |
| **Storage** | `database/<language>-<database>` | One adapter per database, proven by the core's *repository contract* tests |
| **Transport** | `<language>-<framework>` | Routes, validation, error → status code, and the composition root |

[`shared/README.md`](shared/README.md) maps every endpoint to its service method
and the names across languages.

## Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/context-dark.svg">
  <img src="docs/diagrams/context-light.svg" alt="A developer runs the contract suite and a RETO client calls REST or GraphQL against Cero API, whose 16 implementations store tasks and focus sessions in MongoDB, PostgreSQL, Firebase or Supabase." width="880">
</picture>

Cero API is one system with sixteen interchangeable faces: a client can talk to
any implementation and see the same behaviour. Teal boxes are the databases
that `docker-compose.yml` runs locally; gray boxes are platforms that run
locally through their own emulators (Firebase) or CLI (Supabase).

Inside, each language has a core that knows nothing about HTTP or databases,
storage adapters that implement its repository ports, and one thin transport
folder per framework. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) draws the
layers.

**Tech stack.** Transport: Express 5, Fastify 5, NestJS, GraphQL Yoga, Hono,
FastAPI, Strawberry, Gin, Fiber, Axum, Actix Web, Laravel, Phoenix · Storage:
MongoDB, PostgreSQL, Firestore, Supabase · Tooling: Yarn 4, uv, Go workspaces,
Cargo, Docker Compose, Node's test runner.

## Usage

### Implementations

| Implementation | Docs | Stack | Storage | Port | Contract suite |
| --- | --- | --- | --- | --- | --- |
| [`typescript-express`](typescript-express) | [README](typescript-express/README.md#architecture) | Express 5, zod | MongoDB (Mongoose), memory | 3000 | ✅ 58/58 |
| [`typescript-fastify`](typescript-fastify) | [README](typescript-fastify/README.md#architecture) | Fastify 5, TypeBox | MongoDB (Mongoose), memory | 3001 | ✅ 58/58 |
| [`typescript-nest`](typescript-nest) | [README](typescript-nest/README.md#architecture) | NestJS 12, class-validator | MongoDB (Mongoose), memory | 3002 | ✅ 58/58 |
| [`typescript-graphql`](typescript-graphql) | [README](typescript-graphql/README.md#architecture) | GraphQL Yoga 5, schema-first | MongoDB (Mongoose), memory | 3003 | ✅ 43/43 (GraphQL) |
| [`typescript-firebase`](typescript-firebase) | [README](typescript-firebase/README.md#architecture) | Cloud Functions 2nd gen + the Express app | Firestore (emulator) | 5001 | ✅ 57/57 + 1 platform limit¹ |
| [`typescript-supabase`](typescript-supabase) | [README](typescript-supabase/README.md#architecture) | Supabase Edge Function, Deno + Hono | Supabase Postgres (supabase-js) | 54321 | ✅ 58/58 |
| [`python-fastapi`](python-fastapi) | [README](python-fastapi/README.md#architecture) | FastAPI, Pydantic | Postgres (SQLAlchemy), MongoDB (PyMongo), memory | 8000 | ✅ 58/58 |
| [`python-graphql`](python-graphql) | [README](python-graphql/README.md#architecture) | Strawberry, code-first | Postgres, MongoDB, memory | 8001 | ✅ 43/43 (GraphQL) |
| [`python-supabase`](python-supabase) | [README](python-supabase/README.md#architecture) | The FastAPI app over supabase-py | Supabase Postgres (supabase-py) | 8002 | ✅ 58/58 |
| [`python-firebase`](python-firebase) | [README](python-firebase/README.md#architecture) | Cloud Functions (Python) + the FastAPI app | Firestore (emulator) | 5002 | ✅ 58/58 |
| [`go-gin`](go-gin) | [README](go-gin/README.md#architecture) | Gin | Postgres (pgx), memory | 8080 | ✅ 58/58 |
| [`go-fiber`](go-fiber) | [README](go-fiber/README.md#architecture) | Fiber v3 | Postgres (pgx), memory | 8081 | ✅ 58/58 |
| [`rust-axum`](rust-axum) | [README](rust-axum/README.md#architecture) | Axum 0.8 | Postgres (sqlx), memory | 8090 | ✅ 58/58 |
| [`rust-actix`](rust-actix) | [README](rust-actix/README.md#architecture) | Actix Web 4 | Postgres (sqlx), memory | 8091 | ✅ 58/58 |
| [`php-laravel`](php-laravel) | [README](php-laravel/README.md#architecture) | Laravel 13, Eloquent | Postgres | 8100 | ✅ 58/58 |
| [`elixir-phoenix`](elixir-phoenix) | [README](elixir-phoenix/README.md#architecture) | Phoenix 1.8, Ecto | Postgres | 4000 | ✅ 58/58² |

¹ Cloud Functions parses JSON bodies before the app runs, so malformed JSON
gets the platform's HTML 400 instead of `{ "message" }`.
² Verified in the official Elixir image with dependencies built from source;
see [its README](elixir-phoenix/README.md) for details.

### Configuration

Every implementation reads the same environment variables, and the default
ports above let every stack run side by side.

| Variable | Meaning |
| --- | --- |
| `PORT` | Where to listen |
| `STORAGE` | `memory` (no database needed), `mongodb` or `postgres`, depending on what the stack supports |
| `MONGODB_URI` | e.g. `mongodb://root:root@127.0.0.1:27017/cero_typescript?authSource=admin` |
| `DATABASE_URL` | e.g. `postgres://root:root@127.0.0.1:5432/cero_go` |

All TypeScript packages share one Yarn workspace, all Python packages one uv
workspace, and all Rust crates one Cargo workspace, at the repository root. Go
modules are joined by `go.work`; PHP and Elixir projects are standalone.

### Project layout

```
├── docker-compose.yml          MongoDB + Postgres for every stack
├── shared/
│   ├── api-contract.md         the API, endpoint by endpoint
│   ├── graphql/                the same API as a GraphQL schema
│   ├── contract-tests/         black-box suite + runner (apps.json)
│   ├── core-test-plan.md       unit tests every core implements
│   ├── typescript-core/        reference core
│   ├── python-core/
│   ├── go-core/
│   └── rust-core/
├── database/
│   ├── postgres/               init script (one database per language) + reference schema
│   ├── typescript-mongoose/    typescript-firestore/    typescript-supabase/
│   ├── python-postgres/        python-mongodb/          python-supabase/    python-firestore/
│   ├── go-postgres/
│   └── rust-postgres/
├── typescript-express/  typescript-fastify/  typescript-nest/  typescript-graphql/
├── typescript-firebase/ typescript-supabase/
├── python-fastapi/      python-graphql/      python-supabase/  python-firebase/
├── go-gin/              go-fiber/
├── rust-axum/           rust-actix/
├── php-laravel/
└── elixir-phoenix/
```

## Documentation

| Doc | What's in it |
| --- | --- |
| [API contract](shared/api-contract.md) | The REST API, endpoint by endpoint, and how it differs from the original Express version |
| [GraphQL schema](shared/graphql/schema.graphql) | The same API as a GraphQL schema |
| [Layers and naming](shared/README.md) | How core, storage and transport fit together, endpoint → service method, names across languages |
| [Architecture](docs/ARCHITECTURE.md) | The layers diagram and the per-language cores |
| [Core test plan](shared/core-test-plan.md) | The unit cases every core implements, by name |
| Cores | [TypeScript](shared/typescript-core/README.md#architecture) · [Python](shared/python-core/README.md#architecture) · [Go](shared/go-core/README.md#architecture) · [Rust](shared/rust-core/README.md#architecture) |
| TypeScript storage | [Mongoose](database/typescript-mongoose/README.md) · [Firestore](database/typescript-firestore/README.md) · [Supabase](database/typescript-supabase/README.md) |
| Python storage | [Postgres](database/python-postgres/README.md) · [MongoDB](database/python-mongodb/README.md) · [Firestore](database/python-firestore/README.md) · [Supabase](database/python-supabase/README.md) |
| Go / Rust storage | [go-postgres](database/go-postgres/README.md) · [rust-postgres](database/rust-postgres/README.md) |
| [Postgres schema](database/postgres/schema.sql) | Reference tables every Postgres stack follows |

## Contributing

To add an implementation:

1. Reuse your language's core, or port [`shared/typescript-core`](shared/typescript-core)
   together with the cases in [`shared/core-test-plan.md`](shared/core-test-plan.md).
2. Reuse or write a storage adapter, and make it pass the repository contract.
3. Write the transport layer: routes, validation, error mapping, composition root.
4. Register it in [`shared/contract-tests/apps.json`](shared/contract-tests/apps.json)
   and make `yarn contract <name>` pass.

A new storage adapter for an existing core is a single new package under
`database/` that passes that core's repository contract tests. For the
TypeScript workspace, `yarn test` and `yarn typecheck` run across every package.

## License

[MIT](LICENSE) © 2026 Guillermo Rodas.

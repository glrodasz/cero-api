# Cero a Producción — API

0️⃣ 🚀 **Cero a Producción** is a series of live coding sessions where we build
**RETO**, a productivity app, from scratch to production — real decisions,
failing tests, refactors and all.

📺 [YouTube](https://glrz.me/youtube-cero) · 🟣 [Twitch](https://glrz.me/stream)
(live in 🇪🇸 Spanish, Tuesdays to Fridays)

Part of the [Cero a Producción project](https://github.com/glrodasz/cero).

## What this is

The **backend** of RETO — tasks and focus sessions — implemented over and over
in different stacks, so we can compare them on the same real problem. Each
top-level folder is a self-contained implementation of the same API.

> ⚠️ Work in progress. [`cero-web`](https://github.com/glrodasz/cero-web) does
> not consume this API yet; it still runs on `json-server` locally.

## Status

| Implementation | Stack | Status |
| --- | --- | --- |
| `typescript-express` | Express 5 + Mongoose, Node ≥ 24, Yarn 4 | ✅ Working |
| `typescript-fastify` | Fastify 5 + Mongoose, Node ≥ 24, Yarn 4 | ✅ Working |
| `typescript-graphql`, `typescript-nest`, `typescript-firebase`, `typescript-supabase` | TypeScript | 📋 Planned |
| `python-fastapi`, `python-graphql`, `python-firebase`, `python-supabase` | Python | 📋 Planned |
| `rust-actix`, `rust-axum` | Rust | 📋 Planned |
| `go-fiber`, `go-gin` | Go | 📋 Planned |
| `elixir-phoenix` | Elixir | 📋 Planned |
| `php-laravel` | PHP | 📋 Planned |
| `database/*` | MongoDB / Postgres / Mongoose / TypeORM / Sequelize examples | 📋 Planned |

## Running an implementation

Each folder is independent and carries its own README, dependencies and
`docker-compose.yml`. The working ones follow the same three steps:

```bash
cd typescript-fastify   # or typescript-express
cp .env.example .env
yarn install
yarn dev                # starts MongoDB via docker-compose, then the API
```

The server listens on `http://localhost:3000` and connects to MongoDB using
`MONGODB_URI` from `.env`.

## Folder structure

```
root/
│
├── typescript-express/     # ✅
├── typescript-fastify/     # ✅
├── typescript-graphql/
├── typescript-nest/
├── typescript-firebase/
├── typescript-supabase/
├── python-fastapi/
├── python-graphql/
├── python-firebase/
├── python-supabase/
├── rust-actix/
├── rust-axum/
├── go-fiber/
├── go-gin/
├── elixir-phoenix/
├── php-laravel/
├── database/
│   ├── typescript-mongodb/
│   ├── typescript-mongoose/
│   ├── typescript-postgres/
│   ├── python-mongodb/
│   ├── python-postgres/
│   ├── sequelize-postgres/
│   └── typeorm-postgres/
└── shared/                 # code shared between implementations
```

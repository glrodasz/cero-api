# typescript-supabase

The Cero API as a **Supabase Edge Function**: a [Hono](https://hono.dev) app on
Deno, storing data in Supabase Postgres through
[`@cero/supabase`](../database/typescript-supabase). It runs on the local
Supabase stack, with no Supabase account.

This stack lives in the Deno world, not in the Yarn workspace: Deno runs the
function, its tests and the Supabase CLI.

## The Supabase paradigm

```
client ──HTTP──► Kong :54321 ──/functions/v1/api──► Edge Runtime (Deno)
                                                      Hono → core → supabase-js
                                                                      │ HTTP + service role key
                     Kong ◄──────────────/rest/v1────────────────────┘
                       └──► PostgREST ──SQL──► Postgres (RLS on, no policies)
```

- **Edge Functions are Deno.** Each folder under `supabase/functions` is a
  function, served at `/functions/v1/<name>`. Its `index.ts` hands a fetch
  handler to `Deno.serve`; here that handler is a Hono app
  ([`supabase/functions/api/index.ts`](supabase/functions/api/index.ts)).
  Supabase forwards requests with the path starting at the function name,
  hence `new Hono().basePath("/api")`
  ([`app.ts`](supabase/functions/api/app.ts)).
- **The database is an HTTP API.** The function writes no SQL and holds no
  connection pool: supabase-js turns `.from("tasks").select().eq(...)` into a
  request to PostgREST, which generates the REST API from the schema. Its types
  come from the schema too (`supabase gen types`).
- **Row Level Security decides who sees what.** PostgREST publishes every table
  to anyone holding the public anon key. The
  [migration](supabase/migrations/20261006000000_create_tasks_and_focus_sessions.sql)
  enables RLS with no policy, so the anon and authenticated roles see nothing.
  The function uses the **service role key**, which bypasses RLS: the function
  is the only way in, and it applies the business rules.
- **Configuration as code.** [`supabase/config.toml`](supabase/config.toml)
  describes the local stack (and, once linked, the hosted project); migrations
  are plain SQL files applied in order.

## What this stack shows

- **Hono's idioms.** Routers are `Hono` instances mounted with `app.route()`;
  bodies go through `@hono/zod-validator` and reach the handler typed, with
  `c.req.valid("json")` ([`http/validation.ts`](supabase/functions/api/http/validation.ts));
  `app.onError` and `app.notFound` turn every failure into `{ message }`
  ([`http/errors.ts`](supabase/functions/api/http/errors.ts)).
- **The shared core, used in place.** The function's
  [`deno.json`](supabase/functions/api/deno.json) is its import map: `@cero/core`
  points at [`shared/typescript-core`](../shared/typescript-core) and
  `@cero/supabase` at the adapter. The core's imports carry `.ts` extensions, so
  Deno loads it as is. The Edge Runtime runs in Docker and only mounts
  `supabase/functions`, but the CLI follows the function's imports and
  bind-mounts every local file they reach inside the git repository, so no copy
  of the core is needed. The mounts are decided when the container starts:
  after adding a file outside `supabase/functions`, restart the stack.
- **Public function, private database.** `verify_jwt = false` lets clients call
  the API without a Supabase JWT, like every other implementation; the service
  role key never leaves the server, where Supabase injects it
  (`SUPABASE_SERVICE_ROLE_KEY`, [`config.ts`](supabase/functions/api/config.ts)).
- **Tests without a server.** `app.request()` sends a `Request` straight into
  the Hono app, over the in-memory repositories
  ([`app.test.ts`](supabase/functions/api/app.test.ts)).
- **Only what the API needs.** Studio, Auth, Storage, Realtime, analytics, the
  mail catcher and the pooler are switched off: the stack is Postgres,
  PostgREST, Kong and the Edge Runtime.

## Where things live

```
typescript-supabase/
├── deno.json                    tasks; pins the Supabase CLI (deno.lock)
└── supabase/
    ├── config.toml              local stack: ports, services, [functions.api] verify_jwt = false
    ├── migrations/              the schema of database/postgres/schema.sql, plus RLS
    └── functions/api/           the Edge Function "api"
        ├── deno.json            import map: core, adapter, Hono, zod, supabase-js
        ├── index.ts             composition root: supabase-js → repositories → services → Deno.serve
        ├── config.ts            SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
        ├── app.ts               createApp(services): base path, CORS, routers, error handling
        ├── http/errors.ts       404 for unknown routes, error → status code
        ├── http/validation.ts   zod validator → ValidationError
        ├── tasks/tasks.routes.ts                   /tasks
        ├── focusSessions/focusSessions.routes.ts   /focus-sessions
        └── app.test.ts          Hono's job: routing, validation, errors
```

The business rules live in [`shared/typescript-core`](../shared/typescript-core),
the storage in [`database/typescript-supabase`](../database/typescript-supabase).

## Run it locally

Needs Docker and Deno 2 (`npm install -g deno` works too). The first start
pulls the images (about 2 GB).

```bash
cd typescript-supabase
deno task start
```

`deno task start` starts the stack (on a fresh database, `supabase start`
applies the migrations), then follows the function's logs; Ctrl-C stops
following, not the stack. The API is http://127.0.0.1:54321/functions/v1/api
(for example `GET .../api/tasks`).

| Service                                  | Address                                                   |
| ---------------------------------------- | --------------------------------------------------------- |
| API gateway (Kong): functions, PostgREST | http://127.0.0.1:54321                                    |
| Postgres                                 | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Every other CLI command goes through `deno task supabase`:

```bash
deno task supabase status       # what is running
deno task supabase db reset     # recreate the database from the migrations
deno task supabase stop         # stop the stack (data is kept in a Docker volume)
deno task serve                 # serve the function with hot reload while you edit it
deno task gen:types             # after a migration: regenerate the adapter's row types
```

`deno task serve` replaces the stack's Edge Runtime with one that reloads on
every change; stopping it removes that container, so run
`deno task supabase stop` before the next `deno task start`.

## Test it

```bash
deno task test        # the Hono app (in memory)
deno task check       # deno check, deno lint, deno fmt --check

# with the stack running (deno task start):
(cd ../database/typescript-supabase && deno task test)   # the storage adapter
cd .. && API_URL=http://127.0.0.1:54321/functions/v1/api yarn workspace @cero/contract-tests suite
```

From the repository root, `yarn contract typescript-supabase` runs
`deno task start` and the shared contract suite in one go.

## What a real deploy needs

1. A Supabase project, then `deno task supabase login` and
   `deno task supabase link --project-ref <ref>`.
2. `deno task supabase db push` applies the migrations.
3. `deno task supabase functions deploy api` bundles the function with every
   file its import map reaches (the core and the adapter included) and keeps
   `verify_jwt = false` from `config.toml`. `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform: no secrets to set.
   A project that only has the new API keys exposes them as
   `SUPABASE_SECRET_KEYS` instead; read the secret key from there.
4. Decide who may call it. As in every stack of this repository, the API has no
   users: anyone with the URL can change the data. A real app keeps
   `verify_jwt = true`, creates the supabase-js client with the caller's JWT
   instead of the service role key, and writes RLS policies per user (for
   example `user_id = auth.uid()`), so Postgres enforces ownership.

## On a restricted network

The defaults assume open internet access. Two things can fail behind a firewall
or a TLS-intercepting proxy:

- **Images.** The CLI pulls from `public.ecr.aws`, then `ghcr.io`, then Docker
  Hub, and uses a local image first. `SUPABASE_INTERNAL_IMAGE_REGISTRY`
  rewrites every image to `<registry>/supabase/<name>`, which only works with a
  mirror of Supabase's own namespace (`mirror.gcr.io` lacks `supabase/kong`).
  Pulling from a Docker Hub mirror under the original names works:

  ```bash
  for image in supabase/postgres:17.11.0.004 postgrest/postgrest:v16.4 \
      supabase/edge-runtime:v1.77.4 library/kong:2.8.1 supabase/postgres-meta:v0.100.0; do
    docker pull "mirror.gcr.io/$image" && docker tag "mirror.gcr.io/$image" "$image"
  done
  ```

  `deno task supabase services` lists the versions a CLI release expects
  (Kong excepted); `postgres-meta` is only needed by `gen:types`.
- **The Edge Runtime's downloads.** The function's dependencies (jsr.io, npm)
  are fetched inside the container when it boots. Behind a proxy that re-signs
  TLS, boot fails with `invalid peer certificate: UnknownIssuer`. The runtime's
  module loader trusts the system store when `DENO_TLS_CA_STORE=system`, so a
  local image with the same tag and the proxy's CA fixes it:

  ```dockerfile
  FROM mirror.gcr.io/supabase/edge-runtime:v1.77.4
  COPY proxy-ca.crt /etc/ssl/certs/proxy-ca.crt
  ENV DENO_TLS_CA_STORE=system SSL_CERT_FILE=/etc/ssl/certs/proxy-ca.crt
  ```

  ```bash
  docker build -t supabase/edge-runtime:v1.77.4 .
  ```

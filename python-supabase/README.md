# python-supabase

The Cero API on **Supabase**, in Python: the app of
[`python-fastapi`](../python-fastapi), unchanged, storing data in Supabase
Postgres through [`cero-supabase`](../database/python-supabase). It runs on the
local Supabase stack, with no Supabase account.

## The Supabase paradigm, from Python

```
client ──HTTP──► FastAPI :8002 (python-fastapi's app) → core → supabase-py
                                                                  │ HTTP + service role key
                 Kong :55321 ◄─────────────/rest/v1───────────────┘
                   └──► PostgREST ──SQL──► Postgres :55322 (RLS on, no policies)
```

- **The API runs beside Supabase, not inside it.** Edge Functions are Deno
  only (that is [`typescript-supabase`](../typescript-supabase)), so a Python
  API is an ordinary server that uses Supabase as its backend.
- **The database is an HTTP API.** The app writes no SQL and holds no
  database connection: supabase-py turns `.table("tasks").select(...).eq(...)` into
  a request to PostgREST, which generates the REST API from the schema.
- **Row Level Security decides who sees what.** PostgREST publishes every table
  to anyone holding the public anon key. The
  [migration](supabase/migrations/20261006000000_create_tasks_and_focus_sessions.sql)
  enables RLS with no policy, so the anon and authenticated roles see nothing.
  The API uses the **service role key**, which bypasses RLS: the API is the
  only way in, and it applies the business rules.
- **Configuration as code.** [`supabase/config.toml`](supabase/config.toml)
  describes the local stack (and, once linked, the hosted project); migrations
  are plain SQL files applied in order.

## What this stack shows

- **Reuse instead of a new HTTP layer.** python-fastapi's `create_app(open_storage)`
  takes any async context manager that yields repositories, so the whole app is
  one line of [`main.py`](src/cero_supabase_api/main.py):
  `create_app(partial(open_supabase_storage, url, service_role_key))`. Routes,
  validation and error handling are python-fastapi's; only the storage differs.
- **Only what the API needs.** Studio, Auth, Storage, Realtime, analytics, the
  Edge Runtime, the mail catcher and the pooler are switched off: the stack is
  Postgres, PostgREST and Kong. The ports are in the 553xx block and the
  project is `cero-python`, so it runs next to typescript-supabase's stack (543xx).
- **A service role key with Auth switched off.** Without Auth, `supabase status`
  prints no keys, but PostgREST still checks JWTs against the stack's secret.
  Every local stack signs with the same public development secret, so its
  well-known service role key works; the
  [settings](src/cero_supabase_api/settings.py) default to it, as a `SecretStr`
  that never shows up in a log.
- **Settings are validated** by pydantic-settings: `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY`, from the environment or a `.env` file.

## Where things live

```
python-supabase/
├── src/cero_supabase_api/
│   ├── main.py               composition root: settings → Supabase storage → python-fastapi's app
│   └── settings.py           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (defaults: the local stack)
├── tests/test_supabase_api.py   the app is served over Supabase
└── supabase/
    ├── config.toml           local stack: project cero-python, ports 553xx, only what the API needs
    └── migrations/           the schema of database/postgres/schema.sql, plus RLS
```

The HTTP layer lives in [`python-fastapi`](../python-fastapi), the business
rules in [`shared/python-core`](../shared/python-core) and the storage in
[`database/python-supabase`](../database/python-supabase).

## Run it locally

Needs Docker, uv and Node: the Supabase CLI is an npm package, and `npx` runs
the pinned version without installing it. The first start pulls the images.
From the repository root:

```bash
uv sync
cd python-supabase
npx supabase@2.120.0 start          # on a fresh database, applies the migrations
uv run fastapi run --port 8002      # `uv run fastapi dev --port 8002` reloads on changes
```

The API listens on http://localhost:8002, with interactive docs at
http://localhost:8002/docs.

| Service                       | Address                                                   |
| ----------------------------- | --------------------------------------------------------- |
| Kong: PostgREST at `/rest/v1` | http://127.0.0.1:55321                                    |
| Postgres                      | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` |

```bash
npx supabase@2.120.0 status         # what is running
npx supabase@2.120.0 db reset       # recreate the database from the migrations
npx supabase@2.120.0 stop           # stop the stack (data is kept in a Docker volume)
```

## Test it

With the stack running, from the repository root:

```bash
uv run pytest python-supabase               # the app is served over Supabase
uv run pytest database/python-supabase      # the storage adapter (empties the tables)
yarn contract python-supabase               # the shared API contract, end to end
```

`yarn contract` starts the stack and the API; it stops the API afterwards but
leaves the stack running, like typescript-supabase's.

## What a real deploy needs

1. A Supabase project, then `npx supabase@2.120.0 login`,
   `npx supabase@2.120.0 link --project-ref <ref>` and
   `npx supabase@2.120.0 db push` to apply the migrations.
2. A host for the FastAPI app (a container, Cloud Run, Fly.io, ...) with
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set as secrets, from the
   project's API settings. The key must never reach a browser.
3. A decision about access. As in every stack of this repository, the API has
   no users: anyone with the URL can change the data. A real app would
   authenticate callers, create the supabase-py client with the caller's JWT
   instead of the service role key, and write RLS policies per user.

## On a restricted network

The CLI uses a local image when there is one. If its registries are out of
reach, pull this stack's images from a Docker Hub mirror and retag them, as
[typescript-supabase](../typescript-supabase/README.md#on-a-restricted-network)
explains:

```bash
for image in supabase/postgres:17.11.0.004 postgrest/postgrest:v16.4 library/kong:2.8.1; do
  docker pull "mirror.gcr.io/$image" && docker tag "mirror.gcr.io/$image" "$image"
done
```

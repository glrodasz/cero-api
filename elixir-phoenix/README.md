# elixir-phoenix

The Cero API on **Phoenix 1.8**, storing data in Postgres through **Ecto**.

Phoenix is the only Elixir framework in this repository, so there is no shared
Elixir core: the business rules live in Phoenix **contexts**, the framework's
own boundary between the domain and the web (see [`shared/README.md`](../shared/README.md)).
They port [`shared/typescript-core`](../shared/typescript-core) rule for rule.

> **How this was verified.** Hex (`repo.hex.pm`, `builds.hex.pm`) was blocked by
> the network policy where this stack was written, so `mix deps.get` never ran
> and there is **no `mix.lock` yet**. The code was instead compiled with
> `--warnings-as-errors`, checked with `mix format`, tested with `mix test` and
> run against the shared contract suite inside the official Elixir 1.20.4 /
> OTP 28 image (tests also on Elixir 1.17.3 / OTP 27), with every dependency at
> the version `mix.exs` resolves to, built from its GitHub sources. To verify
> it with Hex, run the commands below (`mix setup`, `mix test`,
> `mix phx.server`, the contract suite) and commit the `mix.lock` that
> `mix setup` creates.

## What this stack shows

- **Contexts hold the rules.** [`Cero.Tasks`](lib/cero/tasks.ex) and
  [`Cero.FocusSessions`](lib/cero/focus_sessions.ex) have one function per
  endpoint and know nothing about HTTP. The pure rules sit next to the data, in
  the schemas: [`Task`](lib/cero/tasks/task.ex) (the 3-in-progress cap,
  renumbering) and [`FocusSession`](lib/cero/focus_sessions/focus_session.ex)
  (pausing, resuming, finishing).
- **Tagged tuples and `with`.** Every function answers `{:ok, value}`,
  `{:error, %Ecto.Changeset{}}` for an invalid request, or `{:error, reason}`:
  `:task_not_found`, `:focus_session_not_found`, `:no_current_focus_session`,
  `:cannot_pause`, `:cannot_resume`. Steps compose with `with`, and validation
  runs before any lookup, so an invalid request about a missing task is a 400.
- **Changesets validate.** Bodies are cast by changesets: schema-backed
  (`Task.changes_changeset/1`) or schemaless for requests that are not a schema
  (`FocusSessions.start/2`, `pause_current/2`). `Ecto.Enum` maps statuses to the
  strings the API speaks.
- **`Ecto.Multi` when several rows change.** Completing or resetting a task
  rewrites its whole group in one transaction; starting a session inserts it and
  attaches its tasks; finishing it releases them.
- **Embedded schemas.** [`Pause`](lib/cero/focus_sessions/pause.ex) is an
  `embeds_many` stored in a jsonb column, under the API's key names (`source:`).
- **`action_fallback`.** Controller actions only handle success; whatever else a
  context answers goes to [`FallbackController`](lib/cero_web/controllers/fallback_controller.ex),
  which turns reasons into 404 with the canonical message and changesets into 400.
- **JSON views.** [`TaskJSON`](lib/cero_web/controllers/task_json.ex) and
  [`FocusSessionJSON`](lib/cero_web/controllers/focus_session_json.ex) render
  the contract's camelCase shapes; [`CeroWeb.Params`](lib/cero_web/params.ex)
  maps camelCase fields to the contexts' names and drops anything else.
- **Errors Phoenix handles itself** (an unknown route, a crash) render through
  [`ErrorJSON`](lib/cero_web/controllers/error_json.ex), as `{"message": ...}`.
  `debug_errors` is off even in development, so a 500 never shows internals.
- **Plugs.** The endpoint is a pipeline of plugs. A body that is not JSON is
  answered by [`JSONBodyParser`](lib/cero_web/json_body_parser.ex), a wrapper
  around `Plug.Parsers`: left to Phoenix, the parse error would be re-raised
  after its 400, and Bandit closes the connection after any exception, which
  breaks the next request of a client that keeps connections alive.
- **Time is an argument.** Functions that read the clock take a `now:` option
  (epoch milliseconds); tests pass it, the API leaves it to the system clock.
- **The SQL sandbox.** Every test runs inside a transaction that is rolled
  back, so context and controller tests run concurrently on the real database.

It is `mix phx.new cero --no-html --no-assets --no-mailer --no-dashboard
--no-gettext --no-live --binary-id --database postgres`, trimmed to a JSON API:
no PubSub, sessions, static files, DNS clustering or seeds, and a JSON-only
body parser.

Two Phoenix defaults stay, so the API is slightly more lenient or strict than
the TypeScript reference in cases the contract does not cover: Ecto casts a
numeric string such as `"42"` to an integer, and the `:api` pipeline answers
406 to a client that accepts only non-JSON responses.

## Where things live

```
lib/
├── cero/
│   ├── application.ex                  supervision tree: telemetry, Repo, endpoint
│   ├── repo.ex                         Ecto repo, plus fetch/2 (malformed ids are not found)
│   ├── validations.ex                  validate_not_null/2
│   ├── tasks.ex                        context: list, get, create, complete, reset, change_status, update, delete
│   ├── tasks/task.ex                   schema, changesets, pure rules, composable queries
│   ├── focus_sessions.ex               context: list, get_current, start, finish(_current), pause(_current), resume(_current)
│   └── focus_sessions/
│       ├── focus_session.ex            schema and the pause rules, as changesets
│       └── pause.ex                    embedded schema
├── cero_web.ex                         `use CeroWeb, :controller | :router`
└── cero_web/
    ├── endpoint.ex                     plugs: request id, telemetry, JSON parser, router
    ├── json_body_parser.ex             Plug.Parsers, answering a malformed body with a 400
    ├── router.ex                       routes, in matching order
    ├── params.ex                       camelCase API fields → context fields
    ├── telemetry.ex                    metrics and the poller
    └── controllers/                    controllers, *JSON views, fallback, error rendering
priv/repo/migrations/                   database/postgres/schema.sql as Ecto migrations
test/
├── cero/                               context tests (shared/core-test-plan.md) and storage tests
├── cero_web/                           controller, routing and error-handling tests
└── support/                            DataCase, ConnCase, fixtures
```

The tables match [`database/postgres/schema.sql`](../database/postgres/schema.sql),
except that the creation timestamp is called `inserted_at`, as in Ecto.

## Run it

You need Elixir ≥ 1.17 and network access to Hex. From the repository root:

```bash
docker compose up -d postgres
cd elixir-phoenix
mix setup          # deps.get, then creates and migrates the cero_phoenix database
mix phx.server
```

The API listens on http://localhost:4000. `PORT` and `DATABASE_URL` override
the defaults; `STORAGE` may only be `postgres`.

## Test it

```bash
mix test           # contexts, controllers and error handling, on cero_phoenix_test
mix precommit      # compile with warnings as errors, format, test
```

With the server running, the shared contract suite (from the repository root):

```bash
API_URL=http://127.0.0.1:4000 yarn workspace @cero/contract-tests suite
```

The context tests follow [`shared/core-test-plan.md`](../shared/core-test-plan.md)
case by case. Phoenix has no repository port, so instead of the repository
contract, [`test/cero/storage_test.exs`](test/cero/storage_test.exs) checks the
cases that describe Postgres: malformed ids, ordering, pauses round-tripping
through jsonb.

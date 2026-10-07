# @cero/supabase

Supabase storage for [`@cero/core`](../../shared/typescript-core), built on
**supabase-js**: every query is an HTTP request to PostgREST, over the tables
of [`database/postgres/schema.sql`](../postgres/schema.sql). A Deno module,
used by the [`typescript-supabase`](../../typescript-supabase) Edge Function.

- [`src/database.types.ts`](src/database.types.ts): the row types, generated
  from the local database by `supabase gen types` (`deno task gen:types` in
  `typescript-supabase/`). `createClient<Database>` uses them to type every
  query, down to the columns a `select` returns.
- [`src/rows.ts`](src/rows.ts): rows are snake_case (`focus_session_id`,
  `task_ids`), the domain is camelCase; every value crosses this explicit
  mapping. Pauses are stored as jsonb inside their session.
- [`src/SupabaseTaskRepository.ts`](src/SupabaseTaskRepository.ts) and
  [`src/SupabaseFocusSessionRepository.ts`](src/SupabaseFocusSessionRepository.ts):
  the two ports. Lists are ordered by `priority`, then `created_at`. Each query
  ends in `throwOnError()`, because supabase-js otherwise returns failures as
  `{ error }` and a broken database must not look like an empty one.
- [`src/uuid.ts`](src/uuid.ts): ids are uuid columns, and PostgREST answers
  400 (Postgres error 22P02) when a filter compares one with a malformed id.
  Such an id cannot match a row, so it is filtered out before the request.
- `createServiceRoleClient(url, key)` builds the client for trusted server code:
  the service role key bypasses Row Level Security.

## Test it

The test runs the core's repository contract against the local Supabase stack.
The contract is written with `node:test`, and Deno implements `node:test`
(`describe`, `it` and their hooks), so it runs unchanged under `deno test`:
each case shows up as a test step.

```bash
(cd ../../typescript-supabase && deno task supabase start)
deno task test      # empties the tables, like `supabase db reset` would
deno task check     # deno check, deno lint, deno fmt --check
```

It defaults to the local stack and its well-known development key; set
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to point it elsewhere (and
widen `--allow-net` in [`deno.json`](deno.json) accordingly).

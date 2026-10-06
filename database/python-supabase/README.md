# cero-supabase

Supabase storage for [`cero-core`](../../shared/python-core), built on
**supabase-py**'s async client: every query is an HTTP request to PostgREST,
over the tables of [`database/postgres/schema.sql`](../postgres/schema.sql).
Used by [`python-supabase`](../../python-supabase).

- [`src/cero_supabase/rows.py`](src/cero_supabase/rows.py): rows are snake_case
  (`focus_session_id`, `task_ids`), the domain has its own names; every value
  crosses this explicit mapping. `TypedDict`s describe the columns the
  repositories select and write. Pauses are stored as jsonb inside their session.
- [`src/cero_supabase/task_repository.py`](src/cero_supabase/task_repository.py) and
  [`focus_session_repository.py`](src/cero_supabase/focus_session_repository.py):
  the two ports, written with postgrest-py's query builder
  (`.select(...).in_(...).order("priority").order("created_at")`). Lists are
  ordered by `priority`, then `created_at`. Counting sends a HEAD request
  (`count=CountMethod.exact, head=True`), writes ask for `return=minimal`.
- **Failures raise.** Unlike supabase-js, which returns `{ data, error }`,
  postgrest-py raises `APIError` for every request PostgREST refuses, so a
  broken database reaches the API as a 500, never as an empty list.
- [`src/cero_supabase/ids.py`](src/cero_supabase/ids.py): ids are uuid
  columns, and PostgREST answers 400 (Postgres error 22P02) when a filter
  compares one with a malformed id. Such an id cannot match a row, so it is
  dropped before the request.
- `open_supabase_storage(url, service_role_key)` is an async context manager
  that yields the repositories. Its client uses the **service role key**,
  which bypasses Row Level Security, and one httpx client that is closed
  when the block ends.

## Test it

The tests run the core's repository contract against python-supabase's local
Supabase stack. Like `supabase db reset`, they empty the tables, so local data
does not survive a test run:

```bash
(cd python-supabase && npx supabase@2.120.0 start)    # from the repository root
uv run pytest database/python-supabase
```

They default to the local stack and its well-known development key;
`SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` point them elsewhere.
`SKIP_DATABASE_TESTS=1` skips them.

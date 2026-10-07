# go-postgres

PostgreSQL storage for [`go-core`](../../shared/go-core), built on
[pgx](https://github.com/jackc/pgx) v5 and hand-written SQL. Used by
[`go-gin`](../../go-gin) and [`go-fiber`](../../go-fiber).

- **Plain SQL, mapped by name.** Each query selects columns named (or aliased)
  after the fields of the core's types, so `pgx.CollectRows` with
  `pgx.RowToStructByName` fills `core.Task` and `core.FocusSession` directly
  ([`task_repository.go`](task_repository.go),
  [`focus_session_repository.go`](focus_session_repository.go)).
- **One static query per filter.** `FindMany` sends each criterion that is not
  set as `NULL` (`@ids::uuid[] IS NULL OR id = ANY(@ids)`), with `pgx.NamedArgs`.
- **Malformed ids are "not found".** Ids are UUIDs; anything else is turned
  away before it reaches Postgres, which would answer it with an error.
- **Pauses are a `jsonb` column** of their session; pgx marshals `[]core.Pause`
  with its JSON tags.
- **Migrations travel inside the binary.** [goose](https://github.com/pressly/goose)
  reads [`migrations/`](migrations) from an `embed.FS`, and `Connect` applies
  them on startup ([`migrate.go`](migrate.go)). The first migration is
  [`database/postgres/schema.sql`](../postgres/schema.sql).
- `Connect(ctx, databaseURL)` returns a `*pgxpool.Pool` for an app's `main`;
  `NewRepositories(pool)` wraps it for the core ([`postgres.go`](postgres.go)).

## Test it

The tests run the core's repository contract against a real PostgreSQL, in
the `cero_go_test` database (override with `TEST_DATABASE_URL`):

```bash
docker compose up -d postgres     # from the repository root
cd database/go-postgres
go test ./...                     # SKIP_DATABASE_TESTS=1 skips them
```

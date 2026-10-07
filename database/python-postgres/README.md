# cero-postgres

Postgres storage for [`cero-core`](../../shared/python-core), built on the
SQLAlchemy 2 async ORM and asyncpg. Used by `python-fastapi` and `python-graphql`
when `STORAGE=postgres`.

- [`src/cero_postgres/records.py`](src/cero_postgres/records.py): the tables of
  [`../postgres/schema.sql`](../postgres/schema.sql) as typed `Mapped[...]` models.
- [`migrations/`](migrations): Alembic (async template). The first revision
  creates exactly the reference schema; `alembic check` proves the models agree.
- [`src/cero_postgres/task_repository.py`](src/cero_postgres/task_repository.py) and
  [`focus_session_repository.py`](src/cero_postgres/focus_session_repository.py):
  the two ports. Each method opens its own session, so the core can run several
  at once (`asyncio.gather`). Ids that are not UUIDs are "not found", never an error.
- `open_postgres_storage(url)` is an async context manager that yields the
  repositories and disposes of the connection pool when the app stops.

## Migrate

Migrations run explicitly, never at app startup. From this folder:

```bash
docker compose up -d postgres         # from the repository root
uv run alembic upgrade head           # DATABASE_URL defaults to .../cero_python
uv run alembic upgrade head --sql     # or just print the SQL
```

`DATABASE_URL` uses the asyncpg driver:
`postgresql+asyncpg://root:root@127.0.0.1:5432/cero_python`.

## Test it

The tests migrate the `cero_python_test` database (`DATABASE_TEST_URL`) and run
the core's repository contract against it:

```bash
uv run pytest database/python-postgres      # from the repository root
```

`SKIP_DATABASE_TESTS=1` skips them.

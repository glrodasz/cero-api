# cero-mongodb

MongoDB storage for [`cero-core`](../../shared/python-core), built on PyMongo's
native async API (`AsyncMongoClient`; Motor is deprecated). Used by
`python-fastapi` and `python-graphql` when `STORAGE=mongodb`.

- [`src/cero_mongodb/documents.py`](src/cero_mongodb/documents.py): the document
  shape as `TypedDict`s. It is the shape of
  [`typescript-mongoose`](../typescript-mongoose/src/schemas.ts) (collections
  `tasks` and `focus_sessions`, camelCase fields, pauses embedded with a string
  `id`, no `__v`), so TypeScript and Python stacks can share a database.
- [`src/cero_mongodb/task_repository.py`](src/cero_mongodb/task_repository.py) and
  [`focus_session_repository.py`](src/cero_mongodb/focus_session_repository.py):
  the two ports. ObjectIds grow with time, so sorting by `_id` is sorting by
  creation. Ids that are not ObjectIds are "not found", never an error.
- `open_mongodb_storage(uri)` is an async context manager that yields the
  repositories (over the database named in the URI) and closes the client.

## Test it

The tests run the core's repository contract against a throwaway
`cero_python_test` database (`MONGODB_TEST_URI`), dropped after each test:

```bash
docker compose up -d mongo                  # from the repository root
uv run pytest database/python-mongodb
```

`SKIP_DATABASE_TESTS=1` skips them.

# cero-firestore

Firestore storage for [`cero-core`](../../shared/python-core), built on
**google-cloud-firestore**'s `AsyncClient`. Used by
[`python-firebase`](../../python-firebase).

- [`src/cero_firestore/documents.py`](src/cero_firestore/documents.py): the
  document shape, as `TypedDict`s, and the functions that turn snapshots into
  domain objects and back. It is the shape of
  [`typescript-firestore`](../typescript-firestore/src/converters.ts):
  collections `tasks` and `focus_sessions`, camelCase fields, pauses embedded,
  the id is the document's own, and a `createdAt` server timestamp
  (`SERVER_TIMESTAMP`), because Firestore ids are random and lists are ordered
  by creation. TypeScript and Python stacks can share a database.
- [`src/cero_firestore/task_repository.py`](src/cero_firestore/task_repository.py) and
  [`focus_session_repository.py`](src/cero_firestore/focus_session_repository.py):
  the two ports. Some Firestore idioms worth a look:
  - tasks asked for by id are fetched by key with `get_all(references)` in one round trip;
  - `count_by_status` is an aggregation query (`count()`), which downloads no documents;
  - `save` uses `update`, which refuses missing documents (`NotFound`), so it never creates one;
  - `assign_focus_session` runs in an `@async_transactional` function that only
    touches tasks that exist.
- [`src/cero_firestore/document_ids.py`](src/cero_firestore/document_ids.py): an
  id Firestore cannot store (empty, containing `/`, ...) is "not found", as the
  port asks, instead of an error.
- `open_firestore_storage()` is an async context manager that yields the
  repositories over a new client. The client finds its project and credentials
  in the environment, and talks to the emulator, without credentials, whenever
  `FIRESTORE_EMULATOR_HOST` is set.

**Async clients belong to one event loop.** The client opens its gRPC channel
on its first request and stays bound to the loop running then. An app opens
storage in its lifespan and serves every request on the same loop, so one
client serves them all; the tests, where every test has a loop of its own,
create one client per test. The client has no `close()`: its channel goes
away with it.

## Indexes

The list queries filter on one field and sort on two (`priority`, then
`createdAt`), which production Firestore only answers with composite indexes.
They are declared in
[`python-firebase/firestore.indexes.json`](../../python-firebase/firestore.indexes.json),
next to the `firebase.json` that deploys them. The emulator needs no indexes.

## Test it

The tests run the core's repository contract against the Firestore emulator,
in a `demo-cero-python-test` project of their own:

```bash
# in another terminal: the emulators of python-firebase (see its README)
uv run pytest database/python-firestore
```

`FIRESTORE_EMULATOR_HOST` defaults to `127.0.0.1:8181`. `SKIP_DATABASE_TESTS=1` skips them.

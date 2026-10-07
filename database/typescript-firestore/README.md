# @cero/firestore

Firestore storage for [`@cero/core`](../../shared/typescript-core), built on
the Firebase Admin SDK. Used by [`typescript-firebase`](../../typescript-firebase).

- [`src/converters.ts`](src/converters.ts): the document shape (collections
  `tasks` and `focus_sessions`, pauses embedded, the id is the document's own)
  and the `FirestoreDataConverter`s that turn documents into domain objects.
  Each document also stores a `createdAt` server timestamp: Firestore ids are
  random, so that is what lists are ordered by.
- [`src/FirestoreTaskRepository.ts`](src/FirestoreTaskRepository.ts) and
  [`src/FirestoreFocusSessionRepository.ts`](src/FirestoreFocusSessionRepository.ts):
  the two ports. Some Firestore idioms worth a look:
  - tasks asked for by id are fetched by key with `getAll(refs)` in one round trip;
  - `countByStatus` is an aggregation query (`count()`), which downloads no documents;
  - `save` uses `update`, which refuses missing documents, so it never creates one;
  - `assignFocusSession` runs in a transaction that only touches tasks that exist.
- [`src/documentIds.ts`](src/documentIds.ts): an id Firestore cannot store
  (empty, containing `/`, ...) is "not found", as the port asks, instead of an error.
- `createFirestoreRepositories(firestore)` returns the repositories for an app's
  composition root.

## Indexes

The list queries filter on one field and sort on two (`priority`, then
`createdAt`), which production Firestore only answers with composite indexes.
They are declared in
[`typescript-firebase/firestore.indexes.json`](../../typescript-firebase/firestore.indexes.json),
next to the `firebase.json` that deploys them (the Firebase CLI only reads
files inside its project directory). The emulator needs no indexes.

## Test it

The tests run the core's repository contract against the Firestore emulator,
in a `demo-cero-test` project of their own:

```bash
yarn workspace typescript-firebase emulators     # in another terminal
yarn workspace @cero/firestore test
```

`FIRESTORE_EMULATOR_HOST` defaults to `127.0.0.1:8180`.

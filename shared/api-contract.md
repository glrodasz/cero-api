# API contract

Every REST implementation in this repository serves exactly this API. The
black-box suite in [`contract-tests/`](./contract-tests) checks it, so any
stack can be swapped for another without the client noticing.

The GraphQL implementations expose the same behaviour through
[`graphql/schema.graphql`](./graphql/schema.graphql).

## Conventions

- JSON in, JSON out. Field names are `camelCase`.
- Ids are opaque strings (ObjectId, UUID or Firestore id, depending on the storage).
- Times are **epoch milliseconds** (`number`).
- Errors always have the shape `{ "message": string }`.
- A malformed id behaves exactly like an unknown id: `404`.
- Validation comes first: a request that is both invalid and aimed at a
  missing resource gets the `400`.

| Status | When |
| --- | --- |
| `200` | Success |
| `201` | Something was created (`POST`) |
| `400` | The request is invalid: wrong body shape, wrong types, unknown status, malformed JSON |
| `404` | The resource does not exist, the route does not exist, or a session is not in a state that allows the action |
| `500` | Anything unexpected. The body is `{ "message": "Internal server error" }`, never internals |

`404` messages are canonical (see the tables below) and identical in every
stack. `400` messages are free text, so each framework can use its own
validation idiom.

## Resources

```ts
type TaskStatus = "in-progress" | "pending" | "completed";

type Task = {
  id: string;
  description: string;
  priority: number;              // 0 = top of its group
  status: TaskStatus;
  focusSessionId: string | null; // the session the task is being worked on in
};

type FocusSessionStatus = "active" | "paused" | "finished";

type Pause = {
  id: string;
  startTime: number;
  endTime: number | null; // null while the pause is open
  time: number;           // duration in ms once closed (or the value sent to PATCH /pause)
};

type FocusSession = {
  id: string;
  status: FocusSessionStatus;
  startTime: number;
  tasks: string[];        // ids of the tasks the session started with
  pauses: Pause[];        // oldest first; only the last one can be open
};
```

**Current session**: the newest session whose status is `active` or `paused`.
Several sessions may be current at once (nothing forbids starting a second
one); the newest wins.

## Tasks — `/tasks`

| Method & path | Body | Behaviour | Errors |
| --- | --- | --- | --- |
| `GET /tasks` | | If there is a current session, its tasks. Otherwise every `in-progress` and `pending` task. Sorted by `priority` ascending, then creation order. | |
| `GET /tasks/:id` | | The task. | 404 `Task not found` |
| `POST /tasks` | `{ description: string }` | Creates the task with `priority: 0`, `status: "in-progress"` while fewer than **3** tasks are in progress (otherwise `"pending"`), and `focusSessionId` set to the current session (or `null`). Returns **201**. | 400 if `description` is not a string |
| `PATCH /tasks/:id/complete` | | The other `completed` tasks are renumbered `1..n` (keeping their order) and this task becomes `completed` with `priority: 0`. | 404 `Task not found` |
| `PATCH /tasks/:id/reset` | | Same as complete, for the `pending` group. | 404 `Task not found` |
| `PATCH /tasks/:id/:status` | | Sets the status only. | 400 if `:status` is not a task status; 404 `Task not found` |
| `PATCH /tasks/:id` | `Partial<{ description, priority, status, focusSessionId }>` | Updates the given fields. `id` in the body is ignored, unknown fields are ignored. | 400 on wrong types, unknown status, or a `focusSessionId` that does not exist; 404 `Task not found` |
| `DELETE /tasks/:id` | | Deletes the task and returns it. | 404 `Task not found` |

Route order matters: `complete` and `reset` win over `:status`.

## Focus sessions — `/focus-sessions`

| Method & path | Body | Behaviour | Errors |
| --- | --- | --- | --- |
| `GET /focus-sessions` | | Every session, oldest first. | |
| `GET /focus-sessions/active` | | The current session with `startTime` moved forward by the total duration of its **closed** pauses, or `{}` when there is none. | |
| `POST /focus-sessions` | `{ tasks?: string[], startTime?: number }` | Starts an `active` session. `tasks` keeps the requested ids that exist, in request order; when missing or empty it defaults to every `in-progress`/`pending` task. `startTime` defaults to now. Every included task gets `focusSessionId` = the new session. Returns **201**. | 400 if `tasks` is not an array of strings or `startTime` is not a number |
| `PATCH /focus-sessions/finish` | | Finishes the current session (see *Finishing*). | 404 `No active focus session found` |
| `PATCH /focus-sessions/:id/finish` | | Finishes that session. | 404 `Focus session not found` |
| `PATCH /focus-sessions/:id/pause` | | Only an `active` session: appends an open pause and becomes `paused`. | 404 `Focus session not found or cannot be paused` |
| `PATCH /focus-sessions/pause` | `{ time?: number }` | On the current session: if a pause is open and no `time` is given, nothing changes. Otherwise any open pause is closed and a new open pause is appended with `time` (default `0`); status becomes `paused`. | 400 if `time` is not a number; 404 `No active focus session found` |
| `PATCH /focus-sessions/resume` | | On the current session: closes the open pause and becomes `active`. Without an open pause nothing changes. | 404 `No active focus session found` |
| `PATCH /focus-sessions/:id/resume` | | Only a `paused` session: closes the open pause and becomes `active`. | 404 `Focus session not found or cannot be resumed` |

**Closing a pause** sets `endTime` to now and `time` to `endTime - startTime`.

**Finishing** closes the open pause (if any), sets the status to `finished`,
and detaches the session's `in-progress` and `pending` tasks
(`focusSessionId: null`). Completed tasks keep their session as history.

## Other routes

Any other route answers `404 { "message": "Not found" }`.

## Differences from the original Express implementation

The first implementation (`typescript-express`, before the shared core) had a
few accidental behaviours that this contract normalises:

1. Finishing a session cleared `focusSessionId` to `""`; it is now `null`.
2. `complete`, `reset`, `update` and `delete` changed other tasks before
   checking that the target existed; a `404` now has no side effects.
3. Renumbering followed storage order; it now follows the current priority
   order, with ties broken by creation order.
4. "The current session" was an arbitrary match; it is now the newest.
5. `PATCH /focus-sessions/finish` detached *every* in-progress/pending task;
   both finish routes now detach only the finished session's tasks.
6. Unknown statuses on `PATCH /tasks/:id` were a `500`; they are a `400`.
7. `POST /focus-sessions` stored unknown task ids; they are now dropped.
8. `500` responses leaked `err.message`; they are now generic.

# Core test plan

Every `shared/<language>-core` implements these tests with its language's
native runner, using the same case names (adapted to the language's naming
style) so the suites can be compared side by side.

The reference implementation is
[`typescript-core/test`](./typescript-core/test). When in doubt, port from it.

All service tests run against the core's **in-memory repositories** and a
**manual clock** (start at `1_000_000`, advance by hand). They never sleep.

## TasksService

**list**
- lists in-progress and pending tasks by priority when no session is current
- lists the current session's tasks, completed ones included
- keeps creation order between tasks with the same priority

**get**
- fails with NotFound for an unknown id

**create**
- starts tasks in progress until three are in progress, then as pending
- creates the task at priority 0 without a session when none is current
- attaches the task to the current session

**complete**
- puts the task on top of the completed group and renumbers the rest
- changes nothing when the task does not exist

**reset**
- puts the task on top of the pending group and renumbers the rest

**changeStatus**
- sets only the status
- rejects an unknown status before looking the task up

**update**
- changes only the given fields
- rejects an unknown status
- rejects a focusSessionId that does not match a session

**delete**
- removes the task and returns it
- fails with NotFound for an unknown id

## FocusSessionsService

**start**
- starts an active session with every in-progress and pending task by default
- keeps requested tasks in request order, dropping unknown and repeated ids
- uses the given start time

**getCurrent**
- returns null when no session is current
- moves startTime forward by the closed pauses only
- returns the newest current session

**pause**
- opens a pause on an active session
- refuses sessions that are not active

**pauseCurrent**
- fails when no session is current
- opens a pause on an active session
- leaves an already paused session as is when no time is given
- closes the open pause and opens a new one with the given time

**resume**
- closes the open pause of a paused session
- refuses sessions that are not paused

**resumeCurrent**
- closes the open pause of the current session
- leaves a session without an open pause as is
- fails when no session is current

**finish**
- closes the open pause and releases the unfinished tasks only
- fails with NotFound for an unknown id

**finishCurrent**
- finishes the current session
- fails when no session is current

## Repository contract

Each core also ships the storage contract as a reusable test suite
(TypeScript: `testRepositoryContract` in `@cero/core/testing`). The in-memory
adapter runs it in the core's own tests, and **every database adapter runs the
same suite** against a real database.

**tasks**
- assigns an id on create and finds the task by it
- finds nothing for unknown or malformed ids
- sorts by priority, then creation order
- combines every filter criterion (and `ids: []` matches nothing)
- counts tasks by status
- overwrites a task on save
- assigns and clears the focus session of many tasks at once
- ignores malformed ids on save and delete

**focus sessions**
- assigns an id on create and finds the session by it, pauses included
- lists sessions oldest first
- finds the newest active or paused session as current
- overwrites a session on save

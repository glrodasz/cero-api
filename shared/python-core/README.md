# cero-core (Python)

The domain and use cases of the Cero API, shared by every Python implementation.
No framework, no database: frozen dataclasses, pure functions and two async services.

It ports the [TypeScript reference core](../typescript-core): same services,
same repository ports, same rules, same errors and messages. The words are the
same; the idioms are Python's.

## What this package shows

- **Immutable entities.** `Task` and `FocusSession` are `@dataclass(frozen=True, slots=True)`
  and change through `dataclasses.replace`. Lists inside them are tuples, so the
  [in-memory adapter](src/cero_core/in_memory.py) can store values as they are.
- **`StrEnum` statuses.** `TaskStatus.IN_PROGRESS == "in-progress"`, so they go
  straight into JSON, SQL and BSON.
- **Ports are `Protocol`s.** [`TaskRepository`](src/cero_core/tasks/repository.py)
  and [`FocusSessionRepository`](src/cero_core/focus_sessions/repository.py) are
  structural: an adapter implements the methods, it does not inherit anything.
- **"Only the fields you send" is a `TypedDict(total=False)`.**
  [`TaskChanges`](src/cero_core/tasks/task.py) has a key only for what changes,
  and `replace(task, **changes)` applies it.
- **Pure rules, thin services.** The rules ([`task.py`](src/cero_core/tasks/task.py),
  [`focus_session.py`](src/cero_core/focus_sessions/focus_session.py)) take an
  entity and return a new one; the services load, apply and save.
- **Time is injected.** The clock is a `Callable[[], int]`, so tests move time by hand.
- **The storage contract is a reusable pytest suite.**
  [`cero_core.testing.RepositoryContract`](src/cero_core/testing.py) is an
  abstract test class; each adapter subclasses it and provides one fixture.

## Where things live

```
src/cero_core/
├── __init__.py             public API
├── composition.py          Repositories, Services, create_services(repositories, clock=...)
├── errors.py               NotFoundError, ValidationError, Messages
├── clock.py                Clock and system_clock
├── tasks/
│   ├── task.py             Task, TaskStatus, TaskChanges and the pure rules
│   ├── repository.py       TaskFilter and the TaskRepository port
│   └── service.py          TasksService
├── focus_sessions/
│   ├── focus_session.py    FocusSession, Pause and the pure rules
│   ├── repository.py       the FocusSessionRepository port
│   └── service.py          FocusSessionsService
├── in_memory.py            in-memory adapter          → cero_core.in_memory
└── testing.py              repository contract (pytest) → cero_core.testing
tests/                      the cases of ../core-test-plan.md
```

## Using it

```python
from cero_core import create_services
from cero_core.in_memory import create_in_memory_repositories

services = create_services(create_in_memory_repositories())
await services.tasks.create(description="Write the README")
```

## Writing a storage adapter

Implement the two ports, then prove it with the contract (install `cero-core[testing]`):

```python
from cero_core.testing import RepositoryContract


class TestMyDatabaseRepositories(RepositoryContract):
    @pytest.fixture
    async def repositories(self) -> Repositories:
        return create_my_repositories(await empty_database())
```

See [`database/python-postgres`](../../database/python-postgres) and
[`database/python-mongodb`](../../database/python-mongodb).

## Test it

From the repository root (the Python packages form one [uv workspace](../../pyproject.toml)):

```bash
uv sync
uv run pytest shared/python-core
```

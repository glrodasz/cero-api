from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from cero_core.tasks.task import NewTask, Task, TaskStatus


@dataclass(frozen=True, slots=True, kw_only=True)
class TaskFilter:
    """Every given criterion must match. An empty filter matches every task."""

    ids: Sequence[str] | None = None
    statuses: Sequence[TaskStatus] | None = None
    focus_session_id: str | None = None


class TaskRepository(Protocol):
    """The storage port for tasks. Adapters live in `database/` (Postgres,
    MongoDB, ...) and in `cero_core.in_memory`.

    Contract every adapter honours:
    - a malformed id is simply "not found", it never raises;
    - lists are sorted by priority, then creation order.
    """

    async def find_by_id(self, task_id: str) -> Task | None: ...

    async def find_many(self, task_filter: TaskFilter) -> list[Task]: ...

    async def count_by_status(self, status: TaskStatus) -> int: ...

    async def create(self, task: NewTask) -> Task:
        """Storage assigns the id."""
        ...

    async def save(self, task: Task) -> None:
        """Overwrites the stored task with the same id."""
        ...

    async def delete(self, task_id: str) -> None: ...

    async def assign_focus_session(
        self, task_ids: Sequence[str], focus_session_id: str | None
    ) -> None: ...

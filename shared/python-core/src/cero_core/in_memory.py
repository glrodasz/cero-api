"""Storage adapters that keep everything in memory.

They back the unit tests and let any app run without a database
(`STORAGE=memory`). A dict keeps insertion order, which doubles as creation
order. Entities are frozen dataclasses, so they are stored as they are: no
caller can mutate what is stored.
"""

from collections.abc import Sequence
from dataclasses import replace
from uuid import uuid4

from cero_core.composition import Repositories
from cero_core.focus_sessions.focus_session import (
    CURRENT_SESSION_STATUSES,
    FocusSession,
    NewFocusSession,
)
from cero_core.tasks.repository import TaskFilter
from cero_core.tasks.task import NewTask, Task, TaskStatus


class InMemoryTaskRepository:
    def __init__(self) -> None:
        self._tasks: dict[str, Task] = {}

    async def find_by_id(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    async def find_many(self, task_filter: TaskFilter) -> list[Task]:
        matches = [task for task in self._tasks.values() if _matches(task, task_filter)]
        return sorted(matches, key=lambda task: task.priority)  # stable: ties keep creation order

    async def count_by_status(self, status: TaskStatus) -> int:
        return sum(1 for task in self._tasks.values() if task.status == status)

    async def create(self, task: NewTask) -> Task:
        created = Task(
            id=str(uuid4()),
            description=task.description,
            priority=task.priority,
            status=task.status,
            focus_session_id=task.focus_session_id,
        )
        self._tasks[created.id] = created
        return created

    async def save(self, task: Task) -> None:
        if task.id in self._tasks:
            self._tasks[task.id] = task

    async def delete(self, task_id: str) -> None:
        self._tasks.pop(task_id, None)

    async def assign_focus_session(
        self, task_ids: Sequence[str], focus_session_id: str | None
    ) -> None:
        for task_id in task_ids:
            if (task := self._tasks.get(task_id)) is not None:
                self._tasks[task_id] = replace(task, focus_session_id=focus_session_id)


def _matches(task: Task, task_filter: TaskFilter) -> bool:
    return (
        (task_filter.ids is None or task.id in task_filter.ids)
        and (task_filter.statuses is None or task.status in task_filter.statuses)
        and (
            task_filter.focus_session_id is None
            or task.focus_session_id == task_filter.focus_session_id
        )
    )


class InMemoryFocusSessionRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, FocusSession] = {}

    async def find_all(self) -> list[FocusSession]:
        return list(self._sessions.values())

    async def find_by_id(self, session_id: str) -> FocusSession | None:
        return self._sessions.get(session_id)

    async def find_current(self) -> FocusSession | None:
        newest_first = reversed(self._sessions.values())
        return next(
            (session for session in newest_first if session.status in CURRENT_SESSION_STATUSES),
            None,
        )

    async def create(self, session: NewFocusSession) -> FocusSession:
        created = FocusSession(
            id=str(uuid4()),
            status=session.status,
            start_time=session.start_time,
            tasks=session.tasks,
            pauses=session.pauses,
        )
        self._sessions[created.id] = created
        return created

    async def save(self, session: FocusSession) -> None:
        if session.id in self._sessions:
            self._sessions[session.id] = session


def create_in_memory_repositories() -> Repositories:
    return Repositories(
        tasks=InMemoryTaskRepository(), focus_sessions=InMemoryFocusSessionRepository()
    )

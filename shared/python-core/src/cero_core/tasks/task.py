from collections.abc import Iterable
from dataclasses import dataclass, replace
from enum import StrEnum
from typing import Final, TypedDict


class TaskStatus(StrEnum):
    IN_PROGRESS = "in-progress"
    PENDING = "pending"
    COMPLETED = "completed"


ACTIVE_TASK_STATUSES: Final = (TaskStatus.IN_PROGRESS, TaskStatus.PENDING)
"""Tasks that still need work."""

MAX_IN_PROGRESS_TASKS: Final = 3
"""Focus rule: a new task only starts in progress while fewer than this many are."""


@dataclass(frozen=True, slots=True)
class Task:
    id: str
    description: str
    priority: int
    """0 is the top of its status group."""
    status: TaskStatus
    focus_session_id: str | None


@dataclass(frozen=True, slots=True)
class NewTask:
    """A task before storage has given it an id."""

    description: str
    priority: int
    status: TaskStatus
    focus_session_id: str | None


class TaskChanges(TypedDict, total=False):
    """The fields to change. A missing key leaves its field as it is."""

    description: str
    priority: int
    status: TaskStatus
    focus_session_id: str | None


def status_for_new_task(in_progress_count: int) -> TaskStatus:
    if in_progress_count < MAX_IN_PROGRESS_TASKS:
        return TaskStatus.IN_PROGRESS
    return TaskStatus.PENDING


def renumber(tasks: Iterable[Task]) -> list[Task]:
    """Gives the tasks consecutive priorities 1..n, keeping their order."""
    return [replace(task, priority=priority) for priority, task in enumerate(tasks, start=1)]

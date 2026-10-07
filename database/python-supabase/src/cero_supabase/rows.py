"""Rows are what PostgREST sends and receives: the snake_case columns of the
tables in `python-supabase/supabase/migrations` (the reference schema of
`database/postgres/schema.sql`).

The domain has names of its own, so every value crosses this explicit mapping.
Pauses are stored as jsonb inside their session, with the API's field names.
"""

from typing import Final, TypedDict, cast

from postgrest.types import JSON

from cero_core import (
    FocusSession,
    FocusSessionStatus,
    NewFocusSession,
    NewTask,
    Pause,
    Task,
    TaskStatus,
)

TASKS: Final = "tasks"
FOCUS_SESSIONS: Final = "focus_sessions"

TASK_COLUMNS: Final = ("id", "description", "priority", "status", "focus_session_id")
FOCUS_SESSION_COLUMNS: Final = ("id", "status", "start_time", "task_ids", "pauses")


class TaskFields(TypedDict):
    """The columns of `tasks` this adapter writes. Postgres fills in `id` and `created_at`."""

    description: str
    priority: int
    status: str
    focus_session_id: str | None


class TaskRow(TaskFields):
    """A row of `tasks`, as the repositories select it (`TASK_COLUMNS`)."""

    id: str


class PauseJson(TypedDict):
    id: str
    startTime: int
    endTime: int | None
    time: int


class FocusSessionFields(TypedDict):
    """The columns of `focus_sessions` this adapter writes."""

    status: str
    start_time: int
    task_ids: list[str]
    pauses: list[PauseJson]


class FocusSessionRow(FocusSessionFields):
    """A row of `focus_sessions`, as the repositories select it (`FOCUS_SESSION_COLUMNS`)."""

    id: str


def to_task(row: TaskRow) -> Task:
    return Task(
        id=row["id"],
        description=row["description"],
        priority=row["priority"],
        status=TaskStatus(row["status"]),
        focus_session_id=row["focus_session_id"],
    )


def to_task_fields(task: NewTask | Task) -> JSON:
    """The columns to insert or update, as the `JSON` postgrest-py takes.

    To mypy, a TypedDict is only a `Mapping[str, object]`, not `JSON`: hence the cast.
    """
    fields: TaskFields = {
        "description": task.description,
        "priority": task.priority,
        "status": task.status,
        "focus_session_id": task.focus_session_id,
    }
    return cast(JSON, fields)


def to_focus_session(row: FocusSessionRow) -> FocusSession:
    return FocusSession(
        id=row["id"],
        status=FocusSessionStatus(row["status"]),
        start_time=row["start_time"],
        tasks=tuple(row["task_ids"]),
        pauses=tuple(_to_pause(pause) for pause in row["pauses"]),
    )


def to_focus_session_fields(session: NewFocusSession | FocusSession) -> JSON:
    """The columns to insert or update, as for tasks."""
    fields: FocusSessionFields = {
        "status": session.status,
        "start_time": session.start_time,
        "task_ids": list(session.tasks),
        "pauses": [_to_pause_json(pause) for pause in session.pauses],
    }
    return cast(JSON, fields)


def _to_pause(pause: PauseJson) -> Pause:
    return Pause(
        id=pause["id"],
        start_time=pause["startTime"],
        end_time=pause["endTime"],
        time=pause["time"],
    )


def _to_pause_json(pause: Pause) -> PauseJson:
    return {
        "id": pause.id,
        "startTime": pause.start_time,
        "endTime": pause.end_time,
        "time": pause.time,
    }

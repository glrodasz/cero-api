"""How tasks and focus sessions look inside Firestore.

The shape of `database/typescript-firestore` (`converters.ts`): collections
`tasks` and `focus_sessions`, the domain fields under the API's camelCase
names, pauses embedded in their session, and a `createdAt` server timestamp.
Firestore ids are random, so `createdAt` is what lists are ordered by. The id
is the document's own, never a field. TypeScript and Python stacks can
therefore share a database.
"""

from datetime import datetime
from typing import Final, TypedDict, cast

from google.cloud.firestore import DocumentSnapshot

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
CREATED_AT: Final = "createdAt"
"""Stamped by the server on create (`SERVER_TIMESTAMP`); `save` leaves it alone."""


class TaskFields(TypedDict):
    """What a task document stores of the task. `create` adds `createdAt`."""

    description: str
    priority: int
    status: str
    focusSessionId: str | None


class TaskDocument(TaskFields):
    createdAt: datetime


class PauseDocument(TypedDict):
    id: str
    startTime: int
    endTime: int | None
    time: int


class FocusSessionFields(TypedDict):
    """What a focus session document stores of the session. `create` adds `createdAt`."""

    status: str
    startTime: int
    tasks: list[str]
    pauses: list[PauseDocument]


class FocusSessionDocument(FocusSessionFields):
    createdAt: datetime


def to_task(snapshot: DocumentSnapshot) -> Task:
    document = cast(TaskDocument, snapshot.to_dict())
    return Task(
        id=snapshot.id,
        description=document["description"],
        priority=document["priority"],
        status=TaskStatus(document["status"]),
        focus_session_id=document["focusSessionId"],
    )


def to_task_fields(task: NewTask | Task) -> TaskFields:
    return {
        "description": task.description,
        "priority": task.priority,
        "status": task.status,
        "focusSessionId": task.focus_session_id,
    }


def to_focus_session(snapshot: DocumentSnapshot) -> FocusSession:
    document = cast(FocusSessionDocument, snapshot.to_dict())
    return FocusSession(
        id=snapshot.id,
        status=FocusSessionStatus(document["status"]),
        start_time=document["startTime"],
        tasks=tuple(document["tasks"]),
        pauses=tuple(_to_pause(pause) for pause in document["pauses"]),
    )


def to_focus_session_fields(session: NewFocusSession | FocusSession) -> FocusSessionFields:
    return {
        "status": session.status,
        "startTime": session.start_time,
        "tasks": list(session.tasks),
        "pauses": [_to_pause_document(pause) for pause in session.pauses],
    }


def _to_pause(document: PauseDocument) -> Pause:
    return Pause(
        id=document["id"],
        start_time=document["startTime"],
        end_time=document["endTime"],
        time=document["time"],
    )


def _to_pause_document(pause: Pause) -> PauseDocument:
    return {
        "id": pause.id,
        "startTime": pause.start_time,
        "endTime": pause.end_time,
        "time": pause.time,
    }

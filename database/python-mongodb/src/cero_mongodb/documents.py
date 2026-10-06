"""How tasks and focus sessions look inside MongoDB.

The same shape as `database/typescript-mongoose/src/schemas.ts`: collections
`tasks` and `focus_sessions`, camelCase fields, pauses embedded in their
session with an id of their own, no `__v`. TypeScript and Python stacks can
therefore share a database.
"""

from typing import Any, Final, TypedDict

from bson import ObjectId

TASKS: Final = "tasks"
FOCUS_SESSIONS: Final = "focus_sessions"

type Query = dict[str, Any]
"""A MongoDB filter or update document."""


class TaskDocument(TypedDict):
    _id: ObjectId
    description: str
    priority: int
    status: str
    focusSessionId: str | None


class PauseDocument(TypedDict):
    id: str
    startTime: int
    endTime: int | None
    time: int


class FocusSessionDocument(TypedDict):
    _id: ObjectId
    status: str
    startTime: int
    tasks: list[str]
    pauses: list[PauseDocument]

"""The output types. Each one is built from its core entity with `from_core`."""

from typing import Self

import strawberry

import cero_core as core
from cero_core import FocusSessionStatus, TaskStatus
from cero_graphql.scalars import Millis

# The core's enums are the GraphQL enums: IN_PROGRESS on the wire is TaskStatus.IN_PROGRESS
# ("in-progress") in Python.


@strawberry.type
class Task:
    id: strawberry.ID
    description: str
    priority: int = strawberry.field(description="0 is the top of its status group.")
    status: TaskStatus
    focus_session_id: strawberry.ID | None = strawberry.field(
        description="The session the task is being worked on in, if any."
    )

    @classmethod
    def from_core(cls, task: core.Task) -> Self:
        return cls(
            id=strawberry.ID(task.id),
            description=task.description,
            priority=task.priority,
            status=task.status,
            focus_session_id=None
            if task.focus_session_id is None
            else strawberry.ID(task.focus_session_id),
        )


@strawberry.type
class Pause:
    id: strawberry.ID
    start_time: Millis
    end_time: Millis | None = strawberry.field(description="Null while the pause is open.")
    time: Millis

    @classmethod
    def from_core(cls, pause: core.Pause) -> Self:
        return cls(
            id=strawberry.ID(pause.id),
            start_time=Millis(pause.start_time),
            end_time=None if pause.end_time is None else Millis(pause.end_time),
            time=Millis(pause.time),
        )


@strawberry.type
class FocusSession:
    id: strawberry.ID
    status: FocusSessionStatus
    start_time: Millis
    tasks: list[strawberry.ID] = strawberry.field(
        description="Ids of the tasks the session started with."
    )
    pauses: list[Pause] = strawberry.field(
        description="Oldest first; only the last one can be open."
    )

    @classmethod
    def from_core(cls, session: core.FocusSession) -> Self:
        return cls(
            id=strawberry.ID(session.id),
            status=session.status,
            start_time=Millis(session.start_time),
            tasks=[strawberry.ID(task_id) for task_id in session.tasks],
            pauses=[Pause.from_core(pause) for pause in session.pauses],
        )

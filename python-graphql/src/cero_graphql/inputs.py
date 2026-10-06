"""The input types.

Optional fields default to UNSET rather than None: UNSET means "not sent",
which keeps a missing field apart from an explicit null (and keeps the SDL
free of `= null` defaults).
"""

import strawberry
from strawberry import UNSET

from cero_core import TaskChanges, TaskStatus, ValidationError
from cero_graphql.scalars import Millis


def absent_as_none[T](value: T | None) -> T | None:
    """For fields where not sending a value and sending null both mean "use the default"."""
    return None if value is UNSET else value


@strawberry.input
class CreateTaskInput:
    description: str


@strawberry.input(description="Only the fields that are present are changed.")
class UpdateTaskInput:
    description: str | None = UNSET
    priority: int | None = UNSET
    status: TaskStatus | None = UNSET
    focus_session_id: strawberry.ID | None = UNSET

    def to_changes(self) -> TaskChanges:
        changes = TaskChanges()
        if self.description is not UNSET:
            changes["description"] = _not_null("description", self.description)
        if self.priority is not UNSET:
            changes["priority"] = _not_null("priority", self.priority)
        if self.status is not UNSET:
            changes["status"] = _not_null("status", self.status)
        if self.focus_session_id is not UNSET:
            # Null is meaningful here: it takes the task out of its session.
            changes["focus_session_id"] = self.focus_session_id
        return changes


def _not_null[T](field: str, value: T | None) -> T:
    if value is None:
        raise ValidationError(f"{field} cannot be null")
    return value


@strawberry.input
class StartFocusSessionInput:
    tasks: list[strawberry.ID] | None = strawberry.field(
        default=UNSET, description="Defaults to every in-progress and pending task."
    )
    start_time: Millis | None = strawberry.field(default=UNSET, description="Defaults to now.")

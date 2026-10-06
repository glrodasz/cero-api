from typing import cast

from pydantic import StrictInt, StrictStr, field_validator

from cero_core import TaskChanges, TaskStatus
from cero_fastapi.api_model import ApiModel

# Strict types: the contract wants "42" for a number to be a 400, not coerced.


class CreateTaskBody(ApiModel):
    description: StrictStr


class TaskChangesBody(ApiModel):
    """Only the fields that are present change."""

    description: StrictStr | None = None
    priority: StrictInt | None = None
    status: TaskStatus | None = None
    focus_session_id: StrictStr | None = None

    @field_validator("description", "priority", "status")
    @classmethod
    def refuse_null[T](cls, value: T | None) -> T:
        # Runs only for fields that are present. Null only means something
        # for focusSessionId: it takes the task out of its session.
        if value is None:
            raise ValueError("cannot be null")
        return value

    def to_changes(self) -> TaskChanges:
        # Only the fields the client sent, under their Python names: the keys of TaskChanges.
        return cast(TaskChanges, self.model_dump(exclude_unset=True))


class TaskResponse(ApiModel):
    id: str
    description: str
    priority: int
    status: TaskStatus
    focus_session_id: str | None

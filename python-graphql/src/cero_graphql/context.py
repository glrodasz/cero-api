from dataclasses import dataclass

import strawberry

from cero_core import FocusSessionsService, TasksService


@dataclass(frozen=True, slots=True)
class Context:
    """What every resolver can reach through `info.context`: the use cases."""

    tasks: TasksService
    focus_sessions: FocusSessionsService


type Info = strawberry.Info[Context, None]

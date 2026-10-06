"""The schema, code first.

`tests/test_schema_parity.py` proves it equals `shared/graphql/schema.graphql`.
"""

from collections.abc import Sequence

import strawberry
from graphql import GraphQLError
from strawberry import UNSET
from strawberry.schema.config import StrawberryConfig
from strawberry.types import ExecutionContext

from cero_core import NotFoundError, TaskStatus
from cero_graphql.context import Info
from cero_graphql.errors import ClientErrors, is_unexpected
from cero_graphql.inputs import (
    CreateTaskInput,
    StartFocusSessionInput,
    UpdateTaskInput,
    absent_as_none,
)
from cero_graphql.scalars import MILLIS, Millis
from cero_graphql.types import FocusSession, Task


@strawberry.type
class Query:
    @strawberry.field(
        description="Tasks of the current focus session, "
        "or every in-progress and pending task when there is none."
    )
    async def tasks(self, info: Info) -> list[Task]:
        return [Task.from_core(task) for task in await info.context.tasks.list()]

    @strawberry.field(description="Null when the task does not exist.")
    async def task(self, info: Info, id: strawberry.ID) -> Task | None:
        try:
            return Task.from_core(await info.context.tasks.get(id))
        except NotFoundError:
            return None

    @strawberry.field(description="Every focus session, oldest first.")
    async def focus_sessions(self, info: Info) -> list[FocusSession]:
        return [
            FocusSession.from_core(session) for session in await info.context.focus_sessions.list()
        ]

    @strawberry.field(
        description="The newest active or paused session, "
        "with startTime moved forward by its closed pauses."
    )
    async def current_focus_session(self, info: Info) -> FocusSession | None:
        session = await info.context.focus_sessions.get_current()
        return None if session is None else FocusSession.from_core(session)


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def create_task(self, info: Info, input: CreateTaskInput) -> Task:
        return Task.from_core(await info.context.tasks.create(description=input.description))

    @strawberry.mutation
    async def update_task(self, info: Info, id: strawberry.ID, input: UpdateTaskInput) -> Task:
        return Task.from_core(await info.context.tasks.update(id, input.to_changes()))

    @strawberry.mutation
    async def change_task_status(self, info: Info, id: strawberry.ID, status: TaskStatus) -> Task:
        return Task.from_core(await info.context.tasks.change_status(id, status))

    @strawberry.mutation
    async def complete_task(self, info: Info, id: strawberry.ID) -> Task:
        return Task.from_core(await info.context.tasks.complete(id))

    @strawberry.mutation
    async def reset_task(self, info: Info, id: strawberry.ID) -> Task:
        return Task.from_core(await info.context.tasks.reset(id))

    @strawberry.mutation
    async def delete_task(self, info: Info, id: strawberry.ID) -> Task:
        return Task.from_core(await info.context.tasks.delete(id))

    @strawberry.mutation
    async def start_focus_session(
        self, info: Info, input: StartFocusSessionInput | None = UNSET
    ) -> FocusSession:
        options = input or StartFocusSessionInput()
        session = await info.context.focus_sessions.start(
            task_ids=options.tasks or (), start_time=absent_as_none(options.start_time)
        )
        return FocusSession.from_core(session)

    @strawberry.mutation
    async def finish_focus_session(self, info: Info, id: strawberry.ID) -> FocusSession:
        return FocusSession.from_core(await info.context.focus_sessions.finish(id))

    @strawberry.mutation
    async def finish_current_focus_session(self, info: Info) -> FocusSession:
        return FocusSession.from_core(await info.context.focus_sessions.finish_current())

    @strawberry.mutation
    async def pause_focus_session(self, info: Info, id: strawberry.ID) -> FocusSession:
        return FocusSession.from_core(await info.context.focus_sessions.pause(id))

    @strawberry.mutation(
        description="Starts a new pause (closing any open one) when time is given; "
        "without time an already paused session is left as is."
    )
    async def pause_current_focus_session(
        self, info: Info, time: Millis | None = UNSET
    ) -> FocusSession:
        session = await info.context.focus_sessions.pause_current(time=absent_as_none(time))
        return FocusSession.from_core(session)

    @strawberry.mutation
    async def resume_focus_session(self, info: Info, id: strawberry.ID) -> FocusSession:
        return FocusSession.from_core(await info.context.focus_sessions.resume(id))

    @strawberry.mutation
    async def resume_current_focus_session(self, info: Info) -> FocusSession:
        return FocusSession.from_core(await info.context.focus_sessions.resume_current())


class Schema(strawberry.Schema):
    def process_errors(
        self, errors: Sequence[GraphQLError], execution_context: ExecutionContext | None = None
    ) -> None:
        """Logs only unexpected errors: the core's refusals and bad requests are not failures."""
        super().process_errors(
            [error for error in errors if is_unexpected(error)], execution_context
        )


schema = Schema(
    query=Query,
    mutation=Mutation,
    config=StrawberryConfig(scalar_map={Millis: MILLIS}),
    extensions=[ClientErrors],
)

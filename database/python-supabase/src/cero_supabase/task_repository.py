from collections.abc import Sequence
from typing import cast

from postgrest import AsyncRequestBuilder, CountMethod, ReturnMethod
from supabase import AsyncClient

from cero_core import NewTask, Task, TaskFilter, TaskStatus
from cero_supabase.ids import is_uuid, only_uuids
from cero_supabase.rows import TASK_COLUMNS, TASKS, TaskRow, to_task, to_task_fields


class SupabaseTaskRepository:
    """Tasks through PostgREST.

    postgrest-py raises `APIError` for every request PostgREST refuses, so a
    broken database reaches the transport as an exception (500), never as an
    empty result. Writes ask for `return=minimal`: no row travels back.
    """

    def __init__(self, client: AsyncClient) -> None:
        self._client = client

    async def find_by_id(self, task_id: str) -> Task | None:
        if not is_uuid(task_id):
            return None

        response = (
            await self._tasks().select(*TASK_COLUMNS).eq("id", task_id).maybe_single().execute()
        )
        return None if response is None else to_task(cast(TaskRow, response.data))

    async def find_many(self, task_filter: TaskFilter) -> list[Task]:
        query = self._tasks().select(*TASK_COLUMNS)
        if task_filter.ids is not None:
            query = query.in_("id", only_uuids(task_filter.ids))
        if task_filter.statuses is not None:
            query = query.in_("status", task_filter.statuses)
        if task_filter.focus_session_id is not None:
            if not is_uuid(task_filter.focus_session_id):
                return []
            query = query.eq("focus_session_id", task_filter.focus_session_id)

        response = await query.order("priority").order("created_at").execute()
        return [to_task(row) for row in cast(list[TaskRow], response.data)]

    async def count_by_status(self, status: TaskStatus) -> int:
        # `head=True` sends a HEAD request: Postgres counts, no rows travel back.
        response = (
            await self._tasks()
            .select("id", count=CountMethod.exact, head=True)
            .eq("status", status)
            .execute()
        )
        return response.count or 0

    async def create(self, task: NewTask) -> Task:
        response = await self._tasks().insert(to_task_fields(task)).select(*TASK_COLUMNS).execute()
        return to_task(cast(TaskRow, response.data[0]))

    async def save(self, task: Task) -> None:
        if is_uuid(task.id):
            await (
                self._tasks()
                .update(to_task_fields(task), returning=ReturnMethod.minimal)
                .eq("id", task.id)
                .execute()
            )

    async def delete(self, task_id: str) -> None:
        if is_uuid(task_id):
            await self._tasks().delete(returning=ReturnMethod.minimal).eq("id", task_id).execute()

    async def assign_focus_session(
        self, task_ids: Sequence[str], focus_session_id: str | None
    ) -> None:
        if ids := only_uuids(task_ids):
            await (
                self._tasks()
                .update({"focus_session_id": focus_session_id}, returning=ReturnMethod.minimal)
                .in_("id", ids)
                .execute()
            )

    def _tasks(self) -> AsyncRequestBuilder:
        return self._client.table(TASKS)

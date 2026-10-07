from collections.abc import Sequence
from contextlib import suppress
from datetime import datetime
from typing import cast

from google.api_core.exceptions import NotFound
from google.cloud.firestore import (
    SERVER_TIMESTAMP,
    AsyncClient,
    AsyncDocumentReference,
    AsyncTransaction,
    DocumentSnapshot,
    FieldFilter,
    async_transactional,
)
from google.cloud.firestore_v1.async_aggregation import AsyncAggregationQuery

from cero_core import NewTask, Task, TaskFilter, TaskStatus
from cero_firestore.document_ids import is_document_id
from cero_firestore.documents import CREATED_AT, TASKS, to_task, to_task_fields


def _priority_then_creation(snapshot: DocumentSnapshot) -> tuple[int, datetime]:
    """The order of `order_by("priority").order_by("createdAt")`, for tasks fetched by id."""
    return snapshot.get("priority"), snapshot.get(CREATED_AT)


class FirestoreTaskRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._client = client
        self._tasks = client.collection(TASKS)

    async def find_by_id(self, task_id: str) -> Task | None:
        if not is_document_id(task_id):
            return None

        snapshot = await self._tasks.document(task_id).get()
        return to_task(snapshot) if snapshot.exists else None

    async def find_many(self, task_filter: TaskFilter) -> list[Task]:
        statuses, focus_session_id = task_filter.statuses, task_filter.focus_session_id
        if task_filter.ids is not None:
            return [
                task
                for task in await self._find_by_ids(task_filter.ids)
                if (statuses is None or task.status in statuses)
                and (focus_session_id is None or task.focus_session_id == focus_session_id)
            ]
        if statuses is not None and not statuses:
            return []  # Firestore refuses an empty `in`, and nothing could match it anyway.

        query = self._tasks.order_by("priority").order_by(CREATED_AT)
        if statuses is not None:
            query = query.where(filter=FieldFilter("status", "in", list(statuses)))
        if focus_session_id is not None:
            query = query.where(filter=FieldFilter("focusSessionId", "==", focus_session_id))
        return [to_task(snapshot) for snapshot in await query.get()]

    async def count_by_status(self, status: TaskStatus) -> int:
        # An aggregation query: the server counts, no document is downloaded. The cast
        # corrects google-cloud-firestore's annotation, which says `count()` returns a class.
        query = self._tasks.where(filter=FieldFilter("status", "==", status))
        [[count]] = await cast(AsyncAggregationQuery, query.count()).get()
        return int(count.value)

    async def create(self, task: NewTask) -> Task:
        # Firestore makes up the id on the client, so the task is known before it is written.
        reference = self._tasks.document()
        await reference.create({**to_task_fields(task), CREATED_AT: SERVER_TIMESTAMP})
        return Task(
            id=reference.id,
            description=task.description,
            priority=task.priority,
            status=task.status,
            focus_session_id=task.focus_session_id,
        )

    async def save(self, task: Task) -> None:
        if not is_document_id(task.id):
            return

        # `update` refuses a missing document, and saving one is a no-op, as the port asks.
        with suppress(NotFound):
            await self._tasks.document(task.id).update(dict(to_task_fields(task)))

    async def delete(self, task_id: str) -> None:
        if is_document_id(task_id):
            await self._tasks.document(task_id).delete()

    async def assign_focus_session(
        self, task_ids: Sequence[str], focus_session_id: str | None
    ) -> None:
        if not (references := self._references(task_ids)):
            return

        # A transaction reads which tasks exist and updates only those, all at once:
        # a batched `update` of an unknown id would fail the whole batch.
        @async_transactional
        async def assign(transaction: AsyncTransaction) -> None:
            async for snapshot in self._client.get_all(references, transaction=transaction):
                if snapshot.exists:
                    transaction.update(snapshot.reference, {"focusSessionId": focus_session_id})

        await assign(self._client.transaction())

    async def _find_by_ids(self, task_ids: Sequence[str]) -> list[Task]:
        """Every id in one round trip, sorted like the queries (an `in` stops at 30 values)."""
        if not (references := self._references(task_ids)):
            return []

        snapshots = [
            snapshot async for snapshot in self._client.get_all(references) if snapshot.exists
        ]
        return [to_task(snapshot) for snapshot in sorted(snapshots, key=_priority_then_creation)]

    def _references(self, task_ids: Sequence[str]) -> list[AsyncDocumentReference]:
        """The documents of the tasks whose ids are well-formed."""
        return [self._tasks.document(task_id) for task_id in task_ids if is_document_id(task_id)]

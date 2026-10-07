from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from cero_core import NewTask, Task, TaskFilter, TaskStatus
from cero_postgres.ids import parse_id, parse_ids
from cero_postgres.records import TaskRecord


def _to_task(record: TaskRecord) -> Task:
    return Task(
        id=str(record.id),
        description=record.description,
        priority=record.priority,
        status=TaskStatus(record.status),
        focus_session_id=None if record.focus_session_id is None else str(record.focus_session_id),
    )


def _to_uuid(focus_session_id: str | None) -> UUID | None:
    return None if focus_session_id is None else UUID(focus_session_id)


class PostgresTaskRepository:
    """Each method opens its own database session, so the core may call several at once."""

    def __init__(self, db_sessions: async_sessionmaker[AsyncSession]) -> None:
        self._db_sessions = db_sessions

    async def find_by_id(self, task_id: str) -> Task | None:
        if (key := parse_id(task_id)) is None:
            return None

        async with self._db_sessions() as db:
            record = await db.get(TaskRecord, key)
            return None if record is None else _to_task(record)

    async def find_many(self, task_filter: TaskFilter) -> list[Task]:
        query = select(TaskRecord).order_by(TaskRecord.priority, TaskRecord.created_at)
        if task_filter.ids is not None:
            query = query.where(TaskRecord.id.in_(parse_ids(task_filter.ids)))
        if task_filter.statuses is not None:
            query = query.where(TaskRecord.status.in_(task_filter.statuses))
        if task_filter.focus_session_id is not None:
            if (session_id := parse_id(task_filter.focus_session_id)) is None:
                return []
            query = query.where(TaskRecord.focus_session_id == session_id)

        async with self._db_sessions() as db:
            return [_to_task(record) for record in await db.scalars(query)]

    async def count_by_status(self, status: TaskStatus) -> int:
        query = select(func.count()).select_from(TaskRecord).where(TaskRecord.status == status)
        async with self._db_sessions() as db:
            return (await db.execute(query)).scalar_one()

    async def create(self, task: NewTask) -> Task:
        record = TaskRecord(
            description=task.description,
            priority=task.priority,
            status=task.status,
            focus_session_id=_to_uuid(task.focus_session_id),
        )
        async with self._db_sessions.begin() as db:
            db.add(record)
        return _to_task(record)

    async def save(self, task: Task) -> None:
        if (key := parse_id(task.id)) is None:
            return

        statement = (
            update(TaskRecord)
            .where(TaskRecord.id == key)
            .values(
                description=task.description,
                priority=task.priority,
                status=task.status,
                focus_session_id=_to_uuid(task.focus_session_id),
            )
        )
        async with self._db_sessions.begin() as db:
            await db.execute(statement)

    async def delete(self, task_id: str) -> None:
        if (key := parse_id(task_id)) is None:
            return

        async with self._db_sessions.begin() as db:
            await db.execute(delete(TaskRecord).where(TaskRecord.id == key))

    async def assign_focus_session(
        self, task_ids: Sequence[str], focus_session_id: str | None
    ) -> None:
        if not (keys := parse_ids(task_ids)):
            return

        statement = (
            update(TaskRecord)
            .where(TaskRecord.id.in_(keys))
            .values(focus_session_id=_to_uuid(focus_session_id))
        )
        async with self._db_sessions.begin() as db:
            await db.execute(statement)

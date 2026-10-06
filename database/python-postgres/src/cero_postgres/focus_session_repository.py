from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from cero_core import (
    CURRENT_SESSION_STATUSES,
    FocusSession,
    FocusSessionStatus,
    NewFocusSession,
    Pause,
)
from cero_postgres.ids import parse_id
from cero_postgres.records import FocusSessionRecord, PauseJson


def _to_focus_session(record: FocusSessionRecord) -> FocusSession:
    return FocusSession(
        id=str(record.id),
        status=FocusSessionStatus(record.status),
        start_time=record.start_time,
        tasks=tuple(str(task_id) for task_id in record.task_ids),
        pauses=tuple(_to_pause(pause) for pause in record.pauses),
    )


def _to_pause(pause: PauseJson) -> Pause:
    return Pause(
        id=pause["id"],
        start_time=pause["startTime"],
        end_time=pause["endTime"],
        time=pause["time"],
    )


def _to_pause_json(pause: Pause) -> PauseJson:
    return {
        "id": pause.id,
        "startTime": pause.start_time,
        "endTime": pause.end_time,
        "time": pause.time,
    }


class PostgresFocusSessionRepository:
    """Each method opens its own database session, so the core may call several at once."""

    def __init__(self, db_sessions: async_sessionmaker[AsyncSession]) -> None:
        self._db_sessions = db_sessions

    async def find_all(self) -> list[FocusSession]:
        query = select(FocusSessionRecord).order_by(FocusSessionRecord.created_at)
        async with self._db_sessions() as db:
            return [_to_focus_session(record) for record in await db.scalars(query)]

    async def find_by_id(self, session_id: str) -> FocusSession | None:
        if (key := parse_id(session_id)) is None:
            return None

        async with self._db_sessions() as db:
            record = await db.get(FocusSessionRecord, key)
            return None if record is None else _to_focus_session(record)

    async def find_current(self) -> FocusSession | None:
        query = (
            select(FocusSessionRecord)
            .where(FocusSessionRecord.status.in_(CURRENT_SESSION_STATUSES))
            .order_by(FocusSessionRecord.created_at.desc())
            .limit(1)
        )
        async with self._db_sessions() as db:
            record = await db.scalar(query)
            return None if record is None else _to_focus_session(record)

    async def create(self, session: NewFocusSession) -> FocusSession:
        record = FocusSessionRecord(
            status=session.status,
            start_time=session.start_time,
            task_ids=[UUID(task_id) for task_id in session.tasks],
            pauses=[_to_pause_json(pause) for pause in session.pauses],
        )
        async with self._db_sessions.begin() as db:
            db.add(record)
        return _to_focus_session(record)

    async def save(self, session: FocusSession) -> None:
        if (key := parse_id(session.id)) is None:
            return

        statement = (
            update(FocusSessionRecord)
            .where(FocusSessionRecord.id == key)
            .values(
                status=session.status,
                start_time=session.start_time,
                task_ids=[UUID(task_id) for task_id in session.tasks],
                pauses=[_to_pause_json(pause) for pause in session.pauses],
            )
        )
        async with self._db_sessions.begin() as db:
            await db.execute(statement)

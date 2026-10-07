"""The tables of `database/postgres/schema.sql`, as SQLAlchemy models.

The Alembic migrations in `migrations/` create them; `alembic check` proves
the two agree. Records are a storage detail: the repositories turn them into
core entities before anything else sees them.
"""

from datetime import datetime
from typing import TypedDict
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class PauseJson(TypedDict):
    """A pause inside `focus_sessions.pauses`. The keys are the API's field names."""

    id: str
    startTime: int
    endTime: int | None
    time: int


class Base(DeclarativeBase):
    pass


class FocusSessionRecord(Base):
    __tablename__ = "focus_sessions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'paused', 'finished')", name="focus_sessions_status_check"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    status: Mapped[str] = mapped_column(Text)
    start_time: Mapped[int] = mapped_column(BigInteger)
    task_ids: Mapped[list[UUID]] = mapped_column(ARRAY(Uuid), server_default="{}")
    pauses: Mapped[list[PauseJson]] = mapped_column(JSONB, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )


# "The current session" is the newest active or paused one.
Index(
    "focus_sessions_current_idx",
    FocusSessionRecord.created_at.desc(),
    postgresql_where=FocusSessionRecord.status.in_(["active", "paused"]),
)


class TaskRecord(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('in-progress', 'pending', 'completed')", name="tasks_status_check"
        ),
        Index("tasks_status_priority_idx", "status", "priority", "created_at"),
        Index("tasks_focus_session_priority_idx", "focus_session_id", "priority", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    description: Mapped[str] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(server_default=text("0"))
    status: Mapped[str] = mapped_column(Text)
    focus_session_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(FocusSessionRecord.id, ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )

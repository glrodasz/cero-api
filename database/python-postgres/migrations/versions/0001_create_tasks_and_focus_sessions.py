"""Create the tables of database/postgres/schema.sql.

Revision ID: 0001
Revises:
Create Date: 2026-10-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "focus_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("start_time", sa.BigInteger(), nullable=False),
        # Snapshot of the task ids the session started with.
        sa.Column("task_ids", postgresql.ARRAY(sa.Uuid()), nullable=False, server_default="{}"),
        # Pauses are values owned by their session: [{id, startTime, endTime, time}].
        sa.Column("pauses", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.clock_timestamp(),
        ),
        sa.CheckConstraint(
            "status IN ('active', 'paused', 'finished')", name="focus_sessions_status_check"
        ),
    )
    # "The current session" is the newest active or paused one.
    op.create_index(
        "focus_sessions_current_idx",
        "focus_sessions",
        [sa.text("created_at DESC")],
        postgresql_where=sa.text("status IN ('active', 'paused')"),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column(
            "focus_session_id",
            sa.Uuid(),
            sa.ForeignKey("focus_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.clock_timestamp(),
        ),
        sa.CheckConstraint(
            "status IN ('in-progress', 'pending', 'completed')", name="tasks_status_check"
        ),
    )
    op.create_index("tasks_status_priority_idx", "tasks", ["status", "priority", "created_at"])
    op.create_index(
        "tasks_focus_session_priority_idx", "tasks", ["focus_session_id", "priority", "created_at"]
    )


def downgrade() -> None:
    op.drop_table("tasks")
    op.drop_table("focus_sessions")

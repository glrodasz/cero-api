"""Postgres storage for cero-core, on SQLAlchemy 2 (async ORM) and asyncpg.

    async with open_postgres_storage(database_url) as repositories:
        services = create_services(repositories)

The tables come from Alembic migrations, run explicitly with `uv run alembic upgrade head`.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from cero_core import Repositories
from cero_postgres.focus_session_repository import PostgresFocusSessionRepository
from cero_postgres.task_repository import PostgresTaskRepository

__all__ = [
    "PostgresFocusSessionRepository",
    "PostgresTaskRepository",
    "create_postgres_repositories",
    "open_postgres_storage",
]


def create_postgres_repositories(engine: AsyncEngine) -> Repositories:
    # Entities are read from records after the commit, so keep the records loaded.
    db_sessions = async_sessionmaker(engine, expire_on_commit=False)
    return Repositories(
        tasks=PostgresTaskRepository(db_sessions),
        focus_sessions=PostgresFocusSessionRepository(db_sessions),
    )


@asynccontextmanager
async def open_postgres_storage(database_url: str) -> AsyncIterator[Repositories]:
    """Repositories over a connection pool that lives as long as the `async with` block.

    `database_url` uses the asyncpg driver: `postgresql+asyncpg://user:password@host/db`.
    """
    engine = create_async_engine(database_url)
    try:
        # Connect once, so a wrong URL fails at startup rather than on the first request.
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        yield create_postgres_repositories(engine)
    finally:
        await engine.dispose()

"""Runs the migrations in `versions/`, against DATABASE_URL or a connection lent by a caller."""

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection, pool
from sqlalchemy.ext.asyncio import create_async_engine

from cero_postgres.records import Base

DEFAULT_DATABASE_URL = "postgresql+asyncpg://root:root@127.0.0.1:5432/cero_python"

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# What `alembic check` compares the migrated database with.
target_metadata = Base.metadata


def database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(database_url(), poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(run_migrations)
    await engine.dispose()


def run_migrations_offline() -> None:
    """Prints the SQL instead of running it (`alembic upgrade head --sql`)."""
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
elif (lent_connection := config.attributes.get("connection")) is not None:
    # The test suite migrates through a connection of its own.
    run_migrations(lent_connection)
else:
    asyncio.run(run_migrations_online())

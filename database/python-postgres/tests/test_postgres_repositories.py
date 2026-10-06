import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from cero_core import Repositories
from cero_core.testing import RepositoryContract
from cero_postgres import create_postgres_repositories

# Runs against a real Postgres: `docker compose up -d postgres` from the repository root.
# The test database keeps the test run away from your development data.
DATABASE_TEST_URL = os.environ.get(
    "DATABASE_TEST_URL", "postgresql+asyncpg://root:root@127.0.0.1:5432/cero_python_test"
)
MIGRATIONS = Path(__file__).parents[1] / "migrations"

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DATABASE_TESTS") == "1", reason="SKIP_DATABASE_TESTS=1"
)


def upgrade_to_head(connection: Connection) -> None:
    """Runs the real migrations, so the tests also prove them."""
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS))
    config.attributes["connection"] = connection
    command.upgrade(config, "head")


@pytest.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    """The test database, migrated and emptied."""
    engine = create_async_engine(DATABASE_TEST_URL)
    async with engine.begin() as connection:
        await connection.run_sync(upgrade_to_head)
        await connection.execute(text("TRUNCATE tasks, focus_sessions"))
    yield engine
    await engine.dispose()


class TestPostgresRepositories(RepositoryContract):
    @pytest.fixture
    def repositories(self, engine: AsyncEngine) -> Repositories:
        return create_postgres_repositories(engine)

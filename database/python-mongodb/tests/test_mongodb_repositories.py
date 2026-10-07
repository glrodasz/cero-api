import os
from collections.abc import AsyncIterator
from typing import Any

import pytest
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from cero_core import Repositories
from cero_core.testing import RepositoryContract
from cero_mongodb import create_mongodb_repositories

# Runs against a real MongoDB: `docker compose up -d mongo` from the repository root.
# A throwaway database keeps the test run away from your development data.
MONGODB_TEST_URI = os.environ.get(
    "MONGODB_TEST_URI", "mongodb://root:root@127.0.0.1:27017/cero_python_test?authSource=admin"
)

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DATABASE_TESTS") == "1", reason="SKIP_DATABASE_TESTS=1"
)


@pytest.fixture
async def database() -> AsyncIterator[AsyncDatabase[Any]]:
    """An empty database, dropped again after the test."""
    async with AsyncMongoClient[Any](MONGODB_TEST_URI) as client:
        database = client.get_default_database()
        await client.drop_database(database)
        yield database
        await client.drop_database(database)


class TestMongoDBRepositories(RepositoryContract):
    @pytest.fixture
    def repositories(self, database: AsyncDatabase[Any]) -> Repositories:
        return create_mongodb_repositories(database)

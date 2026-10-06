"""MongoDB storage for cero-core, on PyMongo's native async API (`AsyncMongoClient`).

async with open_mongodb_storage(mongodb_uri) as repositories:
    services = create_services(repositories)
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from cero_core import Repositories
from cero_mongodb.documents import FOCUS_SESSIONS, TASKS
from cero_mongodb.focus_session_repository import MongoFocusSessionRepository
from cero_mongodb.task_repository import MongoTaskRepository

__all__ = [
    "MongoFocusSessionRepository",
    "MongoTaskRepository",
    "create_mongodb_repositories",
    "open_mongodb_storage",
]


def create_mongodb_repositories(database: AsyncDatabase[Any]) -> Repositories:
    return Repositories(
        tasks=MongoTaskRepository(database.get_collection(TASKS)),
        focus_sessions=MongoFocusSessionRepository(database.get_collection(FOCUS_SESSIONS)),
    )


@asynccontextmanager
async def open_mongodb_storage(uri: str) -> AsyncIterator[Repositories]:
    """Repositories over a client that lives as long as the `async with` block.

    The database is the one named in the URI: `mongodb://host:27017/cero_python`.
    """
    client: AsyncMongoClient[Any] = AsyncMongoClient(uri)
    try:
        # Ping once, so a wrong URI fails at startup rather than on the first request.
        await client.admin.command("ping")
        yield create_mongodb_repositories(client.get_default_database())
    finally:
        await client.close()

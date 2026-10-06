from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import partial

from cero_core import Repositories
from cero_core.in_memory import create_in_memory_repositories
from cero_graphql.app import StorageOpener
from cero_graphql.settings import Settings
from cero_mongodb import open_mongodb_storage
from cero_postgres import open_postgres_storage


def storage_opener(settings: Settings) -> StorageOpener:
    """The storage that STORAGE names, ready for the app's lifespan to open."""
    match settings.storage:
        case "postgres":
            return partial(open_postgres_storage, settings.database_url)
        case "mongodb":
            return partial(open_mongodb_storage, settings.mongodb_uri)
        case "memory":
            return open_in_memory_storage


@asynccontextmanager
async def open_in_memory_storage() -> AsyncIterator[Repositories]:
    """No database: the data lives as long as the process."""
    yield create_in_memory_repositories()

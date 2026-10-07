"""Firestore storage for cero-core, on google-cloud-firestore's async client.

    async with open_firestore_storage() as repositories:
        services = create_services(repositories)

The client finds its project and credentials in the environment, and talks to
the emulator instead of Google Cloud whenever `FIRESTORE_EMULATOR_HOST` is set.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from google.cloud.firestore import AsyncClient

from cero_core import Repositories
from cero_firestore.focus_session_repository import FirestoreFocusSessionRepository
from cero_firestore.task_repository import FirestoreTaskRepository

__all__ = [
    "FirestoreFocusSessionRepository",
    "FirestoreTaskRepository",
    "create_firestore_repositories",
    "open_firestore_storage",
]


def create_firestore_repositories(client: AsyncClient) -> Repositories:
    """Repositories over a client the caller owns.

    An async client opens its gRPC channel on its first request and is bound to
    the event loop running then, so use it on that loop only.
    """
    return Repositories(
        tasks=FirestoreTaskRepository(client),
        focus_sessions=FirestoreFocusSessionRepository(client),
    )


@asynccontextmanager
async def open_firestore_storage(project: str | None = None) -> AsyncIterator[Repositories]:
    """Repositories over a new async client, for as long as the `async with` block runs.

    `project` defaults to the environment's (`GOOGLE_CLOUD_PROJECT`, or the
    credentials'). The client has no `close()`: its gRPC channel goes away with it.
    """
    yield create_firestore_repositories(AsyncClient(project=project))

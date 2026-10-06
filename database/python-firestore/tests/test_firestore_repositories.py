import os

import httpx
import pytest
from google.cloud.firestore import AsyncClient

from cero_core import Repositories
from cero_core.testing import RepositoryContract
from cero_firestore import create_firestore_repositories

# Runs against the Firestore emulator of python-firebase (see its README). The
# client talks to it instead of Google Cloud while FIRESTORE_EMULATOR_HOST is set.
# A project of its own keeps the test run away from the app's emulator data;
# "demo-" projects need no credentials and can never reach production.
FIRESTORE_EMULATOR_HOST = os.environ.get("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8181")
PROJECT = "demo-cero-python-test"

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DATABASE_TESTS") == "1", reason="SKIP_DATABASE_TESTS=1"
)


@pytest.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncClient:
    """A client of the emulator, over an empty database.

    A new one for every test: an async client is bound to the event loop of its
    first request, and every test runs on a loop of its own.
    """
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", FIRESTORE_EMULATOR_HOST)
    # The emulator's own endpoint for wiping a project's documents.
    async with httpx.AsyncClient() as http:
        response = await http.delete(
            f"http://{FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/{PROJECT}"
            "/databases/(default)/documents"
        )
        response.raise_for_status()
    return AsyncClient(project=PROJECT)


class TestFirestoreRepositories(RepositoryContract):
    @pytest.fixture
    def repositories(self, client: AsyncClient) -> Repositories:
        return create_firestore_repositories(client)

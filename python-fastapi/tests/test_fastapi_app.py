from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from httpx import ASGITransport, AsyncClient

from cero_core import FocusSession, Repositories
from cero_core.in_memory import InMemoryFocusSessionRepository, create_in_memory_repositories
from cero_fastapi import create_app

# The behaviour itself is covered by the core tests and the shared contract
# suite. These tests cover what is FastAPI's job: routing, parsing, errors.


@asynccontextmanager
async def serve(repositories: Repositories) -> AsyncIterator[AsyncClient]:
    """Runs the app's lifespan and sends requests straight into it, without opening a port."""

    @asynccontextmanager
    async def open_storage() -> AsyncIterator[Repositories]:
        yield repositories

    app = create_app(open_storage)
    # Starlette re-raises unexpected errors after answering; the client should see the answer.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=transport, base_url="http://test") as client,
    ):
        yield client


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with serve(create_in_memory_repositories()) as client:
        yield client


async def test_routes_complete_before_status(client: AsyncClient) -> None:
    created = await client.post("/tasks", json={"description": "routing"})

    response = await client.patch(f"/tasks/{created.json()['id']}/complete")

    assert response.status_code == 200
    assert response.json()["status"] == "completed"


async def test_speaks_camel_case_both_ways(client: AsyncClient) -> None:
    task = (await client.post("/tasks", json={"description": "camel"})).json()
    session = (await client.post("/focus-sessions", json={"tasks": [task["id"]]})).json()

    response = await client.patch(f"/tasks/{task['id']}", json={"focusSessionId": None})

    assert task["focusSessionId"] is None
    assert session["startTime"] > 0
    assert response.json() == {**task, "focusSessionId": None}


async def test_answers_400_for_malformed_json(client: AsyncClient) -> None:
    response = await client.post(
        "/tasks", content="{ nope", headers={"content-type": "application/json"}
    )

    assert response.status_code == 400
    assert isinstance(response.json()["message"], str)


async def test_answers_400_for_a_null_description(client: AsyncClient) -> None:
    task = (await client.post("/tasks", json={"description": "kept"})).json()

    response = await client.patch(f"/tasks/{task['id']}", json={"description": None})

    assert response.status_code == 400
    assert "description" in response.json()["message"]


async def test_answers_404_for_unknown_routes_and_methods(client: AsyncClient) -> None:
    unknown_route = await client.get("/nowhere")
    unknown_method = await client.delete("/tasks")

    assert unknown_route.status_code == unknown_method.status_code == 404
    assert unknown_route.json() == unknown_method.json() == {"message": "Not found"}


async def test_hides_the_details_of_unexpected_errors() -> None:
    class UnreachableFocusSessions(InMemoryFocusSessionRepository):
        async def find_current(self) -> FocusSession | None:
            raise ConnectionError("connection string with a password")

    broken = Repositories(
        tasks=create_in_memory_repositories().tasks, focus_sessions=UnreachableFocusSessions()
    )

    async with serve(broken) as client:
        response = await client.get("/tasks")

    assert response.status_code == 500
    assert response.json() == {"message": "Internal server error"}

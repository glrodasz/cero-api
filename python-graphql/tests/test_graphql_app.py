from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from cero_core import FocusSession, Repositories
from cero_core.in_memory import InMemoryFocusSessionRepository, create_in_memory_repositories
from cero_graphql import create_app

# The behaviour itself is covered by the core tests and the shared contract
# suite. These tests cover what is the GraphQL layer's job: scalars, inputs, errors.

type Json = dict[str, Any]


@asynccontextmanager
async def serve(repositories: Repositories) -> AsyncIterator[AsyncClient]:
    """Runs the app's lifespan and sends requests straight into it, without opening a port."""

    @asynccontextmanager
    async def open_storage() -> AsyncIterator[Repositories]:
        yield repositories

    app = create_app(open_storage)
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
    ):
        yield client


async def execute(client: AsyncClient, query: str, **variables: object) -> Json:
    response = await client.post("/graphql", json={"query": query, "variables": variables})
    result: Json = response.json()
    return result


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with serve(create_in_memory_repositories()) as client:
        yield client


async def create_task(client: AsyncClient) -> Json:
    result = await execute(
        client,
        'mutation { createTask(input: { description: "glue" }) { id } }',
    )
    task: Json = result["data"]["createTask"]
    return task


async def test_answers_null_for_an_unknown_task(client: AsyncClient) -> None:
    result = await execute(client, "query ($id: ID!) { task(id: $id) { id } }", id="unknown")

    assert result == {"data": {"task": None}}


async def test_gives_core_refusals_a_code_and_their_canonical_message(
    client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    task = await create_task(client)

    not_found = await execute(client, 'mutation { completeTask(id: "unknown") { id } }')
    invalid = await execute(
        client,
        'mutation ($id: ID!) { updateTask(id: $id, input: { focusSessionId: "unknown" }) { id } }',
        id=task["id"],
    )

    assert not_found["errors"][0]["message"] == "Task not found"
    assert not_found["errors"][0]["extensions"] == {"code": "NOT_FOUND"}
    assert invalid["errors"][0]["message"] == "focusSessionId does not match any focus session"
    assert invalid["errors"][0]["extensions"] == {"code": "BAD_USER_INPUT"}
    assert caplog.text == "", "refusals are not failures, so they are not logged"


async def test_tells_a_missing_field_from_null(client: AsyncClient) -> None:
    task = await create_task(client)
    session = await execute(client, "mutation { startFocusSession { id } }")
    session_id = session["data"]["startFocusSession"]["id"]
    update = """
        mutation ($id: ID!, $input: UpdateTaskInput!) {
            updateTask(id: $id, input: $input) { focusSessionId }
        }
    """

    moved = await execute(client, update, id=task["id"], input={"focusSessionId": session_id})
    untouched = await execute(client, update, id=task["id"], input={"priority": 1})
    detached = await execute(client, update, id=task["id"], input={"focusSessionId": None})
    refused = await execute(client, update, id=task["id"], input={"description": None})

    assert moved["data"]["updateTask"]["focusSessionId"] == session_id
    assert untouched["data"]["updateTask"]["focusSessionId"] == session_id
    assert detached["data"]["updateTask"]["focusSessionId"] is None
    assert refused["errors"][0]["extensions"] == {"code": "BAD_USER_INPUT"}


async def test_carries_millis_beyond_32_bits_and_refuses_other_values(client: AsyncClient) -> None:
    start = "mutation ($t: Millis) { startFocusSession(input: { startTime: $t }) { startTime } }"

    started = await execute(client, start, t=1_700_000_000_000)
    refused = await execute(client, start, t="now")

    assert started == {"data": {"startFocusSession": {"startTime": 1_700_000_000_000}}}
    assert "Millis must be a whole number of milliseconds" in refused["errors"][0]["message"]


async def test_hides_the_details_of_unexpected_errors_but_logs_them(
    caplog: pytest.LogCaptureFixture,
) -> None:
    class UnreachableFocusSessions(InMemoryFocusSessionRepository):
        async def find_current(self) -> FocusSession | None:
            raise ConnectionError("connection string with a password")

    broken = Repositories(
        tasks=create_in_memory_repositories().tasks, focus_sessions=UnreachableFocusSessions()
    )

    async with serve(broken) as client:
        result = await execute(client, "query { tasks { id } }")

    assert result["data"] is None
    assert [error["message"] for error in result["errors"]] == ["Internal server error"]
    assert "extensions" not in result["errors"][0]
    assert "connection string with a password" in caplog.text

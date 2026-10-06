import asyncio
import threading
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from werkzeug.test import EnvironBuilder
from werkzeug.wrappers import Response

from cero_firebase.asgi_bridge import AsgiBridge

# What the bridge adds to a2wsgi, on a bare FastAPI app: no Firebase, no Firestore.


def create_app(lifespan_loops: list[asyncio.AbstractEventLoop]) -> FastAPI:
    """An app whose lifespan records the loop it runs on, and that tells its own."""

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        lifespan_loops.append(asyncio.get_running_loop())
        yield

    app = FastAPI(lifespan=lifespan)

    @app.get("/loop")
    async def current_loop() -> int:
        return id(asyncio.get_running_loop())

    @app.get("/failure")
    async def failure() -> None:
        raise RuntimeError("unexpected")

    return app


def get(bridge: AsgiBridge, path: str) -> Response:
    return Response.from_app(bridge, EnvironBuilder(path=path).get_environ(), buffered=True)


def test_starts_nothing_before_the_first_request() -> None:
    lifespan_loops: list[asyncio.AbstractEventLoop] = []
    threads_before = threading.active_count()

    AsgiBridge(create_app(lifespan_loops))

    assert lifespan_loops == []
    assert threading.active_count() == threads_before


def test_runs_the_lifespan_once_and_every_request_on_its_loop() -> None:
    lifespan_loops: list[asyncio.AbstractEventLoop] = []
    bridge = AsgiBridge(create_app(lifespan_loops))

    # Like a threaded WSGI server: the first requests arrive together.
    with ThreadPoolExecutor(max_workers=8) as threads:
        responses = list(threads.map(lambda _: get(bridge, "/loop"), range(8)))

    assert len(lifespan_loops) == 1
    assert {response.get_json() for response in responses} == {id(lifespan_loops[0])}


def test_logs_unexpected_errors(caplog: pytest.LogCaptureFixture) -> None:
    bridge = AsgiBridge(create_app([]))

    response = get(bridge, "/failure")

    assert response.status_code == 500
    assert "Exception in ASGI application" in caplog.text

"""Serving an ASGI app (FastAPI) where a WSGI app is expected.

Cloud Functions for Python hands each request to a Flask handler, and Flask
speaks WSGI: synchronous, one thread per request, no lifespan. FastAPI speaks
ASGI: coroutines on an event loop, with a lifespan that opens storage before
the first request. a2wsgi translates the requests; this module adds the rest.
"""

import asyncio
import logging
import threading
from collections.abc import Iterable
from typing import TYPE_CHECKING, cast

from a2wsgi import ASGIMiddleware
from a2wsgi.asgi_typing import ASGIApp
from fastapi import FastAPI
from starlette.types import Receive, Scope, Send

if TYPE_CHECKING:
    from _typeshed.wsgi import StartResponse, WSGIApplication, WSGIEnvironment

logger = logging.getLogger(__name__)


class AsgiBridge:
    """A WSGI app that runs a FastAPI app, lifespan included, on one event loop of its own.

    - **One loop for the whole process.** a2wsgi runs it in a daemon thread and
      hands it every request, from whichever thread the WSGI server calls in.
      What the lifespan opens (a Firestore client, bound to the loop of its
      first request) is therefore shared by every request, never rebuilt.
    - **Nothing starts before the first request**, which starts everything
      once, even when several arrive together. Firebase imports the function's
      module to discover it, also while deploying, and nothing may connect
      then; the functions framework imports it in gunicorn's master process,
      whose threads the forked worker would not inherit.
    - **The lifespan is never closed:** a function instance is stopped without notice.
    - **Unexpected errors are logged.** Starlette answers 500, then re-raises for
      the server to log; a2wsgi keeps the error to itself.
    """

    def __init__(self, app: FastAPI) -> None:
        self._app = app
        self._start_lock = threading.Lock()
        self._wsgi_app: WSGIApplication | None = None

    def __call__(
        self, environ: "WSGIEnvironment", start_response: "StartResponse"
    ) -> Iterable[bytes]:
        return self._started()(environ, start_response)

    def _started(self) -> "WSGIApplication":
        with self._start_lock:
            if self._wsgi_app is None:
                self._wsgi_app = self._start()
            return self._wsgi_app

    def _start(self) -> "WSGIApplication":
        middleware = ASGIMiddleware(cast(ASGIApp, self._run_logging_errors))
        lifespan = self._app.router.lifespan_context(self._app)
        asyncio.run_coroutine_threadsafe(lifespan.__aenter__(), middleware.loop).result()
        # a2wsgi types both protocols with TypedDicts of its own, where Werkzeug and
        # Starlette use plainer types: the casts only reconcile the annotations.
        return cast("WSGIApplication", middleware)

    async def _run_logging_errors(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            await self._app(scope, receive, send)
        except Exception:
            logger.exception("Exception in ASGI application")
            raise

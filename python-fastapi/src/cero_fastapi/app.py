from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cero_core import Repositories, create_services
from cero_fastapi.errors import EXCEPTION_HANDLERS
from cero_fastapi.focus_sessions.router import router as focus_sessions_router
from cero_fastapi.tasks.router import router as tasks_router

type StorageOpener = Callable[[], AbstractAsyncContextManager[Repositories]]
"""Opens storage for as long as the app runs, e.g. `partial(open_postgres_storage, url)`."""


def create_app(open_storage: StorageOpener) -> FastAPI:
    """Builds the FastAPI application around the use cases.

    The app does not choose its storage: `open_storage` does, which is how
    python-supabase serves this same app over a storage of its own.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with open_storage() as repositories:
            app.state.services = create_services(repositories)
            yield

    app = FastAPI(title="Cero API", lifespan=lifespan, exception_handlers=EXCEPTION_HANDLERS)
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )
    app.include_router(tasks_router)
    app.include_router(focus_sessions_router)
    return app

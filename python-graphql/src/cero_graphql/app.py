from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route
from starlette.websockets import WebSocket
from strawberry.asgi import GraphQL

from cero_core import Repositories, Services, create_services
from cero_graphql.context import Context
from cero_graphql.schema import schema

type StorageOpener = Callable[[], AbstractAsyncContextManager[Repositories]]
"""Opens storage for as long as the app runs, e.g. `partial(open_postgres_storage, url)`."""


class GraphQLApp(GraphQL[Context, None]):
    """Strawberry's ASGI app, handing every operation the use cases the lifespan wired."""

    async def get_context(
        self, request: Request | WebSocket, response: Response | WebSocket
    ) -> Context:
        services: Services = request.app.state.services
        return Context(tasks=services.tasks, focus_sessions=services.focus_sessions)


def create_app(open_storage: StorageOpener) -> Starlette:
    """Serves the schema at /graphql on Starlette, which Strawberry's ASGI app is built on.

    Starlette contributes what a bare GraphQL app lacks: a lifespan that opens
    storage before the first request and closes it on shutdown.
    """

    @asynccontextmanager
    async def lifespan(app: Starlette) -> AsyncIterator[None]:
        async with open_storage() as repositories:
            app.state.services = create_services(repositories)
            yield

    return Starlette(routes=[Route("/graphql", GraphQLApp(schema))], lifespan=lifespan)

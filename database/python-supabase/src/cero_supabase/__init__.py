"""Supabase storage for cero-core, on supabase-py: every query is an HTTP request to PostgREST.

    async with open_supabase_storage(supabase_url, service_role_key) as repositories:
        services = create_services(repositories)

The tables come from the Supabase migrations of python-supabase (`supabase/migrations`).
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from supabase import AsyncClient, AsyncClientOptions, acreate_client

from cero_core import Repositories
from cero_supabase.focus_session_repository import SupabaseFocusSessionRepository
from cero_supabase.rows import TASKS
from cero_supabase.task_repository import SupabaseTaskRepository

__all__ = [
    "SupabaseFocusSessionRepository",
    "SupabaseTaskRepository",
    "create_supabase_repositories",
    "open_service_role_client",
    "open_supabase_storage",
]


@asynccontextmanager
async def open_service_role_client(url: str, service_role_key: str) -> AsyncIterator[AsyncClient]:
    """A supabase-py client for trusted server code, closed when the `async with` block ends.

    The service role key bypasses Row Level Security, so it must never reach a
    browser. There is no signed-in user on the server, hence no session to
    persist or refresh. The client's HTTP connections all come from one httpx
    client, owned here, so leaving the block closes them.
    """
    async with httpx.AsyncClient() as http_client:
        options = AsyncClientOptions(
            httpx_client=http_client, persist_session=False, auto_refresh_token=False
        )
        yield await acreate_client(url, service_role_key, options)


def create_supabase_repositories(client: AsyncClient) -> Repositories:
    return Repositories(
        tasks=SupabaseTaskRepository(client),
        focus_sessions=SupabaseFocusSessionRepository(client),
    )


@asynccontextmanager
async def open_supabase_storage(url: str, service_role_key: str) -> AsyncIterator[Repositories]:
    """Repositories over a service role client that lives as long as the `async with` block.

    `url` is the project's API URL (`http://127.0.0.1:55321` for the local stack).
    """
    async with open_service_role_client(url, service_role_key) as client:
        # One request, so a wrong URL or key fails at startup rather than on the first request.
        await client.table(TASKS).select("id").limit(1).execute()
        yield create_supabase_repositories(client)

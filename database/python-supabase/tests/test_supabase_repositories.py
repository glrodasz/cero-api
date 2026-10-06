import os
from collections.abc import AsyncIterator

import pytest
from supabase import AsyncClient

from cero_core import Repositories
from cero_core.testing import RepositoryContract
from cero_supabase import create_supabase_repositories, open_service_role_client

# Runs against python-supabase's local Supabase stack (`npx supabase@2.120.0 start`
# in python-supabase/). Like `supabase db reset`, it empties the tables, so local
# data does not survive a test run.

LOCAL_SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vf"
    "cm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)
"""The service role key of every local Supabase stack: signed with the public development secret."""

SUPABASE_TEST_URL = os.environ.get("SUPABASE_TEST_URL", "http://127.0.0.1:55321")
SUPABASE_TEST_SERVICE_ROLE_KEY = os.environ.get(
    "SUPABASE_TEST_SERVICE_ROLE_KEY", LOCAL_SERVICE_ROLE_KEY
)

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DATABASE_TESTS") == "1", reason="SKIP_DATABASE_TESTS=1"
)


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """A service role client over empty tables."""
    async with open_service_role_client(
        SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY
    ) as client:
        for table in ("tasks", "focus_sessions"):
            # PostgREST refuses a DELETE without a filter, so the filter matches every row.
            await client.table(table).delete().not_.is_("id", None).execute()
        yield client


class TestSupabaseRepositories(RepositoryContract):
    @pytest.fixture
    def repositories(self, client: AsyncClient) -> Repositories:
        return create_supabase_repositories(client)

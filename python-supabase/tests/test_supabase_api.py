import os

import pytest
from httpx import ASGITransport, AsyncClient

from cero_supabase import open_service_role_client
from cero_supabase_api.main import app, settings

# python-fastapi tests the HTTP layer and cero-supabase the storage. This checks
# the wiring in between: the app served here stores in Supabase. It needs the
# local stack (`npx supabase@2.120.0 start`) and cleans up after itself.

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DATABASE_TESTS") == "1", reason="SKIP_DATABASE_TESTS=1"
)


async def test_serves_the_fastapi_app_and_stores_tasks_in_supabase() -> None:
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
        open_service_role_client(
            settings.supabase_url, settings.supabase_service_role_key.get_secret_value()
        ) as supabase,
    ):
        response = await client.post("/tasks", json={"description": "stored in Supabase"})
        task_id = response.json()["id"]
        row = await supabase.table("tasks").select("description").eq("id", task_id).execute()
        await client.delete(f"/tasks/{task_id}")

    assert response.status_code == 201
    assert row.data == [{"description": "stored in Supabase"}]

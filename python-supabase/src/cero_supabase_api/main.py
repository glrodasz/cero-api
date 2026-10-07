"""Composition root: settings → Supabase storage → python-fastapi's app.

`uv run fastapi run --port 8002` serves `app`.
"""

from functools import partial

from cero_fastapi import create_app
from cero_supabase import open_supabase_storage
from cero_supabase_api.settings import Settings

settings = Settings()

app = create_app(
    partial(
        open_supabase_storage,
        settings.supabase_url,
        settings.supabase_service_role_key.get_secret_value(),
    )
)

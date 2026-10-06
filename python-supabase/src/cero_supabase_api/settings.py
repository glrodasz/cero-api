from typing import Final

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

LOCAL_SERVICE_ROLE_KEY: Final = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vf"
    "cm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)
"""The service role key of every local Supabase stack: signed with the public development secret."""


class Settings(BaseSettings):
    """Environment variables (or a `.env` file), validated at startup.

    The defaults are the local stack of `supabase/`. PORT is not here: `fastapi run` reads it.
    """

    model_config = SettingsConfigDict(env_file=".env")

    supabase_url: str = "http://127.0.0.1:55321"
    # A SecretStr never shows its value in a repr or a log line.
    supabase_service_role_key: SecretStr = SecretStr(LOCAL_SERVICE_ROLE_KEY)

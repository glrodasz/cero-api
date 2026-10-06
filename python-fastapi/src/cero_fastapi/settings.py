from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment variables (or a `.env` file), validated at startup.

    PORT is not here: `fastapi run` reads it.
    """

    model_config = SettingsConfigDict(env_file=".env")

    storage: Literal["postgres", "mongodb", "memory"] = "postgres"
    database_url: str = "postgresql+asyncpg://root:root@127.0.0.1:5432/cero_python"
    mongodb_uri: str = "mongodb://root:root@127.0.0.1:27017/cero_python?authSource=admin"

"""Composition root: settings → storage → app. `uv run fastapi run` serves `app`."""

from cero_fastapi.app import create_app
from cero_fastapi.settings import Settings
from cero_fastapi.storage import storage_opener

app = create_app(storage_opener(Settings()))

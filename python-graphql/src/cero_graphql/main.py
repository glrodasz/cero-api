"""Composition root: settings → storage → app, served by uvicorn (`uv run cero-graphql`)."""

import uvicorn

from cero_graphql.app import create_app
from cero_graphql.settings import Settings
from cero_graphql.storage import storage_opener


def main() -> None:
    settings = Settings()
    app = create_app(storage_opener(settings))
    uvicorn.run(app, host="0.0.0.0", port=settings.port)

"""The Cero API on FastAPI. Other packages reuse the app with a storage of their own:

app = create_app(partial(open_my_storage, url))
"""

from cero_fastapi.app import StorageOpener, create_app

__all__ = ["StorageOpener", "create_app"]

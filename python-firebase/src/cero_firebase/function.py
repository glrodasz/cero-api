"""Composition root, run once per function instance: python-fastapi's app, on
Firestore, served by one HTTPS function.

The emulator gives the function FIRESTORE_EMULATOR_HOST and the project
(GCLOUD_PROJECT); once deployed, the Firestore client finds the project and the
function's service account in the environment.
"""

from typing import cast

from firebase_functions import https_fn
from flask import Request, Response

from cero_fastapi import create_app
from cero_firebase.asgi_bridge import AsgiBridge
from cero_firestore import open_firestore_storage

wsgi_app = AsgiBridge(create_app(open_firestore_storage))


# `https_fn.Request` and `https_fn.Response` are Flask's own.
@https_fn.on_request()
def api(request: Request) -> Response:
    """Every path under the function's URL goes to the FastAPI app (`/tasks`, ...)."""
    # `from_app` builds the class it is called on, but is annotated with Werkzeug's base class.
    return cast(Response, Response.from_app(wsgi_app, request.environ))

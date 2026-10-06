import os

import pytest
from flask import Request, Response
from google.cloud import firestore
from werkzeug.test import EnvironBuilder

from cero_firebase import api

# python-fastapi tests the app and cero-firestore the storage. This checks the
# wiring in between: the exported function serves that app, through the ASGI
# bridge, and stores in Firestore. It calls the function as Cloud Functions
# does, a Flask request in and a Flask response out, and needs the Firestore
# emulator (see the README), in a project of its own.

FIRESTORE_EMULATOR_HOST = os.environ.get("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8181")
PROJECT = "demo-cero-python-function-test"

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DATABASE_TESTS") == "1", reason="SKIP_DATABASE_TESTS=1"
)


@pytest.fixture(autouse=True)
def emulator(monkeypatch: pytest.MonkeyPatch) -> None:
    """What the emulator tells the function. The function opens storage on its
    first request, once per process, so every test here shares that storage."""
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", FIRESTORE_EMULATOR_HOST)
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", PROJECT)


def call(method: str, path: str, body: str | None = None) -> Response:
    builder = EnvironBuilder(path=path, method=method, data=body, content_type="application/json")
    return api(Request(builder.get_environ()))


def test_serves_the_fastapi_app_and_stores_tasks_in_firestore() -> None:
    response = call("POST", "/tasks", '{"description": "stored in Firestore"}')
    task_id = response.get_json()["id"]

    document = firestore.Client(project=PROJECT).collection("tasks").document(task_id).get()
    call("DELETE", f"/tasks/{task_id}")

    assert response.status_code == 201
    assert document.get("description") == "stored in Firestore"


def test_lets_the_fastapi_app_refuse_malformed_json() -> None:
    # Unlike the Node.js runtime, Python's hands the body over unparsed.
    response = call("POST", "/tasks", "{ not json")

    assert response.status_code == 400
    assert isinstance(response.get_json()["message"], str)


def test_answers_unknown_routes_like_the_fastapi_app() -> None:
    response = call("GET", "/nowhere")

    assert response.status_code == 404
    assert response.get_json() == {"message": "Not found"}

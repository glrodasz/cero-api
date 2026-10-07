"""One place turns every failure into the contract's `{"message": ...}` shape."""

from collections.abc import Callable, Coroutine
from http import HTTPStatus
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException

from cero_core import Messages, NotFoundError, ValidationError


def _message(status_code: int, message: str) -> JSONResponse:
    return JSONResponse({"message": message}, status_code=status_code)


async def handle_not_found(_request: Request, error: NotFoundError) -> JSONResponse:
    return _message(HTTPStatus.NOT_FOUND, str(error))


async def handle_core_validation(_request: Request, error: ValidationError) -> JSONResponse:
    return _message(HTTPStatus.BAD_REQUEST, str(error))


async def handle_invalid_request(_request: Request, error: RequestValidationError) -> JSONResponse:
    """Pydantic refused the request (wrong types, malformed JSON): 400, not FastAPI's 422."""
    problems = (
        f"{'.'.join(str(part) for part in problem['loc'])}: {problem['msg']}"
        for problem in error.errors()
    )
    return _message(HTTPStatus.BAD_REQUEST, "; ".join(problems))


async def handle_http_error(_request: Request, error: HTTPException) -> JSONResponse:
    # An unsupported method on a known path is an unknown route too, as in every other stack.
    if error.status_code in (HTTPStatus.NOT_FOUND, HTTPStatus.METHOD_NOT_ALLOWED):
        return _message(HTTPStatus.NOT_FOUND, Messages.ROUTE_NOT_FOUND)
    return _message(error.status_code, error.detail)


async def handle_unexpected(_request: Request, _error: Exception) -> JSONResponse:
    # Starlette re-raises the error after this response, so the server still logs it.
    return _message(HTTPStatus.INTERNAL_SERVER_ERROR, Messages.INTERNAL_ERROR)


type ExceptionHandler = Callable[[Request, Any], Coroutine[Any, Any, Response]]

EXCEPTION_HANDLERS: dict[int | type[Exception], ExceptionHandler] = {
    NotFoundError: handle_not_found,
    ValidationError: handle_core_validation,
    RequestValidationError: handle_invalid_request,
    HTTPException: handle_http_error,
    Exception: handle_unexpected,
}

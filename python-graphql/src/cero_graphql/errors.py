"""How errors reach clients: `errors[].extensions.code`, as the shared schema describes.

- The core's refusals keep their canonical message and get a code:
  NotFoundError → NOT_FOUND (REST 404), ValidationError → BAD_USER_INPUT (REST 400).
- Anything else a resolver raises is unexpected: masked as "Internal server error".
- Errors without a path were found before execution (syntax, validation,
  variable coercion). They are about the request and keep graphql-core's message.
"""

from collections.abc import Iterator
from typing import Final

from graphql import GraphQLError
from strawberry.extensions import SchemaExtension

from cero_core import Messages, NotFoundError, ValidationError

CODES: Final[dict[type[Exception], str]] = {
    NotFoundError: "NOT_FOUND",
    ValidationError: "BAD_USER_INPUT",
}


def _code(error: GraphQLError) -> str | None:
    return next(
        (code for kind, code in CODES.items() if isinstance(error.original_error, kind)), None
    )


def is_unexpected(error: GraphQLError) -> bool:
    """Raised while resolving a field, and not one of the core's refusals."""
    return error.path is not None and _code(error) is None


def _to_client_error(error: GraphQLError) -> GraphQLError:
    if (code := _code(error)) is not None:
        return GraphQLError(
            error.message,
            nodes=error.nodes,
            path=error.path,
            original_error=error.original_error,
            extensions={**(error.extensions or {}), "code": code},
        )
    if is_unexpected(error):
        return GraphQLError(Messages.INTERNAL_ERROR, nodes=error.nodes, path=error.path)
    return error


class ClientErrors(SchemaExtension):
    """Rewrites the errors of every operation once it has run (see the module docstring)."""

    def on_operation(self) -> Iterator[None]:
        yield
        result = self.execution_context.result
        if result is not None and result.errors:
            result.errors = [_to_client_error(error) for error in result.errors]

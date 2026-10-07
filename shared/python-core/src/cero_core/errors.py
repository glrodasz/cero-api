"""The two ways a use case can refuse a request.

Transports translate them: REST answers 404 / 400, GraphQL sets
`extensions.code`. Any other exception is an unexpected failure (500).
"""

from typing import Final


class NotFoundError(Exception):
    """The resource does not exist, or is not in a state that allows the action."""


class ValidationError(Exception):
    """The request asks for something the rules do not allow."""


class Messages:
    """Canonical messages, identical in every implementation of the API."""

    TASK_NOT_FOUND: Final = "Task not found"
    FOCUS_SESSION_NOT_FOUND: Final = "Focus session not found"
    NO_CURRENT_FOCUS_SESSION: Final = "No active focus session found"
    CANNOT_PAUSE: Final = "Focus session not found or cannot be paused"
    CANNOT_RESUME: Final = "Focus session not found or cannot be resumed"
    INVALID_TASK_STATUS: Final = "Invalid task status"
    UNKNOWN_FOCUS_SESSION: Final = "focusSessionId does not match any focus session"
    ROUTE_NOT_FOUND: Final = "Not found"
    INTERNAL_ERROR: Final = "Internal server error"

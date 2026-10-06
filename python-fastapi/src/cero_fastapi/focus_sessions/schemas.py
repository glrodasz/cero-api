from pydantic import ConfigDict, StrictInt, StrictStr

from cero_core import FocusSessionStatus
from cero_fastapi.api_model import ApiModel

# Strict types: the contract wants "now" for a number to be a 400, not coerced.


class StartFocusSessionBody(ApiModel):
    tasks: list[StrictStr] | None = None
    """Defaults to every in-progress and pending task."""
    start_time: StrictInt | None = None
    """Defaults to now."""


class PauseBody(ApiModel):
    time: StrictInt | None = None


class PauseResponse(ApiModel):
    id: str
    start_time: int
    end_time: int | None
    time: int


class FocusSessionResponse(ApiModel):
    id: str
    status: FocusSessionStatus
    start_time: int
    tasks: list[str]
    pauses: list[PauseResponse]


class NoFocusSession(ApiModel):
    """What GET /focus-sessions/active answers when no session is current: `{}`."""

    # Forbidding extra fields keeps a real session from ever matching this model.
    model_config = ConfigDict(extra="forbid")

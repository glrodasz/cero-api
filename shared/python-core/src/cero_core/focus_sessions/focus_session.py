from dataclasses import dataclass, replace
from enum import StrEnum
from typing import Final
from uuid import uuid4


class FocusSessionStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    FINISHED = "finished"


CURRENT_SESSION_STATUSES: Final = (FocusSessionStatus.ACTIVE, FocusSessionStatus.PAUSED)
"""A session in one of these statuses is "current": it has not been finished yet."""


@dataclass(frozen=True, slots=True)
class Pause:
    id: str
    start_time: int
    end_time: int | None
    """None while the pause is open."""
    time: int


@dataclass(frozen=True, slots=True)
class FocusSession:
    id: str
    status: FocusSessionStatus
    start_time: int
    tasks: tuple[str, ...]
    """Ids of the tasks the session started with."""
    pauses: tuple[Pause, ...]
    """Oldest first. Only the last pause can be open."""


@dataclass(frozen=True, slots=True)
class NewFocusSession:
    """A focus session before storage has given it an id."""

    status: FocusSessionStatus
    start_time: int
    tasks: tuple[str, ...]
    pauses: tuple[Pause, ...]


# The rules below are pure: they take a session and return a new one.
# The service decides when to apply them and persists the result.


def create_pause(*, start_time: int, time: int = 0) -> Pause:
    return Pause(id=str(uuid4()), start_time=start_time, end_time=None, time=time)


def open_pause(session: FocusSession) -> Pause | None:
    """The last pause, while it is still open."""
    if session.pauses and session.pauses[-1].end_time is None:
        return session.pauses[-1]
    return None


def close_open_pause(session: FocusSession, now: int) -> FocusSession:
    pause = open_pause(session)
    if pause is None:
        return session

    closed_pause = replace(pause, end_time=now, time=now - pause.start_time)
    return replace(session, pauses=(*session.pauses[:-1], closed_pause))


def start_pause(session: FocusSession, pause: Pause) -> FocusSession:
    return replace(session, status=FocusSessionStatus.PAUSED, pauses=(*session.pauses, pause))


def resume_session(session: FocusSession, now: int) -> FocusSession:
    return replace(close_open_pause(session, now), status=FocusSessionStatus.ACTIVE)


def finish_session(session: FocusSession, now: int) -> FocusSession:
    return replace(close_open_pause(session, now), status=FocusSessionStatus.FINISHED)


def shift_start_time_by_closed_pauses(session: FocusSession) -> FocusSession:
    """Moves `start_time` forward by the time spent in closed pauses, so a client
    can compute the focused time as `now - start_time`.
    """
    paused_time = sum(
        pause.end_time - pause.start_time for pause in session.pauses if pause.end_time is not None
    )
    return replace(session, start_time=session.start_time + paused_time)

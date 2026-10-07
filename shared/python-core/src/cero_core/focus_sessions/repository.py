from typing import Protocol

from cero_core.focus_sessions.focus_session import FocusSession, NewFocusSession


class FocusSessionRepository(Protocol):
    """The storage port for focus sessions. Pauses are stored inside their session.

    Contract every adapter honours:
    - a malformed id is simply "not found", it never raises;
    - `find_all` lists sessions oldest first.
    """

    async def find_all(self) -> list[FocusSession]: ...

    async def find_by_id(self, session_id: str) -> FocusSession | None: ...

    async def find_current(self) -> FocusSession | None:
        """The newest session that is active or paused."""
        ...

    async def create(self, session: NewFocusSession) -> FocusSession:
        """Storage assigns the id."""
        ...

    async def save(self, session: FocusSession) -> None:
        """Overwrites the stored session with the same id."""
        ...

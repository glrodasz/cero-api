from typing import cast

from postgrest import AsyncRequestBuilder, ReturnMethod
from supabase import AsyncClient

from cero_core import CURRENT_SESSION_STATUSES, FocusSession, NewFocusSession
from cero_supabase.ids import is_uuid
from cero_supabase.rows import (
    FOCUS_SESSION_COLUMNS,
    FOCUS_SESSIONS,
    FocusSessionRow,
    to_focus_session,
    to_focus_session_fields,
)


class SupabaseFocusSessionRepository:
    """Focus sessions through PostgREST; pauses live in a jsonb column of their session.

    As for tasks, a refused request raises `APIError` and writes return no row.
    """

    def __init__(self, client: AsyncClient) -> None:
        self._client = client

    async def find_all(self) -> list[FocusSession]:
        response = (
            await self._sessions().select(*FOCUS_SESSION_COLUMNS).order("created_at").execute()
        )
        return [to_focus_session(row) for row in cast(list[FocusSessionRow], response.data)]

    async def find_by_id(self, session_id: str) -> FocusSession | None:
        if not is_uuid(session_id):
            return None

        response = (
            await self._sessions()
            .select(*FOCUS_SESSION_COLUMNS)
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )
        return None if response is None else to_focus_session(cast(FocusSessionRow, response.data))

    async def find_current(self) -> FocusSession | None:
        response = (
            await self._sessions()
            .select(*FOCUS_SESSION_COLUMNS)
            .in_("status", CURRENT_SESSION_STATUSES)
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        return None if response is None else to_focus_session(cast(FocusSessionRow, response.data))

    async def create(self, session: NewFocusSession) -> FocusSession:
        response = (
            await self._sessions()
            .insert(to_focus_session_fields(session))
            .select(*FOCUS_SESSION_COLUMNS)
            .execute()
        )
        return to_focus_session(cast(FocusSessionRow, response.data[0]))

    async def save(self, session: FocusSession) -> None:
        if is_uuid(session.id):
            await (
                self._sessions()
                .update(to_focus_session_fields(session), returning=ReturnMethod.minimal)
                .eq("id", session.id)
                .execute()
            )

    def _sessions(self) -> AsyncRequestBuilder:
        return self._client.table(FOCUS_SESSIONS)

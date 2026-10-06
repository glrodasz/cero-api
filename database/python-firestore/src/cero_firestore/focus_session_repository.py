from contextlib import suppress

from google.api_core.exceptions import NotFound
from google.cloud.firestore import SERVER_TIMESTAMP, AsyncClient, FieldFilter, Query

from cero_core import CURRENT_SESSION_STATUSES, FocusSession, NewFocusSession
from cero_firestore.document_ids import is_document_id
from cero_firestore.documents import (
    CREATED_AT,
    FOCUS_SESSIONS,
    to_focus_session,
    to_focus_session_fields,
)


class FirestoreFocusSessionRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._sessions = client.collection(FOCUS_SESSIONS)

    async def find_all(self) -> list[FocusSession]:
        snapshots = await self._sessions.order_by(CREATED_AT).get()
        return [to_focus_session(snapshot) for snapshot in snapshots]

    async def find_by_id(self, session_id: str) -> FocusSession | None:
        if not is_document_id(session_id):
            return None

        snapshot = await self._sessions.document(session_id).get()
        return to_focus_session(snapshot) if snapshot.exists else None

    async def find_current(self) -> FocusSession | None:
        query = (
            self._sessions.where(filter=FieldFilter("status", "in", list(CURRENT_SESSION_STATUSES)))
            .order_by(CREATED_AT, direction=Query.DESCENDING)
            .limit(1)
        )
        newest = await query.get()
        return to_focus_session(newest[0]) if newest else None

    async def create(self, session: NewFocusSession) -> FocusSession:
        reference = self._sessions.document()
        await reference.create({**to_focus_session_fields(session), CREATED_AT: SERVER_TIMESTAMP})
        return FocusSession(
            id=reference.id,
            status=session.status,
            start_time=session.start_time,
            tasks=session.tasks,
            pauses=session.pauses,
        )

    async def save(self, session: FocusSession) -> None:
        if not is_document_id(session.id):
            return

        # `update` refuses a missing document, and saving one is a no-op, as the port asks.
        with suppress(NotFound):
            await self._sessions.document(session.id).update(dict(to_focus_session_fields(session)))

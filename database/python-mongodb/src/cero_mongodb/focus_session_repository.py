from typing import Final

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING
from pymongo.asynchronous.collection import AsyncCollection

from cero_core import (
    CURRENT_SESSION_STATUSES,
    FocusSession,
    FocusSessionStatus,
    NewFocusSession,
    Pause,
)
from cero_mongodb.documents import FocusSessionDocument, PauseDocument, Query
from cero_mongodb.ids import parse_id

# ObjectIds grow with time, so sorting by `_id` is sorting by creation.
OLDEST_FIRST: Final = [("_id", ASCENDING)]
NEWEST_FIRST: Final = [("_id", DESCENDING)]


def _to_focus_session(document: FocusSessionDocument) -> FocusSession:
    return FocusSession(
        id=str(document["_id"]),
        status=FocusSessionStatus(document["status"]),
        start_time=document["startTime"],
        tasks=tuple(document["tasks"]),
        pauses=tuple(_to_pause(pause) for pause in document["pauses"]),
    )


def _to_pause(document: PauseDocument) -> Pause:
    return Pause(
        id=document["id"],
        start_time=document["startTime"],
        end_time=document["endTime"],
        time=document["time"],
    )


def _to_pause_document(pause: Pause) -> PauseDocument:
    return {
        "id": pause.id,
        "startTime": pause.start_time,
        "endTime": pause.end_time,
        "time": pause.time,
    }


class MongoFocusSessionRepository:
    def __init__(self, collection: AsyncCollection[FocusSessionDocument]) -> None:
        self._collection = collection

    async def find_all(self) -> list[FocusSession]:
        cursor = self._collection.find(sort=OLDEST_FIRST)
        return [_to_focus_session(document) async for document in cursor]

    async def find_by_id(self, session_id: str) -> FocusSession | None:
        if (key := parse_id(session_id)) is None:
            return None

        document = await self._collection.find_one({"_id": key})
        return None if document is None else _to_focus_session(document)

    async def find_current(self) -> FocusSession | None:
        document = await self._collection.find_one(
            {"status": {"$in": list(CURRENT_SESSION_STATUSES)}}, sort=NEWEST_FIRST
        )
        return None if document is None else _to_focus_session(document)

    async def create(self, session: NewFocusSession) -> FocusSession:
        document: FocusSessionDocument = {
            "_id": ObjectId(),
            "status": session.status,
            "startTime": session.start_time,
            "tasks": list(session.tasks),
            "pauses": [_to_pause_document(pause) for pause in session.pauses],
        }
        await self._collection.insert_one(document)
        return _to_focus_session(document)

    async def save(self, session: FocusSession) -> None:
        if (key := parse_id(session.id)) is None:
            return

        fields: Query = {
            "status": session.status,
            "startTime": session.start_time,
            "tasks": list(session.tasks),
            "pauses": [_to_pause_document(pause) for pause in session.pauses],
        }
        await self._collection.update_one({"_id": key}, {"$set": fields})

from collections.abc import Sequence
from typing import Final

from bson import ObjectId
from pymongo import ASCENDING
from pymongo.asynchronous.collection import AsyncCollection

from cero_core import NewTask, Task, TaskFilter, TaskStatus
from cero_mongodb.documents import Query, TaskDocument
from cero_mongodb.ids import parse_id, parse_ids

# ObjectIds grow with time, so sorting by `_id` is sorting by creation.
BY_PRIORITY_THEN_CREATION: Final = [("priority", ASCENDING), ("_id", ASCENDING)]


def _to_task(document: TaskDocument) -> Task:
    return Task(
        id=str(document["_id"]),
        description=document["description"],
        priority=document["priority"],
        status=TaskStatus(document["status"]),
        focus_session_id=document["focusSessionId"],
    )


class MongoTaskRepository:
    def __init__(self, collection: AsyncCollection[TaskDocument]) -> None:
        self._collection = collection

    async def find_by_id(self, task_id: str) -> Task | None:
        if (key := parse_id(task_id)) is None:
            return None

        document = await self._collection.find_one({"_id": key})
        return None if document is None else _to_task(document)

    async def find_many(self, task_filter: TaskFilter) -> list[Task]:
        query: Query = {}
        if task_filter.ids is not None:
            query["_id"] = {"$in": parse_ids(task_filter.ids)}
        if task_filter.statuses is not None:
            query["status"] = {"$in": list(task_filter.statuses)}
        if task_filter.focus_session_id is not None:
            query["focusSessionId"] = task_filter.focus_session_id

        cursor = self._collection.find(query, sort=BY_PRIORITY_THEN_CREATION)
        return [_to_task(document) async for document in cursor]

    async def count_by_status(self, status: TaskStatus) -> int:
        return await self._collection.count_documents({"status": status})

    async def create(self, task: NewTask) -> Task:
        document: TaskDocument = {
            "_id": ObjectId(),
            "description": task.description,
            "priority": task.priority,
            "status": task.status,
            "focusSessionId": task.focus_session_id,
        }
        await self._collection.insert_one(document)
        return _to_task(document)

    async def save(self, task: Task) -> None:
        if (key := parse_id(task.id)) is None:
            return

        fields: Query = {
            "description": task.description,
            "priority": task.priority,
            "status": task.status,
            "focusSessionId": task.focus_session_id,
        }
        await self._collection.update_one({"_id": key}, {"$set": fields})

    async def delete(self, task_id: str) -> None:
        if (key := parse_id(task_id)) is not None:
            await self._collection.delete_one({"_id": key})

    async def assign_focus_session(
        self, task_ids: Sequence[str], focus_session_id: str | None
    ) -> None:
        if keys := parse_ids(task_ids):
            await self._collection.update_many(
                {"_id": {"$in": keys}}, {"$set": {"focusSessionId": focus_session_id}}
            )

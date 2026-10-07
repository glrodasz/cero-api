import asyncio
from dataclasses import replace

from cero_core.errors import Messages, NotFoundError, ValidationError
from cero_core.focus_sessions.repository import FocusSessionRepository
from cero_core.tasks.repository import TaskFilter, TaskRepository
from cero_core.tasks.task import (
    ACTIVE_TASK_STATUSES,
    NewTask,
    Task,
    TaskChanges,
    TaskStatus,
    renumber,
    status_for_new_task,
)


class TasksService:
    """The task use cases. One public method per API endpoint."""

    def __init__(self, *, tasks: TaskRepository, focus_sessions: FocusSessionRepository) -> None:
        self._tasks = tasks
        self._focus_sessions = focus_sessions

    async def list(self) -> list[Task]:
        """What the user should be looking at: the current session's tasks,
        or every unfinished task when no session is current.
        """
        current_session = await self._focus_sessions.find_current()
        if current_session is None:
            return await self._tasks.find_many(TaskFilter(statuses=ACTIVE_TASK_STATUSES))
        return await self._tasks.find_many(TaskFilter(focus_session_id=current_session.id))

    async def get(self, task_id: str) -> Task:
        task = await self._tasks.find_by_id(task_id)
        if task is None:
            raise NotFoundError(Messages.TASK_NOT_FOUND)
        return task

    async def create(self, *, description: str) -> Task:
        in_progress_count, current_session = await asyncio.gather(
            self._tasks.count_by_status(TaskStatus.IN_PROGRESS),
            self._focus_sessions.find_current(),
        )

        return await self._tasks.create(
            NewTask(
                description=description,
                priority=0,
                status=status_for_new_task(in_progress_count),
                focus_session_id=None if current_session is None else current_session.id,
            )
        )

    async def complete(self, task_id: str) -> Task:
        return await self._move_to_top_of(TaskStatus.COMPLETED, await self.get(task_id))

    async def reset(self, task_id: str) -> Task:
        return await self._move_to_top_of(TaskStatus.PENDING, await self.get(task_id))

    async def change_status(self, task_id: str, status: str) -> Task:
        if status not in TaskStatus:
            raise ValidationError(Messages.INVALID_TASK_STATUS)

        task = await self.get(task_id)
        updated_task = replace(task, status=TaskStatus(status))
        await self._tasks.save(updated_task)
        return updated_task

    async def update(self, task_id: str, changes: TaskChanges) -> Task:
        await self._validate_changes(changes)
        task = await self.get(task_id)

        updated_task = replace(task, **changes)
        await self._tasks.save(updated_task)
        return updated_task

    async def delete(self, task_id: str) -> Task:
        task = await self.get(task_id)
        await self._tasks.delete(task.id)
        return task

    async def _move_to_top_of(self, status: TaskStatus, task: Task) -> Task:
        """The task becomes priority 0 of the group; the rest of the group follows as 1..n."""
        group = await self._tasks.find_many(TaskFilter(statuses=[status]))
        rest = [member for member in group if member.id != task.id]

        moved_task = replace(task, status=status, priority=0)
        await asyncio.gather(
            *(self._tasks.save(member) for member in [*renumber(rest), moved_task])
        )
        return moved_task

    async def _validate_changes(self, changes: TaskChanges) -> None:
        # A transport without its own enum validation could pass any string through.
        if "status" in changes and changes["status"] not in TaskStatus:
            raise ValidationError(Messages.INVALID_TASK_STATUS)

        session_id = changes.get("focus_session_id")
        if session_id is not None and await self._focus_sessions.find_by_id(session_id) is None:
            raise ValidationError(Messages.UNKNOWN_FOCUS_SESSION)

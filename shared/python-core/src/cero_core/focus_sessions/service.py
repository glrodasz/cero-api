from collections.abc import Sequence

from cero_core.clock import Clock
from cero_core.errors import Messages, NotFoundError
from cero_core.focus_sessions.focus_session import (
    FocusSession,
    FocusSessionStatus,
    NewFocusSession,
    close_open_pause,
    create_pause,
    finish_session,
    open_pause,
    resume_session,
    shift_start_time_by_closed_pauses,
    start_pause,
)
from cero_core.focus_sessions.repository import FocusSessionRepository
from cero_core.tasks.repository import TaskFilter, TaskRepository
from cero_core.tasks.task import ACTIVE_TASK_STATUSES, Task


class FocusSessionsService:
    """The focus session use cases. One public method per API endpoint."""

    def __init__(
        self, *, focus_sessions: FocusSessionRepository, tasks: TaskRepository, clock: Clock
    ) -> None:
        self._focus_sessions = focus_sessions
        self._tasks = tasks
        self._clock = clock

    async def list(self) -> list[FocusSession]:
        return await self._focus_sessions.find_all()

    async def get_current(self) -> FocusSession | None:
        """The current session as a client should display it, or None when there is none."""
        session = await self._focus_sessions.find_current()
        return None if session is None else shift_start_time_by_closed_pauses(session)

    async def start(
        self, *, task_ids: Sequence[str] = (), start_time: int | None = None
    ) -> FocusSession:
        tasks = (
            await self._find_in_request_order(task_ids)
            if task_ids
            else await self._tasks.find_many(TaskFilter(statuses=ACTIVE_TASK_STATUSES))
        )
        session_task_ids = tuple(task.id for task in tasks)

        session = await self._focus_sessions.create(
            NewFocusSession(
                status=FocusSessionStatus.ACTIVE,
                start_time=self._clock() if start_time is None else start_time,
                tasks=session_task_ids,
                pauses=(),
            )
        )
        await self._tasks.assign_focus_session(session_task_ids, session.id)
        return session

    async def finish(self, session_id: str) -> FocusSession:
        return await self._finish(await self._get(session_id))

    async def finish_current(self) -> FocusSession:
        return await self._finish(await self._get_current())

    async def pause(self, session_id: str) -> FocusSession:
        session = await self._focus_sessions.find_by_id(session_id)
        if session is None or session.status != FocusSessionStatus.ACTIVE:
            raise NotFoundError(Messages.CANNOT_PAUSE)

        return await self._save(start_pause(session, create_pause(start_time=self._clock())))

    async def pause_current(self, *, time: int | None = None) -> FocusSession:
        """Pauses the current session. Sending `time` always starts a fresh pause
        (closing an open one first); without it, an already paused session stays as is.
        """
        session = await self._get_current()
        if open_pause(session) is not None and time is None:
            return session

        now = self._clock()
        new_pause = create_pause(start_time=now, time=time or 0)
        return await self._save(start_pause(close_open_pause(session, now), new_pause))

    async def resume(self, session_id: str) -> FocusSession:
        session = await self._focus_sessions.find_by_id(session_id)
        if session is None or session.status != FocusSessionStatus.PAUSED:
            raise NotFoundError(Messages.CANNOT_RESUME)

        return await self._save(resume_session(session, self._clock()))

    async def resume_current(self) -> FocusSession:
        session = await self._get_current()
        if open_pause(session) is None:
            return session

        return await self._save(resume_session(session, self._clock()))

    async def _get(self, session_id: str) -> FocusSession:
        session = await self._focus_sessions.find_by_id(session_id)
        if session is None:
            raise NotFoundError(Messages.FOCUS_SESSION_NOT_FOUND)
        return session

    async def _get_current(self) -> FocusSession:
        session = await self._focus_sessions.find_current()
        if session is None:
            raise NotFoundError(Messages.NO_CURRENT_FOCUS_SESSION)
        return session

    async def _finish(self, session: FocusSession) -> FocusSession:
        """Finished sessions let go of their unfinished tasks.

        Completed tasks keep the session, as history.
        """
        finished_session = await self._save(finish_session(session, self._clock()))

        unfinished_tasks = await self._tasks.find_many(
            TaskFilter(focus_session_id=session.id, statuses=ACTIVE_TASK_STATUSES)
        )
        await self._tasks.assign_focus_session([task.id for task in unfinished_tasks], None)
        return finished_session

    async def _find_in_request_order(self, task_ids: Sequence[str]) -> Sequence[Task]:
        """Unknown ids are dropped; the rest keep the order they were requested in."""
        found = await self._tasks.find_many(TaskFilter(ids=task_ids))
        tasks_by_id = {task.id: task for task in found}
        unique_ids = dict.fromkeys(task_ids)
        return [tasks_by_id[task_id] for task_id in unique_ids if task_id in tasks_by_id]

    async def _save(self, session: FocusSession) -> FocusSession:
        await self._focus_sessions.save(session)
        return session

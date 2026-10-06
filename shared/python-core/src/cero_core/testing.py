"""The repository contract: the behaviour every storage adapter must honour, as pytest tests.

Install `cero-core[testing]` to use it. An adapter's test module subclasses
`RepositoryContract` (as `Test...`, so pytest collects it) and overrides the
`repositories` fixture with repositories over empty storage:

    class TestMyDatabaseRepositories(RepositoryContract):
        @pytest.fixture
        async def repositories(self) -> Repositories:
            return create_my_repositories(await empty_database())

See `database/python-postgres/tests` and `database/python-mongodb/tests`.
"""

from abc import ABC, abstractmethod
from dataclasses import replace
from typing import Final

import pytest

from cero_core.composition import Repositories
from cero_core.focus_sessions.focus_session import FocusSessionStatus, NewFocusSession, Pause
from cero_core.tasks.repository import TaskFilter
from cero_core.tasks.task import NewTask, Task, TaskStatus

A_TASK: Final = NewTask(
    description="a task", priority=0, status=TaskStatus.PENDING, focus_session_id=None
)
A_SESSION: Final = NewFocusSession(
    status=FocusSessionStatus.ACTIVE, start_time=1_000, tasks=(), pauses=()
)


class RepositoryContract(ABC):
    """The storage contract. Subclasses provide the `repositories` fixture."""

    @pytest.fixture
    @abstractmethod
    def repositories(self) -> Repositories:
        """Repositories over empty storage, fresh for every test."""

    # Tasks

    async def test_assigns_an_id_on_create_and_finds_the_task_by_it(
        self, repositories: Repositories
    ) -> None:
        created = await repositories.tasks.create(replace(A_TASK, description="stored"))

        assert isinstance(created.id, str)
        assert await repositories.tasks.find_by_id(created.id) == created

    async def test_finds_nothing_for_unknown_or_malformed_ids(
        self, repositories: Repositories
    ) -> None:
        deleted = await repositories.tasks.create(A_TASK)
        await repositories.tasks.delete(deleted.id)

        assert await repositories.tasks.find_by_id(deleted.id) is None
        assert await repositories.tasks.find_by_id("not-an-id") is None

    async def test_sorts_by_priority_then_creation_order(self, repositories: Repositories) -> None:
        second = await repositories.tasks.create(replace(A_TASK, priority=1))
        third = await repositories.tasks.create(replace(A_TASK, priority=1))
        first = await repositories.tasks.create(replace(A_TASK, priority=0))

        tasks = await repositories.tasks.find_many(TaskFilter())

        assert [task.id for task in tasks] == [first.id, second.id, third.id]

    async def test_combines_every_filter_criterion(self, repositories: Repositories) -> None:
        session = await repositories.focus_sessions.create(A_SESSION)
        match = await repositories.tasks.create(
            replace(A_TASK, status=TaskStatus.PENDING, focus_session_id=session.id)
        )
        await repositories.tasks.create(
            replace(A_TASK, status=TaskStatus.COMPLETED, focus_session_id=session.id)
        )
        other = await repositories.tasks.create(replace(A_TASK, status=TaskStatus.PENDING))

        by_all = await repositories.tasks.find_many(
            TaskFilter(
                ids=[match.id, other.id, "not-an-id"],
                statuses=[TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
                focus_session_id=session.id,
            )
        )

        assert [task.id for task in by_all] == [match.id]
        assert await repositories.tasks.find_many(TaskFilter(ids=[])) == []

    async def test_counts_tasks_by_status(self, repositories: Repositories) -> None:
        await repositories.tasks.create(replace(A_TASK, status=TaskStatus.IN_PROGRESS))
        await repositories.tasks.create(replace(A_TASK, status=TaskStatus.IN_PROGRESS))
        await repositories.tasks.create(replace(A_TASK, status=TaskStatus.PENDING))

        assert await repositories.tasks.count_by_status(TaskStatus.IN_PROGRESS) == 2
        assert await repositories.tasks.count_by_status(TaskStatus.COMPLETED) == 0

    async def test_overwrites_a_task_on_save(self, repositories: Repositories) -> None:
        task = await repositories.tasks.create(A_TASK)
        changed = replace(task, description="changed", priority=3, status=TaskStatus.COMPLETED)

        await repositories.tasks.save(changed)

        assert await repositories.tasks.find_by_id(task.id) == changed

    async def test_assigns_and_clears_the_focus_session_of_many_tasks_at_once(
        self, repositories: Repositories
    ) -> None:
        session = await repositories.focus_sessions.create(A_SESSION)
        a = await repositories.tasks.create(A_TASK)
        b = await repositories.tasks.create(A_TASK)

        await repositories.tasks.assign_focus_session([a.id, b.id, "not-an-id"], session.id)
        in_session = await repositories.tasks.find_many(TaskFilter(focus_session_id=session.id))
        assert [task.id for task in in_session] == [a.id, b.id]

        await repositories.tasks.assign_focus_session([a.id], None)
        cleared = await repositories.tasks.find_by_id(a.id)
        assert cleared is not None
        assert cleared.focus_session_id is None

    async def test_ignores_malformed_ids_on_save_and_delete(
        self, repositories: Repositories
    ) -> None:
        await repositories.tasks.save(
            Task(
                id="not-an-id",
                description=A_TASK.description,
                priority=A_TASK.priority,
                status=A_TASK.status,
                focus_session_id=A_TASK.focus_session_id,
            )
        )
        await repositories.tasks.delete("not-an-id")

        assert await repositories.tasks.find_many(TaskFilter()) == []

    # Focus sessions

    async def test_assigns_an_id_on_create_and_finds_the_session_by_it_pauses_included(
        self, repositories: Repositories
    ) -> None:
        # Task ids are storage-specific (ObjectId, UUID...), so the session refers to real tasks.
        first = await repositories.tasks.create(A_TASK)
        second = await repositories.tasks.create(A_TASK)
        created = await repositories.focus_sessions.create(
            replace(
                A_SESSION,
                status=FocusSessionStatus.PAUSED,
                tasks=(second.id, first.id),
                pauses=(Pause(id="pause-1", start_time=1_500, end_time=None, time=0),),
            )
        )

        assert isinstance(created.id, str)
        assert await repositories.focus_sessions.find_by_id(created.id) == created
        assert await repositories.focus_sessions.find_by_id("not-an-id") is None

    async def test_lists_sessions_oldest_first(self, repositories: Repositories) -> None:
        first = await repositories.focus_sessions.create(replace(A_SESSION, start_time=9))
        second = await repositories.focus_sessions.create(replace(A_SESSION, start_time=1))

        sessions = await repositories.focus_sessions.find_all()

        assert [session.id for session in sessions] == [first.id, second.id]

    async def test_finds_the_newest_active_or_paused_session_as_current(
        self, repositories: Repositories
    ) -> None:
        assert await repositories.focus_sessions.find_current() is None

        await repositories.focus_sessions.create(
            replace(A_SESSION, status=FocusSessionStatus.ACTIVE)
        )
        newest = await repositories.focus_sessions.create(
            replace(A_SESSION, status=FocusSessionStatus.PAUSED)
        )
        await repositories.focus_sessions.create(
            replace(A_SESSION, status=FocusSessionStatus.FINISHED)
        )

        current = await repositories.focus_sessions.find_current()
        assert current is not None
        assert current.id == newest.id

    async def test_overwrites_a_session_on_save(self, repositories: Repositories) -> None:
        session = await repositories.focus_sessions.create(A_SESSION)
        changed = replace(
            session,
            status=FocusSessionStatus.FINISHED,
            pauses=(Pause(id="pause-1", start_time=1_100, end_time=1_400, time=300),),
        )

        await repositories.focus_sessions.save(changed)

        assert await repositories.focus_sessions.find_by_id(session.id) == changed

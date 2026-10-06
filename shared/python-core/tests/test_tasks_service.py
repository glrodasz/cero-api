from typing import cast

import pytest

from cero_core import (
    FocusSessionsService,
    Messages,
    NotFoundError,
    Task,
    TaskChanges,
    TasksService,
    TaskStatus,
    ValidationError,
)


async def create_tasks(tasks: TasksService, *descriptions: str) -> list[Task]:
    """Creates the tasks one after another, since creation order matters."""
    return [await tasks.create(description=description) for description in descriptions]


async def priorities(tasks: TasksService, *task_ids: str) -> list[int]:
    return [(await tasks.get(task_id)).priority for task_id in task_ids]


class TestList:
    async def test_lists_in_progress_and_pending_tasks_by_priority_when_no_session_is_current(
        self, tasks: TasksService
    ) -> None:
        first, second, done = await create_tasks(tasks, "first", "second", "done")
        await tasks.complete(done.id)
        await tasks.update(first.id, {"priority": 5})

        listed = await tasks.list()

        assert [task.id for task in listed] == [second.id, first.id]

    async def test_lists_the_current_sessions_tasks_completed_ones_included(
        self, tasks: TasksService, focus_sessions: FocusSessionsService
    ) -> None:
        [in_session] = await create_tasks(tasks, "in session")
        await focus_sessions.start(task_ids=[in_session.id])
        await tasks.complete(in_session.id)
        outside = await tasks.create(description="created during the session")
        await tasks.update(outside.id, {"focus_session_id": None})

        listed = await tasks.list()

        assert [task.id for task in listed] == [in_session.id]

    async def test_keeps_creation_order_between_tasks_with_the_same_priority(
        self, tasks: TasksService
    ) -> None:
        descriptions = ["a", "b", "c"]
        await create_tasks(tasks, *descriptions)

        listed = await tasks.list()

        assert [task.description for task in listed] == descriptions


class TestGet:
    async def test_fails_with_not_found_for_an_unknown_id(self, tasks: TasksService) -> None:
        with pytest.raises(NotFoundError, match=Messages.TASK_NOT_FOUND):
            await tasks.get("unknown")


class TestCreate:
    async def test_starts_tasks_in_progress_until_three_are_in_progress_then_as_pending(
        self, tasks: TasksService
    ) -> None:
        created = await create_tasks(tasks, "1", "2", "3", "4")

        assert [task.status for task in created] == [
            TaskStatus.IN_PROGRESS,
            TaskStatus.IN_PROGRESS,
            TaskStatus.IN_PROGRESS,
            TaskStatus.PENDING,
        ]

    async def test_creates_the_task_at_priority_0_without_a_session_when_none_is_current(
        self, tasks: TasksService
    ) -> None:
        task = await tasks.create(description="write tests")

        assert task == Task(
            id=task.id,
            description="write tests",
            priority=0,
            status=TaskStatus.IN_PROGRESS,
            focus_session_id=None,
        )

    async def test_attaches_the_task_to_the_current_session(
        self, tasks: TasksService, focus_sessions: FocusSessionsService
    ) -> None:
        session = await focus_sessions.start()

        task = await tasks.create(description="joins the session")

        assert task.focus_session_id == session.id


class TestComplete:
    async def test_puts_the_task_on_top_of_the_completed_group_and_renumbers_the_rest(
        self, tasks: TasksService
    ) -> None:
        a, b, c = await create_tasks(tasks, "a", "b", "c")
        await tasks.complete(a.id)
        await tasks.complete(b.id)

        completed = await tasks.complete(c.id)

        assert (completed.status, completed.priority) == (TaskStatus.COMPLETED, 0)
        assert await priorities(tasks, c.id, b.id, a.id) == [0, 1, 2]

    async def test_changes_nothing_when_the_task_does_not_exist(self, tasks: TasksService) -> None:
        [a] = await create_tasks(tasks, "a")
        await tasks.complete(a.id)
        await tasks.update(a.id, {"priority": 7})

        with pytest.raises(NotFoundError):
            await tasks.complete("unknown")

        assert await priorities(tasks, a.id) == [7]


class TestReset:
    async def test_puts_the_task_on_top_of_the_pending_group_and_renumbers_the_rest(
        self, tasks: TasksService
    ) -> None:
        a, b, c, d = await create_tasks(tasks, "a", "b", "c", "d")  # d starts pending
        await tasks.reset(c.id)

        reset = await tasks.reset(a.id)

        assert (reset.status, reset.priority) == (TaskStatus.PENDING, 0)
        assert await priorities(tasks, a.id, c.id, d.id) == [0, 1, 2]
        assert (await tasks.get(b.id)).status == TaskStatus.IN_PROGRESS


class TestChangeStatus:
    async def test_sets_only_the_status(self, tasks: TasksService) -> None:
        [task] = await create_tasks(tasks, "a")
        await tasks.update(task.id, {"priority": 4})

        updated = await tasks.change_status(task.id, "pending")

        assert (updated.status, updated.priority) == (TaskStatus.PENDING, 4)

    async def test_rejects_an_unknown_status_before_looking_the_task_up(
        self, tasks: TasksService
    ) -> None:
        with pytest.raises(ValidationError, match=Messages.INVALID_TASK_STATUS):
            await tasks.change_status("unknown", "done")


class TestUpdate:
    async def test_changes_only_the_given_fields(
        self, tasks: TasksService, focus_sessions: FocusSessionsService
    ) -> None:
        await focus_sessions.start()
        task = await tasks.create(description="before")  # joins the session

        updated = await tasks.update(task.id, {"description": "after", "focus_session_id": None})

        assert updated == Task(
            id=task.id,
            description="after",
            priority=task.priority,
            status=task.status,
            focus_session_id=None,
        )

    async def test_rejects_an_unknown_status(self, tasks: TasksService) -> None:
        [task] = await create_tasks(tasks, "a")
        # A transport without its own enum validation could pass anything through.
        changes = cast(TaskChanges, {"status": "done"})

        with pytest.raises(ValidationError, match=Messages.INVALID_TASK_STATUS):
            await tasks.update(task.id, changes)

    async def test_rejects_a_focus_session_id_that_does_not_match_a_session(
        self, tasks: TasksService
    ) -> None:
        [task] = await create_tasks(tasks, "a")

        with pytest.raises(ValidationError, match=Messages.UNKNOWN_FOCUS_SESSION):
            await tasks.update(task.id, {"focus_session_id": "unknown"})


class TestDelete:
    async def test_removes_the_task_and_returns_it(self, tasks: TasksService) -> None:
        [task] = await create_tasks(tasks, "a")

        deleted = await tasks.delete(task.id)

        assert deleted == task
        with pytest.raises(NotFoundError):
            await tasks.get(task.id)

    async def test_fails_with_not_found_for_an_unknown_id(self, tasks: TasksService) -> None:
        with pytest.raises(NotFoundError, match=Messages.TASK_NOT_FOUND):
            await tasks.delete("unknown")

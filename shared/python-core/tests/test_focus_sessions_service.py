from collections.abc import Callable

import pytest

from cero_core import (
    Clock,
    FocusSession,
    FocusSessionsService,
    FocusSessionStatus,
    Messages,
    NotFoundError,
    TasksService,
)

type AdvanceClock = Callable[[int], None]


def without_ids(session: FocusSession) -> list[tuple[int, int | None, int]]:
    """The pauses as (start_time, end_time, time), since pause ids are random."""
    return [(pause.start_time, pause.end_time, pause.time) for pause in session.pauses]


class TestStart:
    async def test_starts_an_active_session_with_every_in_progress_and_pending_task_by_default(
        self, tasks: TasksService, focus_sessions: FocusSessionsService, clock: Clock
    ) -> None:
        active = await tasks.create(description="active")
        done = await tasks.create(description="done")
        await tasks.complete(done.id)

        session = await focus_sessions.start()

        assert session == FocusSession(
            id=session.id,
            status=FocusSessionStatus.ACTIVE,
            start_time=clock(),
            tasks=(active.id,),
            pauses=(),
        )
        assert (await tasks.get(active.id)).focus_session_id == session.id
        assert (await tasks.get(done.id)).focus_session_id is None

    async def test_keeps_requested_tasks_in_request_order_dropping_unknown_and_repeated_ids(
        self, tasks: TasksService, focus_sessions: FocusSessionsService
    ) -> None:
        a = await tasks.create(description="a")
        b = await tasks.create(description="b")

        session = await focus_sessions.start(task_ids=[b.id, "unknown", a.id, b.id])

        assert session.tasks == (b.id, a.id)

    async def test_uses_the_given_start_time(self, focus_sessions: FocusSessionsService) -> None:
        session = await focus_sessions.start(start_time=42)

        assert session.start_time == 42


class TestGetCurrent:
    async def test_returns_none_when_no_session_is_current(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        await focus_sessions.start()
        await focus_sessions.finish_current()

        assert await focus_sessions.get_current() is None

    async def test_moves_start_time_forward_by_the_closed_pauses_only(
        self, focus_sessions: FocusSessionsService, advance_clock: AdvanceClock
    ) -> None:
        session = await focus_sessions.start()
        await focus_sessions.pause(session.id)
        advance_clock(300)
        await focus_sessions.resume(session.id)
        await focus_sessions.pause(session.id)
        advance_clock(5_000)  # still open: not counted yet

        current = await focus_sessions.get_current()

        assert current is not None
        assert current.start_time == session.start_time + 300

    async def test_returns_the_newest_current_session(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        await focus_sessions.start()
        newest = await focus_sessions.start()

        current = await focus_sessions.get_current()

        assert current is not None
        assert current.id == newest.id


class TestPause:
    async def test_opens_a_pause_on_an_active_session(
        self, focus_sessions: FocusSessionsService, clock: Clock, advance_clock: AdvanceClock
    ) -> None:
        session = await focus_sessions.start()
        advance_clock(1_000)

        paused = await focus_sessions.pause(session.id)

        assert paused.status == FocusSessionStatus.PAUSED
        assert without_ids(paused) == [(clock(), None, 0)]

    async def test_refuses_sessions_that_are_not_active(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        session = await focus_sessions.start()
        await focus_sessions.pause(session.id)

        with pytest.raises(NotFoundError, match=Messages.CANNOT_PAUSE):
            await focus_sessions.pause(session.id)
        with pytest.raises(NotFoundError, match=Messages.CANNOT_PAUSE):
            await focus_sessions.pause("unknown")


class TestPauseCurrent:
    async def test_fails_when_no_session_is_current(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        with pytest.raises(NotFoundError, match=Messages.NO_CURRENT_FOCUS_SESSION):
            await focus_sessions.pause_current()

    async def test_opens_a_pause_on_an_active_session(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        await focus_sessions.start()

        paused = await focus_sessions.pause_current()

        assert paused.status == FocusSessionStatus.PAUSED
        assert len(paused.pauses) == 1
        assert paused.pauses[0].end_time is None

    async def test_leaves_an_already_paused_session_as_is_when_no_time_is_given(
        self, focus_sessions: FocusSessionsService, advance_clock: AdvanceClock
    ) -> None:
        await focus_sessions.start()
        paused = await focus_sessions.pause_current()
        advance_clock(1_000)

        assert await focus_sessions.pause_current() == paused

    async def test_closes_the_open_pause_and_opens_a_new_one_with_the_given_time(
        self, focus_sessions: FocusSessionsService, clock: Clock, advance_clock: AdvanceClock
    ) -> None:
        await focus_sessions.start()
        await focus_sessions.pause_current()
        first_pause_start = clock()
        advance_clock(1_000)

        paused = await focus_sessions.pause_current(time=25)

        assert without_ids(paused) == [
            (first_pause_start, clock(), 1_000),
            (clock(), None, 25),
        ]


class TestResume:
    async def test_closes_the_open_pause_of_a_paused_session(
        self, focus_sessions: FocusSessionsService, clock: Clock, advance_clock: AdvanceClock
    ) -> None:
        session = await focus_sessions.start()
        await focus_sessions.pause(session.id)
        advance_clock(700)

        resumed = await focus_sessions.resume(session.id)

        assert resumed.status == FocusSessionStatus.ACTIVE
        assert [(pause.end_time, pause.time) for pause in resumed.pauses] == [(clock(), 700)]

    async def test_refuses_sessions_that_are_not_paused(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        session = await focus_sessions.start()

        with pytest.raises(NotFoundError, match=Messages.CANNOT_RESUME):
            await focus_sessions.resume(session.id)


class TestResumeCurrent:
    async def test_closes_the_open_pause_of_the_current_session(
        self, focus_sessions: FocusSessionsService, advance_clock: AdvanceClock
    ) -> None:
        await focus_sessions.start()
        await focus_sessions.pause_current()
        advance_clock(200)

        resumed = await focus_sessions.resume_current()

        assert resumed.status == FocusSessionStatus.ACTIVE
        assert resumed.pauses[0].time == 200

    async def test_leaves_a_session_without_an_open_pause_as_is(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        session = await focus_sessions.start()

        assert await focus_sessions.resume_current() == session

    async def test_fails_when_no_session_is_current(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        with pytest.raises(NotFoundError, match=Messages.NO_CURRENT_FOCUS_SESSION):
            await focus_sessions.resume_current()


class TestFinish:
    async def test_closes_the_open_pause_and_releases_the_unfinished_tasks_only(
        self,
        tasks: TasksService,
        focus_sessions: FocusSessionsService,
        advance_clock: AdvanceClock,
    ) -> None:
        unfinished = await tasks.create(description="unfinished")
        done = await tasks.create(description="done")
        session = await focus_sessions.start()
        await tasks.complete(done.id)
        await focus_sessions.pause(session.id)
        advance_clock(400)

        finished = await focus_sessions.finish(session.id)

        assert finished.status == FocusSessionStatus.FINISHED
        assert finished.pauses[0].time == 400
        assert (await tasks.get(unfinished.id)).focus_session_id is None
        assert (await tasks.get(done.id)).focus_session_id == session.id

    async def test_fails_with_not_found_for_an_unknown_id(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        # Anchored, because the "cannot be paused/resumed" messages start the same way.
        with pytest.raises(NotFoundError, match=f"^{Messages.FOCUS_SESSION_NOT_FOUND}$"):
            await focus_sessions.finish("unknown")


class TestFinishCurrent:
    async def test_finishes_the_current_session(self, focus_sessions: FocusSessionsService) -> None:
        session = await focus_sessions.start()

        finished = await focus_sessions.finish_current()

        assert (finished.id, finished.status) == (session.id, FocusSessionStatus.FINISHED)

    async def test_fails_when_no_session_is_current(
        self, focus_sessions: FocusSessionsService
    ) -> None:
        with pytest.raises(NotFoundError, match=Messages.NO_CURRENT_FOCUS_SESSION):
            await focus_sessions.finish_current()

package core_test

import (
	"testing"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

func TestFocusSessionsServiceStart(t *testing.T) {
	t.Run("starts an active session with every in-progress and pending task by default", func(t *testing.T) {
		app := newTestApp(t)
		active, done := app.createTask("active"), app.createTask("done")
		app.must(app.Tasks.Complete(app.ctx, done.ID))

		session, err := app.FocusSessions.Start(app.ctx, nil, nil)

		check(t, err)
		assertEqual(t, session, core.FocusSession{
			ID:        session.ID,
			Status:    core.FocusSessionActive,
			StartTime: app.now,
			Tasks:     []string{active.ID},
			Pauses:    []core.Pause{},
		})
		assertEqual(t, app.getTask(active.ID).FocusSessionID, &session.ID)
		assertEqual(t, app.getTask(done.ID).FocusSessionID, nil)
	})

	t.Run("keeps requested tasks in request order, dropping unknown and repeated ids", func(t *testing.T) {
		app := newTestApp(t)
		a, b := app.createTask("a"), app.createTask("b")

		session, err := app.FocusSessions.Start(app.ctx, []string{b.ID, "unknown", a.ID, b.ID}, nil)

		check(t, err)
		assertEqual(t, session.Tasks, []string{b.ID, a.ID})
	})

	t.Run("uses the given start time", func(t *testing.T) {
		app := newTestApp(t)

		session, err := app.FocusSessions.Start(app.ctx, nil, new(int64(42)))

		check(t, err)
		assertEqual(t, session.StartTime, 42)
	})
}

func TestFocusSessionsServiceGetCurrent(t *testing.T) {
	t.Run("returns nil when no session is current", func(t *testing.T) {
		app := newTestApp(t)
		app.startSession()
		app.must(app.FocusSessions.FinishCurrent(app.ctx))

		current, err := app.FocusSessions.GetCurrent(app.ctx)

		check(t, err)
		assertEqual(t, current, nil)
	})

	t.Run("moves startTime forward by the closed pauses only", func(t *testing.T) {
		app := newTestApp(t)
		session := app.startSession()
		app.must(app.FocusSessions.Pause(app.ctx, session.ID))
		app.advanceClock(300)
		app.must(app.FocusSessions.Resume(app.ctx, session.ID))
		app.must(app.FocusSessions.Pause(app.ctx, session.ID))
		app.advanceClock(5_000) // still open: not counted yet

		current, err := app.FocusSessions.GetCurrent(app.ctx)

		check(t, err)
		if current == nil {
			t.Fatal("expected a current session")
		}
		assertEqual(t, current.StartTime, session.StartTime+300)
	})

	t.Run("returns the newest current session", func(t *testing.T) {
		app := newTestApp(t)
		app.startSession()
		newest := app.startSession()

		current, err := app.FocusSessions.GetCurrent(app.ctx)

		check(t, err)
		assertEqual(t, current, &newest)
	})
}

func TestFocusSessionsServicePause(t *testing.T) {
	t.Run("opens a pause on an active session", func(t *testing.T) {
		app := newTestApp(t)
		session := app.startSession()
		app.advanceClock(1_000)

		paused, err := app.FocusSessions.Pause(app.ctx, session.ID)

		check(t, err)
		assertEqual(t, paused.Status, core.FocusSessionPaused)
		assertEqual(t, withoutIDs(paused.Pauses), []core.Pause{{StartTime: app.now, EndTime: nil, Time: 0}})
	})

	t.Run("refuses sessions that are not active", func(t *testing.T) {
		app := newTestApp(t)
		session := app.startSession()
		app.must(app.FocusSessions.Pause(app.ctx, session.ID))

		for _, id := range []string{session.ID, "unknown"} {
			_, err := app.FocusSessions.Pause(app.ctx, id)

			assertError(t, err, core.ErrCannotPause)
		}
	})
}

func TestFocusSessionsServicePauseCurrent(t *testing.T) {
	t.Run("fails when no session is current", func(t *testing.T) {
		app := newTestApp(t)

		_, err := app.FocusSessions.PauseCurrent(app.ctx, nil)

		assertError(t, err, core.ErrNoCurrentFocusSession)
	})

	t.Run("opens a pause on an active session", func(t *testing.T) {
		app := newTestApp(t)
		app.startSession()

		paused, err := app.FocusSessions.PauseCurrent(app.ctx, nil)

		check(t, err)
		assertEqual(t, paused.Status, core.FocusSessionPaused)
		assertEqual(t, withoutIDs(paused.Pauses), []core.Pause{{StartTime: app.now, EndTime: nil, Time: 0}})
	})

	t.Run("leaves an already paused session as is when no time is given", func(t *testing.T) {
		app := newTestApp(t)
		app.startSession()
		paused, err := app.FocusSessions.PauseCurrent(app.ctx, nil)
		check(t, err)
		app.advanceClock(1_000)

		pausedAgain, err := app.FocusSessions.PauseCurrent(app.ctx, nil)

		check(t, err)
		assertEqual(t, pausedAgain, paused)
	})

	t.Run("closes the open pause and opens a new one with the given time", func(t *testing.T) {
		app := newTestApp(t)
		app.startSession()
		app.must(app.FocusSessions.PauseCurrent(app.ctx, nil))
		firstPauseStart := app.now
		app.advanceClock(1_000)

		paused, err := app.FocusSessions.PauseCurrent(app.ctx, new(int64(25)))

		check(t, err)
		assertEqual(t, withoutIDs(paused.Pauses), []core.Pause{
			{StartTime: firstPauseStart, EndTime: new(app.now), Time: 1_000},
			{StartTime: app.now, EndTime: nil, Time: 25},
		})
	})
}

func TestFocusSessionsServiceResume(t *testing.T) {
	t.Run("closes the open pause of a paused session", func(t *testing.T) {
		app := newTestApp(t)
		session := app.startSession()
		app.must(app.FocusSessions.Pause(app.ctx, session.ID))
		pauseStart := app.now
		app.advanceClock(700)

		resumed, err := app.FocusSessions.Resume(app.ctx, session.ID)

		check(t, err)
		assertEqual(t, resumed.Status, core.FocusSessionActive)
		assertEqual(t, withoutIDs(resumed.Pauses), []core.Pause{{StartTime: pauseStart, EndTime: new(app.now), Time: 700}})
	})

	t.Run("refuses sessions that are not paused", func(t *testing.T) {
		app := newTestApp(t)
		session := app.startSession()

		for _, id := range []string{session.ID, "unknown"} {
			_, err := app.FocusSessions.Resume(app.ctx, id)

			assertError(t, err, core.ErrCannotResume)
		}
	})
}

func TestFocusSessionsServiceResumeCurrent(t *testing.T) {
	t.Run("closes the open pause of the current session", func(t *testing.T) {
		app := newTestApp(t)
		app.startSession()
		app.must(app.FocusSessions.PauseCurrent(app.ctx, nil))
		app.advanceClock(200)

		resumed, err := app.FocusSessions.ResumeCurrent(app.ctx)

		check(t, err)
		assertEqual(t, resumed.Status, core.FocusSessionActive)
		assertEqual(t, resumed.Pauses[0].Time, 200)
	})

	t.Run("leaves a session without an open pause as is", func(t *testing.T) {
		app := newTestApp(t)
		session := app.startSession()

		resumed, err := app.FocusSessions.ResumeCurrent(app.ctx)

		check(t, err)
		assertEqual(t, resumed, session)
	})

	t.Run("fails when no session is current", func(t *testing.T) {
		app := newTestApp(t)

		_, err := app.FocusSessions.ResumeCurrent(app.ctx)

		assertError(t, err, core.ErrNoCurrentFocusSession)
	})
}

func TestFocusSessionsServiceFinish(t *testing.T) {
	t.Run("closes the open pause and releases the unfinished tasks only", func(t *testing.T) {
		app := newTestApp(t)
		unfinished, done := app.createTask("unfinished"), app.createTask("done")
		session := app.startSession()
		app.must(app.Tasks.Complete(app.ctx, done.ID))
		app.must(app.FocusSessions.Pause(app.ctx, session.ID))
		app.advanceClock(400)

		finished, err := app.FocusSessions.Finish(app.ctx, session.ID)

		check(t, err)
		assertEqual(t, finished.Status, core.FocusSessionFinished)
		assertEqual(t, finished.Pauses[0].Time, 400)
		assertEqual(t, app.getTask(unfinished.ID).FocusSessionID, nil)
		assertEqual(t, app.getTask(done.ID).FocusSessionID, &session.ID)
	})

	t.Run("fails with NotFound for an unknown id", func(t *testing.T) {
		app := newTestApp(t)

		_, err := app.FocusSessions.Finish(app.ctx, "unknown")

		assertError(t, err, core.ErrFocusSessionNotFound)
	})
}

func TestFocusSessionsServiceFinishCurrent(t *testing.T) {
	t.Run("finishes the current session", func(t *testing.T) {
		app := newTestApp(t)
		session := app.startSession()

		finished, err := app.FocusSessions.FinishCurrent(app.ctx)

		check(t, err)
		assertEqual(t, finished.ID, session.ID)
		assertEqual(t, finished.Status, core.FocusSessionFinished)
	})

	t.Run("fails when no session is current", func(t *testing.T) {
		app := newTestApp(t)

		_, err := app.FocusSessions.FinishCurrent(app.ctx)

		assertError(t, err, core.ErrNoCurrentFocusSession)
	})
}

package core_test

import (
	"testing"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

func TestTasksServiceList(t *testing.T) {
	t.Run("lists in-progress and pending tasks by priority when no session is current", func(t *testing.T) {
		app := newTestApp(t)
		first, second, done := app.createTask("first"), app.createTask("second"), app.createTask("done")
		app.must(app.Tasks.Complete(app.ctx, done.ID))
		app.must(app.Tasks.Update(app.ctx, first.ID, core.TaskChanges{Priority: core.Some(5)}))

		tasks, err := app.Tasks.List(app.ctx)

		check(t, err)
		assertEqual(t, idsOf(tasks), []string{second.ID, first.ID})
	})

	t.Run("lists the current session's tasks, completed ones included", func(t *testing.T) {
		app := newTestApp(t)
		inSession := app.createTask("in session")
		app.startSession(inSession.ID)
		app.must(app.Tasks.Complete(app.ctx, inSession.ID))
		outside := app.createTask("created during the session")
		app.must(app.Tasks.Update(app.ctx, outside.ID, core.TaskChanges{FocusSessionID: core.Some[*string](nil)}))

		tasks, err := app.Tasks.List(app.ctx)

		check(t, err)
		assertEqual(t, idsOf(tasks), []string{inSession.ID})
	})

	t.Run("keeps creation order between tasks with the same priority", func(t *testing.T) {
		app := newTestApp(t)
		descriptions := []string{"a", "b", "c"}
		for _, description := range descriptions {
			app.createTask(description)
		}

		tasks, err := app.Tasks.List(app.ctx)

		check(t, err)
		listed := make([]string, len(tasks))
		for index, task := range tasks {
			listed[index] = task.Description
		}
		assertEqual(t, listed, descriptions)
	})
}

func TestTasksServiceGet(t *testing.T) {
	t.Run("fails with NotFound for an unknown id", func(t *testing.T) {
		app := newTestApp(t)

		_, err := app.Tasks.Get(app.ctx, "unknown")

		assertError(t, err, core.ErrTaskNotFound)
	})
}

func TestTasksServiceCreate(t *testing.T) {
	t.Run("starts tasks in progress until three are in progress, then as pending", func(t *testing.T) {
		app := newTestApp(t)

		var statuses []core.TaskStatus
		for _, description := range []string{"1", "2", "3", "4"} {
			statuses = append(statuses, app.createTask(description).Status)
		}

		assertEqual(t, statuses, []core.TaskStatus{core.TaskInProgress, core.TaskInProgress, core.TaskInProgress, core.TaskPending})
	})

	t.Run("creates the task at priority 0 without a session when none is current", func(t *testing.T) {
		app := newTestApp(t)

		task, err := app.Tasks.Create(app.ctx, "write tests")

		check(t, err)
		assertEqual(t, task, core.Task{
			ID:             task.ID,
			Description:    "write tests",
			Priority:       0,
			Status:         core.TaskInProgress,
			FocusSessionID: nil,
		})
	})

	t.Run("attaches the task to the current session", func(t *testing.T) {
		app := newTestApp(t)
		session := app.startSession()

		task, err := app.Tasks.Create(app.ctx, "joins the session")

		check(t, err)
		assertEqual(t, task.FocusSessionID, &session.ID)
	})
}

func TestTasksServiceComplete(t *testing.T) {
	t.Run("puts the task on top of the completed group and renumbers the rest", func(t *testing.T) {
		app := newTestApp(t)
		a, b, c := app.createTask("a"), app.createTask("b"), app.createTask("c")
		app.must(app.Tasks.Complete(app.ctx, a.ID))
		app.must(app.Tasks.Complete(app.ctx, b.ID))

		completed, err := app.Tasks.Complete(app.ctx, c.ID)

		check(t, err)
		assertEqual(t, completed.Status, core.TaskCompleted)
		assertEqual(t, completed.Priority, 0)
		assertEqual(t, app.priorities(c.ID, b.ID, a.ID), []int{0, 1, 2})
	})

	t.Run("changes nothing when the task does not exist", func(t *testing.T) {
		app := newTestApp(t)
		a := app.createTask("a")
		app.must(app.Tasks.Complete(app.ctx, a.ID))
		app.must(app.Tasks.Update(app.ctx, a.ID, core.TaskChanges{Priority: core.Some(7)}))

		_, err := app.Tasks.Complete(app.ctx, "unknown")

		assertError(t, err, core.ErrTaskNotFound)
		assertEqual(t, app.priorities(a.ID), []int{7})
	})
}

func TestTasksServiceReset(t *testing.T) {
	t.Run("puts the task on top of the pending group and renumbers the rest", func(t *testing.T) {
		app := newTestApp(t)
		a, b, c, d := app.createTask("a"), app.createTask("b"), app.createTask("c"), app.createTask("d") // d starts pending
		app.must(app.Tasks.Reset(app.ctx, c.ID))

		reset, err := app.Tasks.Reset(app.ctx, a.ID)

		check(t, err)
		assertEqual(t, reset.Status, core.TaskPending)
		assertEqual(t, reset.Priority, 0)
		assertEqual(t, app.priorities(a.ID, c.ID, d.ID), []int{0, 1, 2})
		assertEqual(t, app.getTask(b.ID).Status, core.TaskInProgress)
	})
}

func TestTasksServiceChangeStatus(t *testing.T) {
	t.Run("sets only the status", func(t *testing.T) {
		app := newTestApp(t)
		task := app.createTask("a")
		app.must(app.Tasks.Update(app.ctx, task.ID, core.TaskChanges{Priority: core.Some(4)}))

		updated, err := app.Tasks.ChangeStatus(app.ctx, task.ID, core.TaskPending)

		check(t, err)
		assertEqual(t, updated.Status, core.TaskPending)
		assertEqual(t, updated.Priority, 4)
	})

	t.Run("rejects an unknown status before looking the task up", func(t *testing.T) {
		app := newTestApp(t)

		_, err := app.Tasks.ChangeStatus(app.ctx, "unknown", "done")

		assertError(t, err, core.ErrInvalidTaskStatus)
	})
}

func TestTasksServiceUpdate(t *testing.T) {
	t.Run("changes only the given fields", func(t *testing.T) {
		app := newTestApp(t)
		app.startSession()
		task := app.createTask("before") // joins the session

		updated, err := app.Tasks.Update(app.ctx, task.ID, core.TaskChanges{
			Description:    core.Some("after"),
			FocusSessionID: core.Some[*string](nil),
		})

		check(t, err)
		want := task
		want.Description, want.FocusSessionID = "after", nil
		assertEqual(t, updated, want)
	})

	t.Run("rejects an unknown status", func(t *testing.T) {
		app := newTestApp(t)
		task := app.createTask("a")

		// A transport without its own enum validation could pass anything through.
		_, err := app.Tasks.Update(app.ctx, task.ID, core.TaskChanges{Status: core.Some[core.TaskStatus]("done")})

		assertError(t, err, core.ErrInvalidTaskStatus)
	})

	t.Run("rejects a focusSessionId that does not match a session", func(t *testing.T) {
		app := newTestApp(t)
		task := app.createTask("a")

		_, err := app.Tasks.Update(app.ctx, task.ID, core.TaskChanges{FocusSessionID: core.Some(new("unknown"))})

		assertError(t, err, core.ErrUnknownFocusSession)
	})
}

func TestTasksServiceDelete(t *testing.T) {
	t.Run("removes the task and returns it", func(t *testing.T) {
		app := newTestApp(t)
		task := app.createTask("a")

		deleted, err := app.Tasks.Delete(app.ctx, task.ID)

		check(t, err)
		assertEqual(t, deleted, task)
		_, err = app.Tasks.Get(app.ctx, task.ID)
		assertError(t, err, core.ErrTaskNotFound)
	})

	t.Run("fails with NotFound for an unknown id", func(t *testing.T) {
		app := newTestApp(t)

		_, err := app.Tasks.Delete(app.ctx, "unknown")

		assertError(t, err, core.ErrTaskNotFound)
	})
}

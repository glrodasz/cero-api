// Package coretest holds the behaviour every storage adapter must honour, as
// runnable tests.
package coretest

import (
	"testing"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// RunRepositoryContract runs the storage contract against an adapter.
// newRepositories is called once per test and must return repositories over
// empty storage. An adapter calls it from its own tests:
//
//	func TestRepositoryContract(t *testing.T) {
//		coretest.RunRepositoryContract(t, func(t *testing.T) core.Repositories {
//			return mydb.NewRepositories(emptyDatabase(t))
//		})
//	}
func RunRepositoryContract(t *testing.T, newRepositories func(t *testing.T) core.Repositories) {
	t.Helper()

	for _, group := range []struct {
		name  string
		cases []contractCase
	}{
		{"tasks", taskContract},
		{"focus sessions", focusSessionContract},
	} {
		t.Run(group.name, func(t *testing.T) {
			for _, test := range group.cases {
				t.Run(test.name, func(t *testing.T) {
					test.run(t, newRepositories(t))
				})
			}
		})
	}
}

type contractCase struct {
	name string
	run  func(t *testing.T, repos core.Repositories)
}

var taskContract = []contractCase{
	{"assigns an id on create and finds the task by it", func(t *testing.T, repos core.Repositories) {
		created := createTask(t, repos, core.Task{Description: "stored", Status: core.TaskPending})

		if created.ID == "" {
			t.Fatal("expected storage to assign an id")
		}
		assertEqual(t, findTask(t, repos, created.ID), &created)
	}},

	{"finds nothing for unknown or malformed ids", func(t *testing.T, repos core.Repositories) {
		deleted := createTask(t, repos, core.Task{Description: "a task", Status: core.TaskPending})
		check(t, repos.Tasks.Delete(t.Context(), deleted.ID))

		assertEqual(t, findTask(t, repos, deleted.ID), nil)
		assertEqual(t, findTask(t, repos, "not-an-id"), nil)
	}},

	{"sorts by priority, then creation order", func(t *testing.T, repos core.Repositories) {
		second := createTask(t, repos, core.Task{Description: "second", Priority: 1, Status: core.TaskPending})
		third := createTask(t, repos, core.Task{Description: "third", Priority: 1, Status: core.TaskPending})
		first := createTask(t, repos, core.Task{Description: "first", Priority: 0, Status: core.TaskPending})

		assertEqual(t, findTaskIDs(t, repos, core.TaskFilter{}), []string{first.ID, second.ID, third.ID})
	}},

	{"combines every filter criterion (and an empty id list matches nothing)", func(t *testing.T, repos core.Repositories) {
		session := createSession(t, repos, newSession(core.FocusSessionActive, 1_000))
		match := createTask(t, repos, core.Task{Description: "match", Status: core.TaskPending, FocusSessionID: &session.ID})
		createTask(t, repos, core.Task{Description: "completed", Status: core.TaskCompleted, FocusSessionID: &session.ID})
		other := createTask(t, repos, core.Task{Description: "other", Status: core.TaskPending})

		byAll := findTaskIDs(t, repos, core.TaskFilter{
			IDs:            []string{match.ID, other.ID, "not-an-id"},
			Statuses:       []core.TaskStatus{core.TaskPending, core.TaskInProgress},
			FocusSessionID: session.ID,
		})
		byNoIDs, err := repos.Tasks.FindMany(t.Context(), core.TaskFilter{IDs: []string{}})
		check(t, err)

		assertEqual(t, byAll, []string{match.ID})
		assertEqual(t, byNoIDs, []core.Task{})
	}},

	{"counts tasks by status", func(t *testing.T, repos core.Repositories) {
		createTask(t, repos, core.Task{Description: "a", Status: core.TaskInProgress})
		createTask(t, repos, core.Task{Description: "b", Status: core.TaskInProgress})
		createTask(t, repos, core.Task{Description: "c", Status: core.TaskPending})

		inProgress, err := repos.Tasks.CountByStatus(t.Context(), core.TaskInProgress)
		check(t, err)
		completed, err := repos.Tasks.CountByStatus(t.Context(), core.TaskCompleted)
		check(t, err)

		assertEqual(t, inProgress, 2)
		assertEqual(t, completed, 0)
	}},

	{"overwrites a task on save", func(t *testing.T, repos core.Repositories) {
		task := createTask(t, repos, core.Task{Description: "a task", Status: core.TaskPending})
		changed := task
		changed.Description, changed.Priority, changed.Status = "changed", 3, core.TaskCompleted

		check(t, repos.Tasks.Save(t.Context(), changed))

		assertEqual(t, findTask(t, repos, task.ID), &changed)
	}},

	{"assigns and clears the focus session of many tasks at once", func(t *testing.T, repos core.Repositories) {
		session := createSession(t, repos, newSession(core.FocusSessionActive, 1_000))
		a := createTask(t, repos, core.Task{Description: "a", Status: core.TaskPending})
		b := createTask(t, repos, core.Task{Description: "b", Status: core.TaskPending})

		check(t, repos.Tasks.AssignFocusSession(t.Context(), []string{a.ID, b.ID, "not-an-id"}, &session.ID))
		assertEqual(t, findTaskIDs(t, repos, core.TaskFilter{FocusSessionID: session.ID}), []string{a.ID, b.ID})

		check(t, repos.Tasks.AssignFocusSession(t.Context(), []string{a.ID}, nil))
		assertEqual(t, findTask(t, repos, a.ID), &a)
	}},

	{"ignores malformed ids on save and delete", func(t *testing.T, repos core.Repositories) {
		check(t, repos.Tasks.Save(t.Context(), core.Task{ID: "not-an-id", Description: "a task", Status: core.TaskPending}))
		check(t, repos.Tasks.Delete(t.Context(), "not-an-id"))

		assertEqual(t, findTaskIDs(t, repos, core.TaskFilter{}), []string{})
	}},
}

var focusSessionContract = []contractCase{
	{"assigns an id on create and finds the session by it, pauses included", func(t *testing.T, repos core.Repositories) {
		// Task ids are storage-specific (UUID, ObjectId...), so the session refers to real tasks.
		first := createTask(t, repos, core.Task{Description: "first", Status: core.TaskPending})
		second := createTask(t, repos, core.Task{Description: "second", Status: core.TaskPending})
		session := newSession(core.FocusSessionPaused, 1_000)
		session.Tasks = []string{second.ID, first.ID}
		session.Pauses = []core.Pause{{ID: "pause-1", StartTime: 1_500, EndTime: nil, Time: 0}}

		created := createSession(t, repos, session)

		if created.ID == "" {
			t.Fatal("expected storage to assign an id")
		}
		assertEqual(t, findSession(t, repos, created.ID), &created)
		assertEqual(t, findSession(t, repos, "not-an-id"), nil)
	}},

	{"lists sessions oldest first", func(t *testing.T, repos core.Repositories) {
		first := createSession(t, repos, newSession(core.FocusSessionActive, 9))
		second := createSession(t, repos, newSession(core.FocusSessionActive, 1))

		sessions, err := repos.FocusSessions.FindAll(t.Context())
		check(t, err)

		assertEqual(t, sessions, []core.FocusSession{first, second})
	}},

	{"finds the newest active or paused session as current", func(t *testing.T, repos core.Repositories) {
		none, err := repos.FocusSessions.FindCurrent(t.Context())
		check(t, err)
		assertEqual(t, none, nil)

		createSession(t, repos, newSession(core.FocusSessionActive, 1_000))
		newest := createSession(t, repos, newSession(core.FocusSessionPaused, 1_000))
		createSession(t, repos, newSession(core.FocusSessionFinished, 1_000))

		current, err := repos.FocusSessions.FindCurrent(t.Context())
		check(t, err)
		assertEqual(t, current, &newest)
	}},

	{"overwrites a session on save", func(t *testing.T, repos core.Repositories) {
		session := createSession(t, repos, newSession(core.FocusSessionActive, 1_000))
		endTime := int64(1_400)
		changed := session
		changed.Status = core.FocusSessionFinished
		changed.Pauses = []core.Pause{{ID: "pause-1", StartTime: 1_100, EndTime: &endTime, Time: 300}}

		check(t, repos.FocusSessions.Save(t.Context(), changed))

		assertEqual(t, findSession(t, repos, session.ID), &changed)
	}},
}

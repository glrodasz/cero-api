package coretest

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// newSession returns a session to create, without tasks or pauses.
func newSession(status core.FocusSessionStatus, startTime int64) core.FocusSession {
	return core.FocusSession{Status: status, StartTime: startTime, Tasks: []string{}, Pauses: []core.Pause{}}
}

func createTask(t *testing.T, repos core.Repositories, task core.Task) core.Task {
	t.Helper()
	created, err := repos.Tasks.Create(t.Context(), task)
	check(t, err)
	return created
}

func createSession(t *testing.T, repos core.Repositories, session core.FocusSession) core.FocusSession {
	t.Helper()
	created, err := repos.FocusSessions.Create(t.Context(), session)
	check(t, err)
	return created
}

func findTask(t *testing.T, repos core.Repositories, id string) *core.Task {
	t.Helper()
	task, err := repos.Tasks.FindByID(t.Context(), id)
	check(t, err)
	return task
}

func findTaskIDs(t *testing.T, repos core.Repositories, filter core.TaskFilter) []string {
	t.Helper()
	tasks, err := repos.Tasks.FindMany(t.Context(), filter)
	check(t, err)

	ids := make([]string, len(tasks))
	for index, task := range tasks {
		ids[index] = task.ID
	}
	return ids
}

func findSession(t *testing.T, repos core.Repositories, id string) *core.FocusSession {
	t.Helper()
	session, err := repos.FocusSessions.FindByID(t.Context(), id)
	check(t, err)
	return session
}

// check stops the test when a storage call fails.
func check(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// assertEqual compares deeply, so a nil slice is not equal to an empty one:
// lists must never be nil, or they would reach clients as null.
func assertEqual[T any](t *testing.T, got, want T) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got  %s\nwant %s", describe(got), describe(want))
	}
}

// describe shows a value as JSON, which reads better than pointer addresses.
func describe(value any) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf("%#v", value)
	}
	return string(encoded)
}

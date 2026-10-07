package core_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"

	core "github.com/glrodasz/cero-api/shared/go-core"
	"github.com/glrodasz/cero-api/shared/go-core/memory"
)

// testApp is the core wired to in-memory storage and a clock the test moves
// by hand. It never sleeps.
type testApp struct {
	core.Services
	t   *testing.T
	ctx context.Context
	now int64
}

func newTestApp(t *testing.T) *testApp {
	app := &testApp{t: t, ctx: t.Context(), now: 1_000_000}
	app.Services = core.NewServices(memory.NewRepositories(), func() int64 { return app.now })
	return app
}

func (app *testApp) advanceClock(milliseconds int64) {
	app.now += milliseconds
}

// The helpers below run the steps that set a test up, and stop the test if
// one of them fails.

// must takes the result of any use case: app.must(app.Tasks.Complete(app.ctx, id)).
func (app *testApp) must(_ any, err error) {
	app.t.Helper()
	check(app.t, err)
}

func (app *testApp) createTask(description string) core.Task {
	app.t.Helper()
	task, err := app.Tasks.Create(app.ctx, description)
	check(app.t, err)
	return task
}

func (app *testApp) getTask(id string) core.Task {
	app.t.Helper()
	task, err := app.Tasks.Get(app.ctx, id)
	check(app.t, err)
	return task
}

func (app *testApp) startSession(taskIDs ...string) core.FocusSession {
	app.t.Helper()
	session, err := app.FocusSessions.Start(app.ctx, taskIDs, nil)
	check(app.t, err)
	return session
}

func (app *testApp) priorities(ids ...string) []int {
	app.t.Helper()
	priorities := make([]int, len(ids))
	for index, id := range ids {
		priorities[index] = app.getTask(id).Priority
	}
	return priorities
}

func idsOf(tasks []core.Task) []string {
	ids := make([]string, len(tasks))
	for index, task := range tasks {
		ids[index] = task.ID
	}
	return ids
}

// withoutIDs blanks the random pause ids, so pauses can be compared whole.
func withoutIDs(pauses []core.Pause) []core.Pause {
	blanked := make([]core.Pause, len(pauses))
	for index, pause := range pauses {
		pause.ID = ""
		blanked[index] = pause
	}
	return blanked
}

func check(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func assertError(t *testing.T, err, want error) {
	t.Helper()
	if !errors.Is(err, want) {
		t.Errorf("got error %v, want %v", err, want)
	}
}

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

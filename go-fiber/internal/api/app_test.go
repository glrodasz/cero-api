package api_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"

	"github.com/glrodasz/cero-api/go-fiber/internal/api"
	core "github.com/glrodasz/cero-api/shared/go-core"
	"github.com/glrodasz/cero-api/shared/go-core/memory"
)

// The behaviour itself is covered by the core tests and the shared contract
// suite. These tests cover what is Fiber's job: routing, binding, errors.
// app.Test sends each request straight into the app, without opening a port.

const missingID = "00000000-0000-4000-8000-000000000000"

func TestRouting(t *testing.T) {
	t.Run("routes PATCH /tasks/:id/complete and /reset before /tasks/:id/:status", func(t *testing.T) {
		app := newApp(memory.NewRepositories())
		id := createTask(t, app, 5)

		completed := send(t, app, http.MethodPatch, "/tasks/"+id+"/complete", "")
		reset := send(t, app, http.MethodPatch, "/tasks/"+id+"/reset", "")

		completed.expect(t, http.StatusOK, map[string]any{"status": "completed", "priority": 0.0})
		reset.expect(t, http.StatusOK, map[string]any{"status": "pending", "priority": 0.0})
	})

	t.Run("routes a status that starts like a static segment to /tasks/:id/:status", func(t *testing.T) {
		app := newApp(memory.NewRepositories())
		id := createTask(t, app, 5)

		changed := send(t, app, http.MethodPatch, "/tasks/"+id+"/completed", "")

		changed.expect(t, http.StatusOK, map[string]any{"status": "completed", "priority": 5.0})
	})

	t.Run("routes PATCH /focus-sessions/finish before /focus-sessions/:id/finish", func(t *testing.T) {
		app := newApp(memory.NewRepositories())

		finishCurrent := send(t, app, http.MethodPatch, "/focus-sessions/finish", "")
		finishByID := send(t, app, http.MethodPatch, "/focus-sessions/finish/finish", "")

		finishCurrent.expect(t, http.StatusNotFound, map[string]any{"message": core.MsgNoCurrentFocusSession})
		finishByID.expect(t, http.StatusNotFound, map[string]any{"message": core.MsgFocusSessionNotFound})
	})

	t.Run("keeps a status taken from the URL once the request is done", func(t *testing.T) {
		app := newApp(memory.NewRepositories())
		id := createTask(t, app, 0)
		send(t, app, http.MethodPatch, "/tasks/"+id+"/pending", "")

		for range 3 { // later requests reuse Fiber's buffers
			send(t, app, http.MethodPatch, "/tasks/"+missingID+"/xxxxxxx", "")
		}

		send(t, app, http.MethodGet, "/tasks/"+id, "").expect(t, http.StatusOK, map[string]any{"status": "pending"})
	})
}

func TestBinding(t *testing.T) {
	t.Run("answers 400 to bodies that do not fit, before looking anything up", func(t *testing.T) {
		for _, test := range []struct{ method, path, body string }{
			{http.MethodPost, "/tasks", "{ nope"},
			{http.MethodPost, "/tasks", ""},
			{http.MethodPost, "/tasks", `{"description": 42}`},
			{http.MethodPost, "/tasks", `{"description": null}`},
			{http.MethodPatch, "/tasks/" + missingID, `{"description": null}`},
			{http.MethodPatch, "/tasks/" + missingID, `{"priority": 1.5}`},
			{http.MethodPatch, "/tasks/" + missingID, `{"status": "done"}`},
			{http.MethodPatch, "/tasks/" + missingID + "/done", ""},
			{http.MethodPost, "/focus-sessions", `{"tasks": "all"}`},
			{http.MethodPost, "/focus-sessions", `{"tasks": [1, 2]}`},
			{http.MethodPatch, "/focus-sessions/pause", `{"time": "soon"}`},
		} {
			app := newApp(memory.NewRepositories())

			response := send(t, app, test.method, test.path, test.body)

			if _, isText := response.body["message"].(string); response.status != http.StatusBadRequest || !isText {
				t.Errorf("%s %s %s: got %d %v, want 400 with a message", test.method, test.path, test.body, response.status, response.body)
			}
		}
	})

	t.Run("accepts a session start without a body", func(t *testing.T) {
		app := newApp(memory.NewRepositories())

		started := send(t, app, http.MethodPost, "/focus-sessions", "")

		started.expect(t, http.StatusCreated, map[string]any{"status": "active"})
	})

	t.Run("ignores unknown fields and the id in a task update", func(t *testing.T) {
		app := newApp(memory.NewRepositories())
		id := createTask(t, app, 0)

		updated := send(t, app, http.MethodPatch, "/tasks/"+id, `{"id": "`+missingID+`", "color": "red", "priority": 3}`)

		updated.expect(t, http.StatusOK, map[string]any{"id": id, "priority": 3.0})
	})
}

func TestErrors(t *testing.T) {
	t.Run("answers 404 to unknown routes", func(t *testing.T) {
		app := newApp(memory.NewRepositories())

		for _, path := range []string{"/nowhere", "/tasks/" + missingID + "/complete"} {
			send(t, app, http.MethodGet, path, "").expect(t, http.StatusNotFound, map[string]any{"message": "Not found"})
		}
	})

	t.Run("hides the details of unexpected errors and panics", func(t *testing.T) {
		for _, broken := range []core.FocusSessionRepository{failingFocusSessions{}, panickingFocusSessions{}} {
			repos := memory.NewRepositories()
			repos.FocusSessions = broken
			app := newApp(repos)

			response := send(t, app, http.MethodGet, "/tasks", "")

			if want := map[string]any{"message": "Internal server error"}; response.status != http.StatusInternalServerError || !reflect.DeepEqual(response.body, want) {
				t.Errorf("%T: got %d %v, want 500 %v", broken, response.status, response.body, want)
			}
		}
	})
}

type failingFocusSessions struct{ core.FocusSessionRepository }

func (failingFocusSessions) FindCurrent(context.Context) (*core.FocusSession, error) {
	return nil, errors.New("connection string with a password")
}

type panickingFocusSessions struct{ core.FocusSessionRepository }

func (panickingFocusSessions) FindCurrent(context.Context) (*core.FocusSession, error) {
	panic("connection string with a password")
}

func newApp(repos core.Repositories) *fiber.App {
	return api.NewApp(core.NewServices(repos, core.SystemClock))
}

// createTask creates a task with the given priority and returns its id.
func createTask(t *testing.T, app *fiber.App, priority int) string {
	t.Helper()
	created := send(t, app, http.MethodPost, "/tasks", `{"description": "routing"}`)
	id, _ := created.body["id"].(string)
	send(t, app, http.MethodPatch, "/tasks/"+id, fmt.Sprintf(`{"priority": %d}`, priority))
	return id
}

type response struct {
	status int
	body   map[string]any
}

func send(t *testing.T, app *fiber.App, method, path, body string) response {
	t.Helper()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}

	answer, err := app.Test(request)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer answer.Body.Close()
	raw, err := io.ReadAll(answer.Body)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("%s %s answered %d with a body that is not a JSON object: %q", method, path, answer.StatusCode, raw)
	}
	return response{status: answer.StatusCode, body: decoded}
}

// expect checks the status and the given fields of the body.
func (r response) expect(t *testing.T, status int, fields map[string]any) {
	t.Helper()
	if r.status != status {
		t.Errorf("got status %d, want %d (body %v)", r.status, status, r.body)
	}
	for key, want := range fields {
		if got := r.body[key]; !reflect.DeepEqual(got, want) {
			t.Errorf("%s: got %v, want %v", key, got, want)
		}
	}
}

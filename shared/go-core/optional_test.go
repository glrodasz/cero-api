package core_test

import (
	"encoding/json"
	"testing"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

func TestTaskChangesFromJSON(t *testing.T) {
	t.Run("tells absent, null and given fields apart", func(t *testing.T) {
		for _, test := range []struct {
			body string
			want core.TaskChanges
		}{
			{`{}`, core.TaskChanges{}},
			{`{"id": "ignored", "color": "unknown fields are ignored"}`, core.TaskChanges{}},
			{`{"description": "after", "priority": 2, "status": "pending"}`, core.TaskChanges{
				Description: core.Some("after"),
				Priority:    core.Some(2),
				Status:      core.Some(core.TaskPending),
			}},
			{`{"focusSessionId": null}`, core.TaskChanges{FocusSessionID: core.Some[*string](nil)}},
			{`{"focusSessionId": "a-session"}`, core.TaskChanges{FocusSessionID: core.Some(new("a-session"))}},
		} {
			var changes core.TaskChanges
			err := json.Unmarshal([]byte(test.body), &changes)

			check(t, err)
			assertEqual(t, changes, test.want)
		}
	})

	t.Run("refuses wrong types, and null for a field that cannot be cleared", func(t *testing.T) {
		for _, body := range []string{
			`{"description": null}`,
			`{"description": 42}`,
			`{"priority": null}`,
			`{"priority": "high"}`,
			`{"priority": 1.5}`,
			`{"status": null}`,
			`{"focusSessionId": 7}`,
		} {
			var changes core.TaskChanges
			if err := json.Unmarshal([]byte(body), &changes); err == nil {
				t.Errorf("%s: expected an error, got %s", body, describe(changes))
			}
		}
	})
}

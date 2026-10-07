package core

import "context"

// TaskFilter selects tasks. Every criterion that is set must match, so the
// zero value matches every task.
type TaskFilter struct {
	// IDs, unless nil, keeps only these tasks. An empty slice matches nothing.
	IDs []string
	// Statuses, unless nil, keeps only the tasks in one of these statuses.
	Statuses []TaskStatus
	// FocusSessionID, unless empty, keeps only the tasks of that session.
	FocusSessionID string
}

// TaskRepository is the storage port for tasks. Adapters live in package
// memory and in database/ (go-postgres).
//
// Contract every adapter honours (see coretest.RunRepositoryContract):
//   - a malformed id is simply "not found", it is never an error;
//   - lists are sorted by priority, then creation order, and are never nil.
type TaskRepository interface {
	// FindByID returns nil when there is no such task.
	FindByID(ctx context.Context, id string) (*Task, error)
	FindMany(ctx context.Context, filter TaskFilter) ([]Task, error)
	CountByStatus(ctx context.Context, status TaskStatus) (int, error)
	// Create stores a new task. Storage assigns the id: task.ID is ignored.
	Create(ctx context.Context, task Task) (Task, error)
	// Save overwrites the stored task with the same id.
	Save(ctx context.Context, task Task) error
	Delete(ctx context.Context, id string) error
	AssignFocusSession(ctx context.Context, taskIDs []string, focusSessionID *string) error
}

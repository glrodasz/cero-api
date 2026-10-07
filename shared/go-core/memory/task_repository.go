package memory

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"uuid"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// TaskRepository is a core.TaskRepository in memory. The zero value is empty
// and ready to use; it is safe for concurrent use.
type TaskRepository struct {
	mu    sync.RWMutex
	tasks []core.Task // in creation order
}

var _ core.TaskRepository = (*TaskRepository)(nil)

func (r *TaskRepository) FindByID(_ context.Context, id string) (*core.Task, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	index := r.indexOf(id)
	if index < 0 {
		return nil, nil
	}
	task := cloneTask(r.tasks[index])
	return &task, nil
}

func (r *TaskRepository) FindMany(_ context.Context, filter core.TaskFilter) ([]core.Task, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	found := []core.Task{}
	for _, task := range r.tasks {
		if matches(filter, task) {
			found = append(found, cloneTask(task))
		}
	}
	// Stable: tasks with the same priority keep their creation order.
	slices.SortStableFunc(found, func(a, b core.Task) int { return cmp.Compare(a.Priority, b.Priority) })
	return found, nil
}

func (r *TaskRepository) CountByStatus(_ context.Context, status core.TaskStatus) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	count := 0
	for _, task := range r.tasks {
		if task.Status == status {
			count++
		}
	}
	return count, nil
}

func (r *TaskRepository) Create(_ context.Context, task core.Task) (core.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	task.ID = uuid.New().String()
	r.tasks = append(r.tasks, cloneTask(task))
	return task, nil
}

func (r *TaskRepository) Save(_ context.Context, task core.Task) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if index := r.indexOf(task.ID); index >= 0 {
		r.tasks[index] = cloneTask(task)
	}
	return nil
}

func (r *TaskRepository) Delete(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.tasks = slices.DeleteFunc(r.tasks, func(task core.Task) bool { return task.ID == id })
	return nil
}

func (r *TaskRepository) AssignFocusSession(_ context.Context, taskIDs []string, focusSessionID *string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for index, task := range r.tasks {
		if slices.Contains(taskIDs, task.ID) {
			r.tasks[index].FocusSessionID = clonePointer(focusSessionID)
		}
	}
	return nil
}

func (r *TaskRepository) indexOf(id string) int {
	return slices.IndexFunc(r.tasks, func(task core.Task) bool { return task.ID == id })
}

func matches(filter core.TaskFilter, task core.Task) bool {
	return (filter.IDs == nil || slices.Contains(filter.IDs, task.ID)) &&
		(filter.Statuses == nil || slices.Contains(filter.Statuses, task.Status)) &&
		(filter.FocusSessionID == "" || task.FocusSessionID != nil && *task.FocusSessionID == filter.FocusSessionID)
}

func cloneTask(task core.Task) core.Task {
	task.FocusSessionID = clonePointer(task.FocusSessionID)
	return task
}

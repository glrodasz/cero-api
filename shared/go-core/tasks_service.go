package core

import (
	"context"
	"slices"
)

// TasksService holds the task use cases. One method per API endpoint.
type TasksService struct {
	tasks         TaskRepository
	focusSessions FocusSessionRepository
}

// List returns what the user should be looking at: the current session's
// tasks, or every unfinished task.
func (s *TasksService) List(ctx context.Context) ([]Task, error) {
	currentSession, err := s.focusSessions.FindCurrent(ctx)
	if err != nil {
		return nil, err
	}

	if currentSession != nil {
		return s.tasks.FindMany(ctx, TaskFilter{FocusSessionID: currentSession.ID})
	}
	return s.tasks.FindMany(ctx, TaskFilter{Statuses: ActiveTaskStatuses})
}

// Get returns the task, or ErrTaskNotFound.
func (s *TasksService) Get(ctx context.Context, id string) (Task, error) {
	task, err := s.tasks.FindByID(ctx, id)
	if err != nil {
		return Task{}, err
	}
	if task == nil {
		return Task{}, ErrTaskNotFound
	}
	return *task, nil
}

// Create adds a task at the top of its group, in the current session if
// there is one.
func (s *TasksService) Create(ctx context.Context, description string) (Task, error) {
	inProgressCount, err := s.tasks.CountByStatus(ctx, TaskInProgress)
	if err != nil {
		return Task{}, err
	}
	currentSession, err := s.focusSessions.FindCurrent(ctx)
	if err != nil {
		return Task{}, err
	}

	task := Task{Description: description, Priority: 0, Status: StatusForNewTask(inProgressCount)}
	if currentSession != nil {
		task.FocusSessionID = &currentSession.ID
	}
	return s.tasks.Create(ctx, task)
}

// Complete moves the task to the top of the completed group.
func (s *TasksService) Complete(ctx context.Context, id string) (Task, error) {
	return s.moveToTopOf(ctx, TaskCompleted, id)
}

// Reset moves the task to the top of the pending group.
func (s *TasksService) Reset(ctx context.Context, id string) (Task, error) {
	return s.moveToTopOf(ctx, TaskPending, id)
}

// ChangeStatus sets the status of the task, and nothing else.
func (s *TasksService) ChangeStatus(ctx context.Context, id string, status TaskStatus) (Task, error) {
	if !status.IsValid() {
		return Task{}, ErrInvalidTaskStatus
	}

	task, err := s.Get(ctx, id)
	if err != nil {
		return Task{}, err
	}
	task.Status = status
	return s.save(ctx, task)
}

// Update applies the changes that are set.
func (s *TasksService) Update(ctx context.Context, id string, changes TaskChanges) (Task, error) {
	if err := s.validateChanges(ctx, changes); err != nil {
		return Task{}, err
	}

	task, err := s.Get(ctx, id)
	if err != nil {
		return Task{}, err
	}
	task.Description = changes.Description.Or(task.Description)
	task.Priority = changes.Priority.Or(task.Priority)
	task.Status = changes.Status.Or(task.Status)
	task.FocusSessionID = changes.FocusSessionID.Or(task.FocusSessionID)
	return s.save(ctx, task)
}

// Delete removes the task and returns it.
func (s *TasksService) Delete(ctx context.Context, id string) (Task, error) {
	task, err := s.Get(ctx, id)
	if err != nil {
		return Task{}, err
	}
	if err := s.tasks.Delete(ctx, task.ID); err != nil {
		return Task{}, err
	}
	return task, nil
}

// moveToTopOf makes the task priority 0 of the status group; the rest of the
// group follows as 1..n. It looks the task up first, so a 404 changes nothing.
func (s *TasksService) moveToTopOf(ctx context.Context, status TaskStatus, id string) (Task, error) {
	task, err := s.Get(ctx, id)
	if err != nil {
		return Task{}, err
	}
	group, err := s.tasks.FindMany(ctx, TaskFilter{Statuses: []TaskStatus{status}})
	if err != nil {
		return Task{}, err
	}
	rest := slices.DeleteFunc(group, func(member Task) bool { return member.ID == task.ID })

	task.Status, task.Priority = status, 0
	for _, member := range append(Renumber(rest), task) {
		if err := s.tasks.Save(ctx, member); err != nil {
			return Task{}, err
		}
	}
	return task, nil
}

func (s *TasksService) validateChanges(ctx context.Context, changes TaskChanges) error {
	if changes.Status.Set && !changes.Status.Value.IsValid() {
		return ErrInvalidTaskStatus
	}

	if sessionID := changes.FocusSessionID.Or(nil); sessionID != nil {
		session, err := s.focusSessions.FindByID(ctx, *sessionID)
		if err != nil {
			return err
		}
		if session == nil {
			return ErrUnknownFocusSession
		}
	}
	return nil
}

func (s *TasksService) save(ctx context.Context, task Task) (Task, error) {
	if err := s.tasks.Save(ctx, task); err != nil {
		return Task{}, err
	}
	return task, nil
}

package core

import "context"

// FocusSessionsService holds the focus session use cases. One method per API
// endpoint.
type FocusSessionsService struct {
	focusSessions FocusSessionRepository
	tasks         TaskRepository
	clock         Clock
}

// List returns every session, oldest first.
func (s *FocusSessionsService) List(ctx context.Context) ([]FocusSession, error) {
	return s.focusSessions.FindAll(ctx)
}

// GetCurrent returns the current session as a client should display it, or
// nil when there is none.
func (s *FocusSessionsService) GetCurrent(ctx context.Context) (*FocusSession, error) {
	session, err := s.focusSessions.FindCurrent(ctx)
	if err != nil || session == nil {
		return nil, err
	}

	shifted := session.ShiftStartTimeByClosedPauses()
	return &shifted, nil
}

// Start starts an active session with the given tasks, or with every
// unfinished task when none are given. A nil startTime means now.
func (s *FocusSessionsService) Start(ctx context.Context, taskIDs []string, startTime *int64) (FocusSession, error) {
	tasks, err := s.tasksToStartWith(ctx, taskIDs)
	if err != nil {
		return FocusSession{}, err
	}
	sessionTaskIDs := idsOf(tasks)

	session, err := s.focusSessions.Create(ctx, FocusSession{
		Status:    FocusSessionActive,
		StartTime: valueOr(startTime, s.clock()),
		Tasks:     sessionTaskIDs,
		Pauses:    []Pause{},
	})
	if err != nil {
		return FocusSession{}, err
	}
	if err := s.tasks.AssignFocusSession(ctx, sessionTaskIDs, &session.ID); err != nil {
		return FocusSession{}, err
	}
	return session, nil
}

// Finish finishes the session, or returns ErrFocusSessionNotFound.
func (s *FocusSessionsService) Finish(ctx context.Context, id string) (FocusSession, error) {
	session, err := s.focusSessions.FindByID(ctx, id)
	if err != nil {
		return FocusSession{}, err
	}
	if session == nil {
		return FocusSession{}, ErrFocusSessionNotFound
	}
	return s.finish(ctx, *session)
}

// FinishCurrent finishes the current session.
func (s *FocusSessionsService) FinishCurrent(ctx context.Context) (FocusSession, error) {
	session, err := s.getCurrent(ctx)
	if err != nil {
		return FocusSession{}, err
	}
	return s.finish(ctx, session)
}

// Pause opens a pause on an active session.
func (s *FocusSessionsService) Pause(ctx context.Context, id string) (FocusSession, error) {
	session, err := s.focusSessions.FindByID(ctx, id)
	if err != nil {
		return FocusSession{}, err
	}
	if session == nil || session.Status != FocusSessionActive {
		return FocusSession{}, ErrCannotPause
	}

	return s.save(ctx, session.StartPause(NewPause(s.clock(), 0)))
}

// PauseCurrent pauses the current session. Sending a pauseTime always starts a
// fresh pause (closing an open one first); without it, an already paused
// session stays as is.
func (s *FocusSessionsService) PauseCurrent(ctx context.Context, pauseTime *int64) (FocusSession, error) {
	session, err := s.getCurrent(ctx)
	if err != nil {
		return FocusSession{}, err
	}
	if _, open := session.OpenPause(); open && pauseTime == nil {
		return session, nil
	}

	now := s.clock()
	return s.save(ctx, session.CloseOpenPause(now).StartPause(NewPause(now, valueOr(pauseTime, 0))))
}

// Resume closes the open pause of a paused session.
func (s *FocusSessionsService) Resume(ctx context.Context, id string) (FocusSession, error) {
	session, err := s.focusSessions.FindByID(ctx, id)
	if err != nil {
		return FocusSession{}, err
	}
	if session == nil || session.Status != FocusSessionPaused {
		return FocusSession{}, ErrCannotResume
	}

	return s.save(ctx, session.Resume(s.clock()))
}

// ResumeCurrent closes the open pause of the current session. Without an open
// pause, nothing changes.
func (s *FocusSessionsService) ResumeCurrent(ctx context.Context) (FocusSession, error) {
	session, err := s.getCurrent(ctx)
	if err != nil {
		return FocusSession{}, err
	}
	if _, open := session.OpenPause(); !open {
		return session, nil
	}

	return s.save(ctx, session.Resume(s.clock()))
}

func (s *FocusSessionsService) getCurrent(ctx context.Context) (FocusSession, error) {
	session, err := s.focusSessions.FindCurrent(ctx)
	if err != nil {
		return FocusSession{}, err
	}
	if session == nil {
		return FocusSession{}, ErrNoCurrentFocusSession
	}
	return *session, nil
}

// finish lets go of the session's unfinished tasks; completed ones keep the
// session as history.
func (s *FocusSessionsService) finish(ctx context.Context, session FocusSession) (FocusSession, error) {
	finishedSession, err := s.save(ctx, session.Finish(s.clock()))
	if err != nil {
		return FocusSession{}, err
	}

	unfinishedTasks, err := s.tasks.FindMany(ctx, TaskFilter{FocusSessionID: session.ID, Statuses: ActiveTaskStatuses})
	if err != nil {
		return FocusSession{}, err
	}
	if err := s.tasks.AssignFocusSession(ctx, idsOf(unfinishedTasks), nil); err != nil {
		return FocusSession{}, err
	}
	return finishedSession, nil
}

func (s *FocusSessionsService) tasksToStartWith(ctx context.Context, taskIDs []string) ([]Task, error) {
	if len(taskIDs) == 0 {
		return s.tasks.FindMany(ctx, TaskFilter{Statuses: ActiveTaskStatuses})
	}
	return s.findInRequestOrder(ctx, taskIDs)
}

// findInRequestOrder drops unknown and repeated ids; the rest keep the order
// they were requested in.
func (s *FocusSessionsService) findInRequestOrder(ctx context.Context, taskIDs []string) ([]Task, error) {
	found, err := s.tasks.FindMany(ctx, TaskFilter{IDs: taskIDs})
	if err != nil {
		return nil, err
	}

	tasksByID := make(map[string]Task, len(found))
	for _, task := range found {
		tasksByID[task.ID] = task
	}
	ordered := make([]Task, 0, len(found))
	for _, id := range taskIDs {
		if task, ok := tasksByID[id]; ok {
			ordered = append(ordered, task)
			delete(tasksByID, id) // a repeated id is kept once
		}
	}
	return ordered, nil
}

func (s *FocusSessionsService) save(ctx context.Context, session FocusSession) (FocusSession, error) {
	if err := s.focusSessions.Save(ctx, session); err != nil {
		return FocusSession{}, err
	}
	return session, nil
}

func idsOf(tasks []Task) []string {
	ids := make([]string, len(tasks))
	for index, task := range tasks {
		ids[index] = task.ID
	}
	return ids
}

// valueOr returns what value points to, or fallback when it is nil.
func valueOr[T any](value *T, fallback T) T {
	if value == nil {
		return fallback
	}
	return *value
}

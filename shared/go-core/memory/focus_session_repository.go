package memory

import (
	"context"
	"slices"
	"sync"
	"uuid"

	core "github.com/glrodasz/cero-api/shared/go-core"
)

// FocusSessionRepository is a core.FocusSessionRepository in memory. The zero
// value is empty and ready to use; it is safe for concurrent use.
type FocusSessionRepository struct {
	mu       sync.RWMutex
	sessions []core.FocusSession // in creation order
}

var _ core.FocusSessionRepository = (*FocusSessionRepository)(nil)

func (r *FocusSessionRepository) FindAll(_ context.Context) ([]core.FocusSession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	sessions := make([]core.FocusSession, len(r.sessions))
	for index, session := range r.sessions {
		sessions[index] = cloneSession(session)
	}
	return sessions, nil
}

func (r *FocusSessionRepository) FindByID(_ context.Context, id string) (*core.FocusSession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	index := r.indexOf(id)
	if index < 0 {
		return nil, nil
	}
	session := cloneSession(r.sessions[index])
	return &session, nil
}

func (r *FocusSessionRepository) FindCurrent(_ context.Context) (*core.FocusSession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, session := range slices.Backward(r.sessions) {
		if slices.Contains(core.CurrentSessionStatuses, session.Status) {
			current := cloneSession(session)
			return &current, nil
		}
	}
	return nil, nil
}

func (r *FocusSessionRepository) Create(_ context.Context, session core.FocusSession) (core.FocusSession, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	session.ID = uuid.New().String()
	r.sessions = append(r.sessions, cloneSession(session))
	return cloneSession(session), nil
}

func (r *FocusSessionRepository) Save(_ context.Context, session core.FocusSession) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if index := r.indexOf(session.ID); index >= 0 {
		r.sessions[index] = cloneSession(session)
	}
	return nil
}

func (r *FocusSessionRepository) indexOf(id string) int {
	return slices.IndexFunc(r.sessions, func(session core.FocusSession) bool { return session.ID == id })
}

func cloneSession(session core.FocusSession) core.FocusSession {
	session.Tasks = slices.Clone(session.Tasks)
	session.Pauses = slices.Clone(session.Pauses)
	for index, pause := range session.Pauses {
		session.Pauses[index].EndTime = clonePointer(pause.EndTime)
	}
	return session
}

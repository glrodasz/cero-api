package core

import "context"

// FocusSessionRepository is the storage port for focus sessions. Pauses are
// stored inside their session.
//
// Contract every adapter honours (see coretest.RunRepositoryContract):
//   - a malformed id is simply "not found", it is never an error;
//   - FindAll lists sessions oldest first, and never returns nil.
type FocusSessionRepository interface {
	FindAll(ctx context.Context) ([]FocusSession, error)
	// FindByID returns nil when there is no such session.
	FindByID(ctx context.Context, id string) (*FocusSession, error)
	// FindCurrent returns the newest session that is active or paused, or nil.
	FindCurrent(ctx context.Context) (*FocusSession, error)
	// Create stores a new session. Storage assigns the id: session.ID is ignored.
	Create(ctx context.Context, session FocusSession) (FocusSession, error)
	// Save overwrites the stored session with the same id.
	Save(ctx context.Context, session FocusSession) error
}

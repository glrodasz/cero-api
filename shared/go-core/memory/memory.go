// Package memory keeps everything in memory. It backs the core's unit tests
// and lets any app run without a database (STORAGE=memory).
//
// Slices keep insertion order, which doubles as creation order. Values are
// copied on the way in and out, so callers can never change stored state.
package memory

import core "github.com/glrodasz/cero-api/shared/go-core"

// NewRepositories returns repositories over empty storage.
func NewRepositories() core.Repositories {
	return core.Repositories{
		Tasks:         &TaskRepository{},
		FocusSessions: &FocusSessionRepository{},
	}
}

// clonePointer copies the value a pointer points to, so the copy can be
// stored or handed out without sharing it.
func clonePointer[T any](pointer *T) *T {
	if pointer == nil {
		return nil
	}
	value := *pointer
	return &value
}

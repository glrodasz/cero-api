package core

// Canonical messages, identical in every implementation of the API.
const (
	MsgTaskNotFound          = "Task not found"
	MsgFocusSessionNotFound  = "Focus session not found"
	MsgNoCurrentFocusSession = "No active focus session found"
	MsgCannotPause           = "Focus session not found or cannot be paused"
	MsgCannotResume          = "Focus session not found or cannot be resumed"
	MsgInvalidTaskStatus     = "Invalid task status"
	MsgUnknownFocusSession   = "focusSessionId does not match any focus session"
	MsgRouteNotFound         = "Not found"
	MsgInternalError         = "Internal server error"
)

// NotFoundError means there is nothing the use case can act on.
// REST answers 404; GraphQL sets extensions.code.
type NotFoundError struct {
	Message string
}

func (e *NotFoundError) Error() string { return e.Message }

// ValidationError means the request itself is invalid. REST answers 400.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

// The refusals the use cases return. Transports tell the two kinds apart with
// errors.As (or errors.AsType); a specific one matches with errors.Is.
// Any other error is an unexpected failure (500).
var (
	ErrTaskNotFound          = &NotFoundError{Message: MsgTaskNotFound}
	ErrFocusSessionNotFound  = &NotFoundError{Message: MsgFocusSessionNotFound}
	ErrNoCurrentFocusSession = &NotFoundError{Message: MsgNoCurrentFocusSession}
	ErrCannotPause           = &NotFoundError{Message: MsgCannotPause}
	ErrCannotResume          = &NotFoundError{Message: MsgCannotResume}
	ErrInvalidTaskStatus     = &ValidationError{Message: MsgInvalidTaskStatus}
	ErrUnknownFocusSession   = &ValidationError{Message: MsgUnknownFocusSession}
)

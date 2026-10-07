package core

// Repositories is what a storage adapter provides: one repository per aggregate.
type Repositories struct {
	Tasks         TaskRepository
	FocusSessions FocusSessionRepository
}

// Services are the use cases a transport exposes.
type Services struct {
	Tasks         *TasksService
	FocusSessions *FocusSessionsService
}

// NewServices is the composition root of the core: plug in any storage and a
// clock (SystemClock outside of tests), get the use cases.
func NewServices(repos Repositories, clock Clock) Services {
	return Services{
		Tasks:         &TasksService{tasks: repos.Tasks, focusSessions: repos.FocusSessions},
		FocusSessions: &FocusSessionsService{focusSessions: repos.FocusSessions, tasks: repos.Tasks, clock: clock},
	}
}

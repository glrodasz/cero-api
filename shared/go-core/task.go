package core

import "slices"

// TaskStatus is the stage a task is at.
type TaskStatus string

const (
	TaskInProgress TaskStatus = "in-progress"
	TaskPending    TaskStatus = "pending"
	TaskCompleted  TaskStatus = "completed"
)

// TaskStatuses lists every TaskStatus.
var TaskStatuses = []TaskStatus{TaskInProgress, TaskPending, TaskCompleted}

// ActiveTaskStatuses are the statuses of tasks that still need work.
var ActiveTaskStatuses = []TaskStatus{TaskInProgress, TaskPending}

// MaxInProgressTasks is the focus rule: a new task only starts in progress
// while fewer than this many are.
const MaxInProgressTasks = 3

// Task is one thing to do.
type Task struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	// Priority 0 is the top of its status group.
	Priority int        `json:"priority"`
	Status   TaskStatus `json:"status"`
	// FocusSessionID is the session the task is being worked on in, if any.
	FocusSessionID *string `json:"focusSessionId"`
}

// TaskChanges is a partial update of a task: only the fields that are set
// change. It decodes from JSON, keeping absent and null fields apart.
type TaskChanges struct {
	Description Optional[string]     `json:"description"`
	Priority    Optional[int]        `json:"priority"`
	Status      Optional[TaskStatus] `json:"status"`
	// Set to nil, it takes the task out of its session.
	FocusSessionID Optional[*string] `json:"focusSessionId"`
}

// IsValid reports whether s is one of the TaskStatuses.
func (s TaskStatus) IsValid() bool {
	return slices.Contains(TaskStatuses, s)
}

// StatusForNewTask applies the focus rule to a task about to be created.
func StatusForNewTask(inProgressCount int) TaskStatus {
	if inProgressCount < MaxInProgressTasks {
		return TaskInProgress
	}
	return TaskPending
}

// Renumber gives the tasks consecutive priorities 1..n, keeping their order.
// It returns new tasks and leaves the given ones untouched.
func Renumber(tasks []Task) []Task {
	renumbered := make([]Task, len(tasks))
	for index, task := range tasks {
		task.Priority = index + 1
		renumbered[index] = task
	}
	return renumbered
}

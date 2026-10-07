// The core's storage ports are TypeScript interfaces, which do not exist at
// runtime. Nest needs a value to inject them by, so each port gets a token.

/** Injects the core's `TaskRepository`. */
export const TASK_REPOSITORY = Symbol("TaskRepository");

/** Injects the core's `FocusSessionRepository`. */
export const FOCUS_SESSION_REPOSITORY = Symbol("FocusSessionRepository");

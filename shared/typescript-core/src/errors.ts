/**
 * The two ways a use case can refuse a request. Transports translate them:
 * REST answers 404 / 400, GraphQL sets `extensions.code`.
 * Anything else that is thrown is an unexpected failure (500).
 */
export class NotFoundError extends Error {
  override name = "NotFoundError";
}

export class ValidationError extends Error {
  override name = "ValidationError";
}

/** Canonical messages, identical in every implementation of the API. */
export const MESSAGES = {
  TASK_NOT_FOUND: "Task not found",
  FOCUS_SESSION_NOT_FOUND: "Focus session not found",
  NO_CURRENT_FOCUS_SESSION: "No active focus session found",
  CANNOT_PAUSE: "Focus session not found or cannot be paused",
  CANNOT_RESUME: "Focus session not found or cannot be resumed",
  INVALID_TASK_STATUS: "Invalid task status",
  UNKNOWN_FOCUS_SESSION: "focusSessionId does not match any focus session",
  ROUTE_NOT_FOUND: "Not found",
  INTERNAL_ERROR: "Internal server error",
} as const;

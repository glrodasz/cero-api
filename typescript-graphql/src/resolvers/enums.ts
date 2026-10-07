import type { FocusSessionStatus, TaskStatus } from "@cero/core";

// GraphQL enum values are SCREAMING_CASE while the core speaks kebab-case.
// Enum resolvers give each GraphQL value its internal value, and GraphQL
// translates both ways: arguments arrive as "in-progress", results leave as IN_PROGRESS.

export const TaskStatusEnum = {
  IN_PROGRESS: "in-progress",
  PENDING: "pending",
  COMPLETED: "completed",
} as const satisfies Record<string, TaskStatus>;

export const FocusSessionStatusEnum = {
  ACTIVE: "active",
  PAUSED: "paused",
  FINISHED: "finished",
} as const satisfies Record<string, FocusSessionStatus>;

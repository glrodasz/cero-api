import type { FocusSession, FocusSessionStatus, NewFocusSession, NewTask, Pause, Task, TaskStatus } from "@cero/core";
import type { Tables, TablesInsert } from "./database.types.ts";

// Rows are what PostgREST returns: snake_case columns, typed by
// `database.types.ts`, which `supabase gen types` derives from the migrations.
// The domain speaks camelCase, so every value crosses this mapping.

export type TaskRow = Tables<"tasks">;
export type FocusSessionRow = Tables<"focus_sessions">;

export const toTask = (row: TaskRow): Task => ({
  id: row.id,
  description: row.description,
  priority: row.priority,
  // `status` is a text column; its CHECK constraint only lets task statuses in.
  status: row.status as TaskStatus,
  focusSessionId: row.focus_session_id,
});

export const toTaskRow = (task: NewTask): TablesInsert<"tasks"> => ({
  description: task.description,
  priority: task.priority,
  status: task.status,
  focus_session_id: task.focusSessionId,
});

export const toFocusSession = (row: FocusSessionRow): FocusSession => ({
  id: row.id,
  status: row.status as FocusSessionStatus,
  startTime: row.start_time,
  tasks: row.task_ids,
  // jsonb has no schema, so its generated type is `Json`; this adapter is the only writer of `pauses`.
  pauses: (row.pauses as Pause[]).map(({ id, startTime, endTime, time }) => ({ id, startTime, endTime, time })),
});

export const toFocusSessionRow = (session: NewFocusSession): TablesInsert<"focus_sessions"> => ({
  status: session.status,
  start_time: session.startTime,
  task_ids: session.tasks,
  pauses: session.pauses,
});

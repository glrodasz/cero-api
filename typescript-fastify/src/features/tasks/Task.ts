export type TaskStatus = "in-progress" | "pending" | "completed";

export const ACTIVE_TASK_STATUSES: TaskStatus[] = ["in-progress", "pending"];

export type Task = {
  id: string;
  description: string;
  priority: number;
  status: TaskStatus;
  focusSessionId: string | null;
};

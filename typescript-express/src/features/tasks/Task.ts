export type TaskStatus = "complete" | "reset";

export type Task = {
  id: string;
  description: string;
  priority: number;
  status: TaskStatus;
  focusSessionId: string;
};

export const TASK_STATUSES = ["in-progress", "pending", "completed"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Tasks that still need work. */
export const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = ["in-progress", "pending"];

/** Focus rule: a new task only starts in progress while fewer than this many are. */
export const MAX_IN_PROGRESS_TASKS = 3;

export type Task = {
  id: string;
  description: string;
  /** 0 is the top of its status group. */
  priority: number;
  status: TaskStatus;
  focusSessionId: string | null;
};

export type NewTask = Omit<Task, "id">;

export type TaskChanges = Partial<NewTask>;

export const isTaskStatus = (value: unknown): value is TaskStatus =>
  TASK_STATUSES.includes(value as TaskStatus);

export const statusForNewTask = (inProgressCount: number): TaskStatus =>
  inProgressCount < MAX_IN_PROGRESS_TASKS ? "in-progress" : "pending";

/** Gives the tasks consecutive priorities 1..n, keeping their order. */
export const renumber = (tasks: readonly Task[]): Task[] =>
  tasks.map((task, index) => ({ ...task, priority: index + 1 }));

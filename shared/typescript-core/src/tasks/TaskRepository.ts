import type { NewTask, Task, TaskStatus } from "./Task.ts";

/** Every given criterion must match. An empty filter matches every task. */
export type TaskFilter = {
  ids?: readonly string[];
  statuses?: readonly TaskStatus[];
  focusSessionId?: string;
};

/**
 * The storage port for tasks. Adapters live in `database/` (Mongoose,
 * Firestore, ...) and in `../inMemory`.
 *
 * Contract every adapter honours:
 * - a malformed id is simply "not found", it never throws;
 * - lists are sorted by priority, then creation order.
 */
export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  findMany(filter: TaskFilter): Promise<Task[]>;
  countByStatus(status: TaskStatus): Promise<number>;
  /** Storage assigns the id. */
  create(task: NewTask): Promise<Task>;
  /** Overwrites the stored task with the same id. */
  save(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
  assignFocusSession(taskIds: readonly string[], focusSessionId: string | null): Promise<void>;
}

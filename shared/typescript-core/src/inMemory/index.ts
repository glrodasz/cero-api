import type { FocusSession, NewFocusSession } from "../focusSessions/FocusSession.ts";
import type { FocusSessionRepository } from "../focusSessions/FocusSessionRepository.ts";
import { CURRENT_SESSION_STATUSES } from "../focusSessions/FocusSession.ts";
import type { Repositories } from "../index.ts";
import type { NewTask, Task, TaskStatus } from "../tasks/Task.ts";
import type { TaskFilter, TaskRepository } from "../tasks/TaskRepository.ts";

/**
 * Storage adapters that keep everything in memory. They back the unit tests
 * and let any app run without a database (`STORAGE=memory`).
 *
 * A Map keeps insertion order, which doubles as creation order. Values are
 * cloned on the way in and out so callers can never mutate stored state.
 */
export class InMemoryTaskRepository implements TaskRepository {
  #tasks = new Map<string, Task>();

  async findById(id: string): Promise<Task | null> {
    const task = this.#tasks.get(id);
    return task ? structuredClone(task) : null;
  }

  async findMany({ ids, statuses, focusSessionId }: TaskFilter): Promise<Task[]> {
    return [...this.#tasks.values()]
      .filter((task) => ids === undefined || ids.includes(task.id))
      .filter((task) => statuses === undefined || statuses.includes(task.status))
      .filter((task) => focusSessionId === undefined || task.focusSessionId === focusSessionId)
      .sort((a, b) => a.priority - b.priority) // stable: ties keep creation order
      .map((task) => structuredClone(task));
  }

  async countByStatus(status: TaskStatus): Promise<number> {
    return [...this.#tasks.values()].filter((task) => task.status === status).length;
  }

  async create(newTask: NewTask): Promise<Task> {
    const task: Task = { id: crypto.randomUUID(), ...newTask };
    this.#tasks.set(task.id, structuredClone(task));
    return task;
  }

  async save(task: Task): Promise<void> {
    if (this.#tasks.has(task.id)) {
      this.#tasks.set(task.id, structuredClone(task));
    }
  }

  async delete(id: string): Promise<void> {
    this.#tasks.delete(id);
  }

  async assignFocusSession(taskIds: readonly string[], focusSessionId: string | null): Promise<void> {
    for (const id of taskIds) {
      const task = this.#tasks.get(id);
      if (task) {
        task.focusSessionId = focusSessionId;
      }
    }
  }
}

export class InMemoryFocusSessionRepository implements FocusSessionRepository {
  #sessions = new Map<string, FocusSession>();

  async findAll(): Promise<FocusSession[]> {
    return [...this.#sessions.values()].map((session) => structuredClone(session));
  }

  async findById(id: string): Promise<FocusSession | null> {
    const session = this.#sessions.get(id);
    return session ? structuredClone(session) : null;
  }

  async findCurrent(): Promise<FocusSession | null> {
    const newestFirst = [...this.#sessions.values()].reverse();
    const session = newestFirst.find((candidate) => CURRENT_SESSION_STATUSES.includes(candidate.status));
    return session ? structuredClone(session) : null;
  }

  async create(newSession: NewFocusSession): Promise<FocusSession> {
    const session: FocusSession = { id: crypto.randomUUID(), ...structuredClone(newSession) };
    this.#sessions.set(session.id, structuredClone(session));
    return session;
  }

  async save(session: FocusSession): Promise<void> {
    if (this.#sessions.has(session.id)) {
      this.#sessions.set(session.id, structuredClone(session));
    }
  }
}

export const createInMemoryRepositories = (): Repositories => ({
  tasks: new InMemoryTaskRepository(),
  focusSessions: new InMemoryFocusSessionRepository(),
});

import { MESSAGES, NotFoundError, ValidationError } from "../errors.ts";
import type { FocusSessionRepository } from "../focusSessions/FocusSessionRepository.ts";
import {
  ACTIVE_TASK_STATUSES,
  isTaskStatus,
  renumber,
  statusForNewTask,
  type Task,
  type TaskChanges,
  type TaskStatus,
} from "./Task.ts";
import type { TaskRepository } from "./TaskRepository.ts";

/** The task use cases. One public method per API endpoint. */
export class TasksService {
  #tasks: TaskRepository;
  #focusSessions: FocusSessionRepository;

  constructor({ tasks, focusSessions }: { tasks: TaskRepository; focusSessions: FocusSessionRepository }) {
    this.#tasks = tasks;
    this.#focusSessions = focusSessions;
  }

  /** What the user should be looking at: the current session's tasks, or every unfinished task. */
  async list(): Promise<Task[]> {
    const currentSession = await this.#focusSessions.findCurrent();

    return currentSession
      ? this.#tasks.findMany({ focusSessionId: currentSession.id })
      : this.#tasks.findMany({ statuses: ACTIVE_TASK_STATUSES });
  }

  async get(id: string): Promise<Task> {
    const task = await this.#tasks.findById(id);
    if (task === null) {
      throw new NotFoundError(MESSAGES.TASK_NOT_FOUND);
    }
    return task;
  }

  async create({ description }: { description: string }): Promise<Task> {
    const [inProgressCount, currentSession] = await Promise.all([
      this.#tasks.countByStatus("in-progress"),
      this.#focusSessions.findCurrent(),
    ]);

    return this.#tasks.create({
      description,
      priority: 0,
      status: statusForNewTask(inProgressCount),
      focusSessionId: currentSession?.id ?? null,
    });
  }

  async complete(id: string): Promise<Task> {
    return this.#moveToTopOf("completed", await this.get(id));
  }

  async reset(id: string): Promise<Task> {
    return this.#moveToTopOf("pending", await this.get(id));
  }

  async changeStatus(id: string, status: string): Promise<Task> {
    if (!isTaskStatus(status)) {
      throw new ValidationError(MESSAGES.INVALID_TASK_STATUS);
    }

    const task = await this.get(id);
    const updatedTask: Task = { ...task, status };
    await this.#tasks.save(updatedTask);
    return updatedTask;
  }

  async update(id: string, changes: TaskChanges): Promise<Task> {
    await this.#validateChanges(changes);
    const task = await this.get(id);

    const updatedTask: Task = {
      id: task.id,
      description: changes.description ?? task.description,
      priority: changes.priority ?? task.priority,
      status: changes.status ?? task.status,
      focusSessionId: changes.focusSessionId === undefined ? task.focusSessionId : changes.focusSessionId,
    };
    await this.#tasks.save(updatedTask);
    return updatedTask;
  }

  async delete(id: string): Promise<Task> {
    const task = await this.get(id);
    await this.#tasks.delete(task.id);
    return task;
  }

  /** The task becomes priority 0 of the group; the rest of the group follows as 1..n. */
  async #moveToTopOf(status: TaskStatus, task: Task): Promise<Task> {
    const group = await this.#tasks.findMany({ statuses: [status] });
    const rest = group.filter((member) => member.id !== task.id);

    const movedTask: Task = { ...task, status, priority: 0 };
    await Promise.all([...renumber(rest), movedTask].map((member) => this.#tasks.save(member)));
    return movedTask;
  }

  async #validateChanges(changes: TaskChanges): Promise<void> {
    if (changes.status !== undefined && !isTaskStatus(changes.status)) {
      throw new ValidationError(MESSAGES.INVALID_TASK_STATUS);
    }

    const sessionId = changes.focusSessionId;
    if (sessionId != null && (await this.#focusSessions.findById(sessionId)) === null) {
      throw new ValidationError(MESSAGES.UNKNOWN_FOCUS_SESSION);
    }
  }
}

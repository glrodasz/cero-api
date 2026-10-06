import type { Clock } from "../clock.ts";
import { MESSAGES, NotFoundError } from "../errors.ts";
import { ACTIVE_TASK_STATUSES, type Task } from "../tasks/Task.ts";
import type { TaskRepository } from "../tasks/TaskRepository.ts";
import {
  closeOpenPause,
  createPause,
  finishSession,
  openPause,
  resumeSession,
  shiftStartTimeByClosedPauses,
  startPause,
  type FocusSession,
} from "./FocusSession.ts";
import type { FocusSessionRepository } from "./FocusSessionRepository.ts";

/** The focus session use cases. One public method per API endpoint. */
export class FocusSessionsService {
  #focusSessions: FocusSessionRepository;
  #tasks: TaskRepository;
  #clock: Clock;

  constructor({
    focusSessions,
    tasks,
    clock,
  }: {
    focusSessions: FocusSessionRepository;
    tasks: TaskRepository;
    clock: Clock;
  }) {
    this.#focusSessions = focusSessions;
    this.#tasks = tasks;
    this.#clock = clock;
  }

  async list(): Promise<FocusSession[]> {
    return this.#focusSessions.findAll();
  }

  /** The current session as a client should display it, or null when there is none. */
  async getCurrent(): Promise<FocusSession | null> {
    const session = await this.#focusSessions.findCurrent();
    return session && shiftStartTimeByClosedPauses(session);
  }

  async start({ taskIds = [], startTime }: { taskIds?: string[]; startTime?: number } = {}): Promise<FocusSession> {
    const tasks =
      taskIds.length > 0 ? await this.#findInRequestOrder(taskIds) : await this.#tasks.findMany({ statuses: ACTIVE_TASK_STATUSES });
    const sessionTaskIds = tasks.map((task) => task.id);

    const session = await this.#focusSessions.create({
      status: "active",
      startTime: startTime ?? this.#clock(),
      tasks: sessionTaskIds,
      pauses: [],
    });
    await this.#tasks.assignFocusSession(sessionTaskIds, session.id);
    return session;
  }

  async finish(id: string): Promise<FocusSession> {
    return this.#finish(await this.#get(id));
  }

  async finishCurrent(): Promise<FocusSession> {
    return this.#finish(await this.#getCurrent());
  }

  async pause(id: string): Promise<FocusSession> {
    const session = await this.#focusSessions.findById(id);
    if (session?.status !== "active") {
      throw new NotFoundError(MESSAGES.CANNOT_PAUSE);
    }

    return this.#save(startPause(session, createPause({ startTime: this.#clock() })));
  }

  /**
   * Pauses the current session. Sending `time` always starts a fresh pause
   * (closing an open one first); without it, an already paused session stays as is.
   */
  async pauseCurrent({ time }: { time?: number } = {}): Promise<FocusSession> {
    const session = await this.#getCurrent();
    if (openPause(session) !== undefined && time === undefined) {
      return session;
    }

    const now = this.#clock();
    return this.#save(startPause(closeOpenPause(session, now), createPause({ startTime: now, time })));
  }

  async resume(id: string): Promise<FocusSession> {
    const session = await this.#focusSessions.findById(id);
    if (session?.status !== "paused") {
      throw new NotFoundError(MESSAGES.CANNOT_RESUME);
    }

    return this.#save(resumeSession(session, this.#clock()));
  }

  async resumeCurrent(): Promise<FocusSession> {
    const session = await this.#getCurrent();
    if (openPause(session) === undefined) {
      return session;
    }

    return this.#save(resumeSession(session, this.#clock()));
  }

  async #get(id: string): Promise<FocusSession> {
    const session = await this.#focusSessions.findById(id);
    if (session === null) {
      throw new NotFoundError(MESSAGES.FOCUS_SESSION_NOT_FOUND);
    }
    return session;
  }

  async #getCurrent(): Promise<FocusSession> {
    const session = await this.#focusSessions.findCurrent();
    if (session === null) {
      throw new NotFoundError(MESSAGES.NO_CURRENT_FOCUS_SESSION);
    }
    return session;
  }

  /** Finished sessions let go of their unfinished tasks; completed ones keep the session as history. */
  async #finish(session: FocusSession): Promise<FocusSession> {
    const finishedSession = await this.#save(finishSession(session, this.#clock()));

    const unfinishedTasks = await this.#tasks.findMany({ focusSessionId: session.id, statuses: ACTIVE_TASK_STATUSES });
    await this.#tasks.assignFocusSession(
      unfinishedTasks.map((task) => task.id),
      null,
    );
    return finishedSession;
  }

  /** Unknown ids are dropped; the rest keep the order they were requested in. */
  async #findInRequestOrder(taskIds: readonly string[]): Promise<Task[]> {
    const tasksById = new Map((await this.#tasks.findMany({ ids: taskIds })).map((task) => [task.id, task]));
    return [...new Set(taskIds)].flatMap((id) => tasksById.get(id) ?? []);
  }

  async #save(session: FocusSession): Promise<FocusSession> {
    await this.#focusSessions.save(session);
    return session;
  }
}

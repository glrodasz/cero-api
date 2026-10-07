import { systemClock, type Clock } from "./clock.ts";
import type { FocusSessionRepository } from "./focusSessions/FocusSessionRepository.ts";
import { FocusSessionsService } from "./focusSessions/FocusSessionsService.ts";
import type { TaskRepository } from "./tasks/TaskRepository.ts";
import { TasksService } from "./tasks/TasksService.ts";

export * from "./clock.ts";
export * from "./errors.ts";
export * from "./tasks/Task.ts";
export type * from "./tasks/TaskRepository.ts";
export * from "./tasks/TasksService.ts";
export * from "./focusSessions/FocusSession.ts";
export type * from "./focusSessions/FocusSessionRepository.ts";
export * from "./focusSessions/FocusSessionsService.ts";

/** What a storage adapter provides: one repository per aggregate. */
export type Repositories = {
  tasks: TaskRepository;
  focusSessions: FocusSessionRepository;
};

export type Services = {
  tasks: TasksService;
  focusSessions: FocusSessionsService;
};

/** The composition root of the core: plug in any storage, get the use cases. */
export const createServices = (repositories: Repositories, { clock = systemClock }: { clock?: Clock } = {}): Services => ({
  tasks: new TasksService(repositories),
  focusSessions: new FocusSessionsService({ ...repositories, clock }),
});

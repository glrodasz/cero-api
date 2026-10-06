import { FocusSessionsService, systemClock, type FocusSessionRepository, type TaskRepository } from "@cero/core";
import { Module } from "@nestjs/common";
import { FOCUS_SESSION_REPOSITORY, TASK_REPOSITORY } from "../storage/storage.tokens.ts";
import { FocusSessionsController } from "./focus-sessions.controller.ts";

@Module({
  controllers: [FocusSessionsController],
  providers: [
    {
      // Same as TasksModule: a factory provider turns the injected ports into the core's service.
      provide: FocusSessionsService,
      inject: [FOCUS_SESSION_REPOSITORY, TASK_REPOSITORY],
      useFactory: (focusSessions: FocusSessionRepository, tasks: TaskRepository) =>
        new FocusSessionsService({ focusSessions, tasks, clock: systemClock }),
    },
  ],
})
export class FocusSessionsModule {}

import { TasksService, type FocusSessionRepository, type TaskRepository } from "@cero/core";
import { Module } from "@nestjs/common";
import { FOCUS_SESSION_REPOSITORY, TASK_REPOSITORY } from "../storage/storage.tokens.ts";
import { TasksController } from "./tasks.controller.ts";

@Module({
  controllers: [TasksController],
  providers: [
    {
      // The core's services are plain classes that Nest knows nothing about,
      // so a factory provider builds one from the injected storage ports.
      provide: TasksService,
      inject: [TASK_REPOSITORY, FOCUS_SESSION_REPOSITORY],
      useFactory: (tasks: TaskRepository, focusSessions: FocusSessionRepository) => new TasksService({ tasks, focusSessions }),
    },
  ],
})
export class TasksModule {}

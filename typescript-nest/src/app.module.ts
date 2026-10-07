import { Module, ValidationPipe, type DynamicModule } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { ApiExceptionFilter } from "./common/api-exception.filter.ts";
import { FocusSessionsModule } from "./focus-sessions/focus-sessions.module.ts";
import { StorageModule, type StorageOptions } from "./storage/storage.module.ts";
import { TasksModule } from "./tasks/tasks.module.ts";

/**
 * The root of the module graph. The global pipe and filter are registered as
 * providers (APP_PIPE, APP_FILTER) rather than in `main.ts`, so the tests,
 * which build this module without `main.ts`, get them too.
 */
@Module({
  imports: [TasksModule, FocusSessionsModule],
  providers: [
    // `whitelist` drops properties the DTO does not declare, such as an `id` in a
    // task update. `transform` hands handlers DTO instances, even for a missing body.
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {
  /** The storage is the only thing that changes between running and testing. */
  static forRoot(storage: StorageOptions): DynamicModule {
    return { module: AppModule, imports: [StorageModule.forRoot(storage)] };
  }
}

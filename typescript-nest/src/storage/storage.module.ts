import type { Repositories } from "@cero/core";
import { createInMemoryRepositories } from "@cero/core/in-memory";
import { openMongoStorage } from "@cero/mongoose";
import { Global, Inject, Module, type DynamicModule, type OnApplicationShutdown } from "@nestjs/common";
import { FOCUS_SESSION_REPOSITORY, TASK_REPOSITORY } from "./storage.tokens.ts";

export type StorageOptions = { storage: "memory" } | { storage: "mongodb"; mongodbUri: string };

/** Repositories over an open storage, and a way to let go of it. */
type OpenStorage = { repositories: Repositories; close: () => Promise<void> };

const OPEN_STORAGE = Symbol("OpenStorage");

const openStorage = async (options: StorageOptions): Promise<OpenStorage> =>
  options.storage === "memory"
    ? { repositories: createInMemoryRepositories(), close: async () => {} }
    : openMongoStorage(options.mongodbUri);

/**
 * Provides the core's storage ports, backed by the storage the options pick.
 * It is a dynamic module (`forRoot`) because what it provides depends on
 * configuration, and global so feature modules can inject the ports without
 * importing it.
 */
@Global()
@Module({})
export class StorageModule implements OnApplicationShutdown {
  constructor(@Inject(OPEN_STORAGE) private readonly storage: OpenStorage) {}

  static forRoot(options: StorageOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        // An async factory: Nest waits for the connection before building anything that depends on it.
        { provide: OPEN_STORAGE, useFactory: () => openStorage(options) },
        { provide: TASK_REPOSITORY, inject: [OPEN_STORAGE], useFactory: (storage: OpenStorage) => storage.repositories.tasks },
        {
          provide: FOCUS_SESSION_REPOSITORY,
          inject: [OPEN_STORAGE],
          useFactory: (storage: OpenStorage) => storage.repositories.focusSessions,
        },
      ],
      exports: [TASK_REPOSITORY, FOCUS_SESSION_REPOSITORY],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.storage.close();
  }
}

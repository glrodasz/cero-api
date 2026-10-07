import type { Repositories } from "@cero/core";
import mongoose, { type Connection } from "mongoose";
import { MongooseFocusSessionRepository } from "./MongooseFocusSessionRepository.ts";
import { MongooseTaskRepository } from "./MongooseTaskRepository.ts";

export { MongooseFocusSessionRepository } from "./MongooseFocusSessionRepository.ts";
export { MongooseTaskRepository } from "./MongooseTaskRepository.ts";

/** Opens a dedicated connection (not the global `mongoose` one), so several can coexist. */
export const connectMongo = async (uri: string): Promise<Connection> => mongoose.createConnection(uri).asPromise();

export const createMongooseRepositories = (connection: Connection): Repositories => ({
  tasks: new MongooseTaskRepository(connection),
  focusSessions: new MongooseFocusSessionRepository(connection),
});

/** Everything an app needs: repositories to use, and a way to let go of the connection. */
export const openMongoStorage = async (uri: string): Promise<{ repositories: Repositories; close: () => Promise<void> }> => {
  const connection = await connectMongo(uri);
  return { repositories: createMongooseRepositories(connection), close: () => connection.close() };
};

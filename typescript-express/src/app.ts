import type { Services } from "@cero/core";
import cors from "cors";
import express, { type Express } from "express";
import { focusSessionsRouter } from "./focusSessions/focusSessions.router.ts";
import { errorHandler, routeNotFound } from "./http/errors.ts";
import { tasksRouter } from "./tasks/tasks.router.ts";

/**
 * Builds the Express application around the use cases. It knows nothing about
 * storage, which is why other packages (typescript-firebase) can reuse it.
 */
export const createApp = (services: Services): Express => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/tasks", tasksRouter(services.tasks));
  app.use("/focus-sessions", focusSessionsRouter(services.focusSessions));

  app.use(routeNotFound);
  app.use(errorHandler);

  return app;
};

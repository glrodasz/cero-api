import type { Services } from "@cero/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { focusSessionsRoutes } from "./focusSessions/focusSessions.routes.ts";
import { handleError, handleRouteNotFound } from "./http/errors.ts";
import { tasksRoutes } from "./tasks/tasks.routes.ts";

/**
 * Builds the Hono app around the use cases. It knows nothing about storage,
 * so the tests run it over the in-memory repositories.
 *
 * Supabase serves this function at /functions/v1/api and forwards each request
 * with the path starting at the function name, hence the `/api` base path.
 */
export const createApp = (services: Services): Hono => {
  const app = new Hono().basePath("/api");

  app.use(cors());

  app.route("/tasks", tasksRoutes(services.tasks));
  app.route("/focus-sessions", focusSessionsRoutes(services.focusSessions));

  app.notFound(handleRouteNotFound);
  app.onError(handleError);

  return app;
};

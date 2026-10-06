import type { Services } from "@cero/core";
import cors from "@fastify/cors";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify, { type FastifyServerOptions } from "fastify";
import { focusSessionsRoutes } from "./focusSessions/focusSessions.routes.ts";
import { handleError, handleRouteNotFound } from "./http/errors.ts";
import { tasksRoutes } from "./tasks/tasks.routes.ts";

/**
 * Builds the Fastify instance around the use cases. Everything is a plugin:
 * each feature registers its routes under a prefix and receives the service
 * it needs through the plugin options (Fastify's way of injecting dependencies).
 */
export const buildApp = (services: Services, options: FastifyServerOptions = {}) => {
  const app = Fastify({
    ...options,
    ajv: {
      // Fastify coerces types by default ("42" -> 42). The contract wants a 400 instead.
      customOptions: { coerceTypes: false },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Several endpoints take an optional body. Treating "no body" as "{}" lets
  // their schemas stay plain objects with optional properties.
  app.addHook("preValidation", async (request) => {
    request.body ??= {};
  });

  app.register(cors);
  app.register(tasksRoutes, { prefix: "/tasks", tasks: services.tasks });
  app.register(focusSessionsRoutes, { prefix: "/focus-sessions", focusSessions: services.focusSessions });

  app.setNotFoundHandler(handleRouteNotFound);
  app.setErrorHandler(handleError);

  return app;
};

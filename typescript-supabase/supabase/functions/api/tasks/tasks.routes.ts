import { TASK_STATUSES, type TasksService } from "@cero/core";
import { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "../http/validation.ts";

const createTaskBody = z.object({
  description: z.string(),
});

const taskChangesBody = z
  .object({
    description: z.string(),
    priority: z.number().int(),
    status: z.enum(TASK_STATUSES),
    focusSessionId: z.string().nullable(),
  })
  .partial();

export const tasksRoutes = (tasks: TasksService): Hono => {
  const routes = new Hono();

  routes.get("/", async (c) => c.json(await tasks.list()));

  routes.get("/:id", async (c) => c.json(await tasks.get(c.req.param("id"))));

  routes.post("/", jsonBody(createTaskBody), async (c) => c.json(await tasks.create(c.req.valid("json")), 201));

  // Hono tries matching routes in the order they were added, so these two
  // come before "/:id/:status", which would otherwise capture them.
  routes.patch("/:id/complete", async (c) => c.json(await tasks.complete(c.req.param("id"))));

  routes.patch("/:id/reset", async (c) => c.json(await tasks.reset(c.req.param("id"))));

  routes.patch("/:id/:status", async (c) => c.json(await tasks.changeStatus(c.req.param("id"), c.req.param("status"))));

  routes.patch(
    "/:id",
    jsonBody(taskChangesBody),
    async (c) => c.json(await tasks.update(c.req.param("id"), c.req.valid("json"))),
  );

  routes.delete("/:id", async (c) => c.json(await tasks.delete(c.req.param("id"))));

  return routes;
};

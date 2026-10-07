import { TASK_STATUSES, type TasksService } from "@cero/core";
import { Router } from "express";
import { z } from "zod";
import { parseBody } from "../http/validation.ts";

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

export const tasksRouter = (tasks: TasksService): Router => {
  const router = Router();

  router.get("/", async (_request, response) => {
    response.json(await tasks.list());
  });

  router.get("/:id", async (request, response) => {
    response.json(await tasks.get(request.params.id));
  });

  router.post("/", async (request, response) => {
    response.status(201).json(await tasks.create(parseBody(createTaskBody, request.body)));
  });

  // Declared before "/:id/:status", which would otherwise capture them.
  router.patch("/:id/complete", async (request, response) => {
    response.json(await tasks.complete(request.params.id));
  });

  router.patch("/:id/reset", async (request, response) => {
    response.json(await tasks.reset(request.params.id));
  });

  router.patch("/:id/:status", async (request, response) => {
    response.json(await tasks.changeStatus(request.params.id, request.params.status));
  });

  router.patch("/:id", async (request, response) => {
    response.json(await tasks.update(request.params.id, parseBody(taskChangesBody, request.body)));
  });

  router.delete("/:id", async (request, response) => {
    response.json(await tasks.delete(request.params.id));
  });

  return router;
};

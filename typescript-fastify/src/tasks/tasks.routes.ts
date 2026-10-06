import { TASK_STATUSES, type TasksService } from "@cero/core";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";

// TypeBox schemas are JSON Schema that Fastify validates against, and at the
// same time the TypeScript types of `request.params` and `request.body`.
const TaskParams = Type.Object({ id: Type.String() });

const TaskStatusParams = Type.Object({ id: Type.String(), status: Type.String() });

const CreateTaskBody = Type.Object({ description: Type.String() });

const TaskChangesBody = Type.Partial(
  Type.Object({
    description: Type.String(),
    priority: Type.Integer(),
    status: Type.Union(TASK_STATUSES.map((status) => Type.Literal(status))),
    focusSessionId: Type.Union([Type.String(), Type.Null()]),
  }),
);

export const tasksRoutes: FastifyPluginAsyncTypebox<{ tasks: TasksService }> = async (app, { tasks }) => {
  app.get("/", async () => tasks.list());

  app.get("/:id", { schema: { params: TaskParams } }, async (request) => tasks.get(request.params.id));

  app.post("/", { schema: { body: CreateTaskBody } }, async (request, reply) => {
    reply.code(201);
    return tasks.create(request.body);
  });

  // Fastify's router prefers static segments, so "complete" and "reset" win over ":status".
  app.patch("/:id/complete", { schema: { params: TaskParams } }, async (request) => tasks.complete(request.params.id));

  app.patch("/:id/reset", { schema: { params: TaskParams } }, async (request) => tasks.reset(request.params.id));

  app.patch("/:id/:status", { schema: { params: TaskStatusParams } }, async (request) =>
    tasks.changeStatus(request.params.id, request.params.status),
  );

  app.patch("/:id", { schema: { params: TaskParams, body: TaskChangesBody } }, async (request) =>
    tasks.update(request.params.id, request.body),
  );

  app.delete("/:id", { schema: { params: TaskParams } }, async (request) => tasks.delete(request.params.id));
};

import type { FocusSessionsService } from "@cero/core";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";

const SessionParams = Type.Object({ id: Type.String() });

const StartSessionBody = Type.Object({
  tasks: Type.Optional(Type.Array(Type.String())),
  startTime: Type.Optional(Type.Integer()),
});

const PauseBody = Type.Object({
  time: Type.Optional(Type.Integer()),
});

export const focusSessionsRoutes: FastifyPluginAsyncTypebox<{ focusSessions: FocusSessionsService }> = async (
  app,
  { focusSessions },
) => {
  app.get("/", async () => focusSessions.list());

  // The contract answers an empty object, not null, when no session is current.
  app.get("/active", async () => (await focusSessions.getCurrent()) ?? {});

  app.post("/", { schema: { body: StartSessionBody } }, async (request, reply) => {
    const { tasks, startTime } = request.body;
    reply.code(201);
    return focusSessions.start({ taskIds: tasks, startTime });
  });

  app.patch("/finish", async () => focusSessions.finishCurrent());

  app.patch("/pause", { schema: { body: PauseBody } }, async (request) => focusSessions.pauseCurrent(request.body));

  app.patch("/resume", async () => focusSessions.resumeCurrent());

  app.patch("/:id/finish", { schema: { params: SessionParams } }, async (request) => focusSessions.finish(request.params.id));

  app.patch("/:id/pause", { schema: { params: SessionParams } }, async (request) => focusSessions.pause(request.params.id));

  app.patch("/:id/resume", { schema: { params: SessionParams } }, async (request) => focusSessions.resume(request.params.id));
};

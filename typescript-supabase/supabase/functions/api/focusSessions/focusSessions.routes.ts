import type { FocusSessionsService } from "@cero/core";
import { Hono } from "hono";
import { z } from "zod";
import { jsonBody } from "../http/validation.ts";

const startSessionBody = z.object({
  tasks: z.array(z.string()).optional(),
  startTime: z.number().int().optional(),
});

const pauseBody = z.object({
  time: z.number().int().optional(),
});

export const focusSessionsRoutes = (focusSessions: FocusSessionsService): Hono => {
  const routes = new Hono();

  routes.get("/", async (c) => c.json(await focusSessions.list()));

  // The contract answers an empty object, not null, when no session is current.
  routes.get("/active", async (c) => c.json((await focusSessions.getCurrent()) ?? {}));

  routes.post("/", jsonBody(startSessionBody), async (c) => {
    const { tasks, startTime } = c.req.valid("json");
    return c.json(await focusSessions.start({ taskIds: tasks, startTime }), 201);
  });

  routes.patch("/finish", async (c) => c.json(await focusSessions.finishCurrent()));

  routes.patch(
    "/pause",
    jsonBody(pauseBody),
    async (c) => c.json(await focusSessions.pauseCurrent(c.req.valid("json"))),
  );

  routes.patch("/resume", async (c) => c.json(await focusSessions.resumeCurrent()));

  routes.patch("/:id/finish", async (c) => c.json(await focusSessions.finish(c.req.param("id"))));

  routes.patch("/:id/pause", async (c) => c.json(await focusSessions.pause(c.req.param("id"))));

  routes.patch("/:id/resume", async (c) => c.json(await focusSessions.resume(c.req.param("id"))));

  return routes;
};

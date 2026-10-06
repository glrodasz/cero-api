import type { FocusSessionsService } from "@cero/core";
import { Router } from "express";
import { z } from "zod";
import { parseBody } from "../http/validation.ts";

const startSessionBody = z.object({
  tasks: z.array(z.string()).optional(),
  startTime: z.number().int().optional(),
});

const pauseBody = z.object({
  time: z.number().int().optional(),
});

export const focusSessionsRouter = (focusSessions: FocusSessionsService): Router => {
  const router = Router();

  router.get("/", async (_request, response) => {
    response.json(await focusSessions.list());
  });

  router.get("/active", async (_request, response) => {
    // The contract answers an empty object, not null, when no session is current.
    response.json((await focusSessions.getCurrent()) ?? {});
  });

  router.post("/", async (request, response) => {
    const { tasks, startTime } = parseBody(startSessionBody, request.body);
    response.status(201).json(await focusSessions.start({ taskIds: tasks, startTime }));
  });

  router.patch("/finish", async (_request, response) => {
    response.json(await focusSessions.finishCurrent());
  });

  router.patch("/pause", async (request, response) => {
    response.json(await focusSessions.pauseCurrent(parseBody(pauseBody, request.body)));
  });

  router.patch("/resume", async (_request, response) => {
    response.json(await focusSessions.resumeCurrent());
  });

  router.patch("/:id/finish", async (request, response) => {
    response.json(await focusSessions.finish(request.params.id));
  });

  router.patch("/:id/pause", async (request, response) => {
    response.json(await focusSessions.pause(request.params.id));
  });

  router.patch("/:id/resume", async (request, response) => {
    response.json(await focusSessions.resume(request.params.id));
  });

  return router;
};

import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { HTTP_STATUS } from "../common/constants";
import { focusSessionsService } from "./focusSessions.service";

type FocusSessionParams = { id: string };

type CreateSessionRequest = FastifyRequest<{
  Body: { tasks: string[]; startTime?: number };
}>;

type SessionRequest = FastifyRequest<{ Params: FocusSessionParams }>;

const isCreateSessionBody = (
  body: unknown
): body is { tasks: string[]; startTime?: number } => {
  if (body == null || typeof body !== "object") {
    return false;
  }

  const candidate = body as { tasks?: unknown; startTime?: unknown };

  const hasValidTasks =
    Array.isArray(candidate.tasks) &&
    candidate.tasks.every((taskId) => typeof taskId === "string");

  const hasValidStartTime =
    candidate.startTime === undefined || typeof candidate.startTime === "number";

  return hasValidTasks && hasValidStartTime;
};

const sendError = (reply: FastifyReply, statusCode: number, message: string) =>
  reply.status(statusCode).send({ message });

export default async function focusSessionRouter(app: FastifyInstance) {
  app.get("/active", async (_request, reply: FastifyReply) => {
    try {
      const sessions = await focusSessionsService.getActiveSessions();
      reply.status(HTTP_STATUS.OK).send(sessions);
    } catch (error) {
      app.log.error(error);
      sendError(
        reply,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Failed to fetch focus sessions"
      );
    }
  });

  app.post("/", async (request: CreateSessionRequest, reply) => {
    try {
      if (!isCreateSessionBody(request.body)) {
        return sendError(
          reply,
          HTTP_STATUS.BAD_REQUEST,
          "Invalid focus session payload"
        );
      }

      const session = await focusSessionsService.createSession(request.body);
      reply.status(HTTP_STATUS.CREATED).send(session);
    } catch (error) {
      app.log.error(error);
      sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create session");
    }
  });

  app.patch("/:id/finish", async (request: SessionRequest, reply) => {
    try {
      const session = await focusSessionsService.finishSession(request.params.id);

      if (!session) {
        return sendError(reply, HTTP_STATUS.NOT_FOUND, "Focus session not found");
      }

      reply.status(HTTP_STATUS.OK).send(session);
    } catch (error) {
      app.log.error(error);
      sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to finish session");
    }
  });

  app.patch("/:id/pause", async (request: SessionRequest, reply) => {
    try {
      const session = await focusSessionsService.pauseSession(request.params.id);

      if (!session) {
        return sendError(
          reply,
          HTTP_STATUS.NOT_FOUND,
          "Focus session not found or cannot be paused"
        );
      }

      reply.status(HTTP_STATUS.OK).send(session);
    } catch (error) {
      app.log.error(error);
      sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to pause session");
    }
  });

  app.patch("/:id/resume", async (request: SessionRequest, reply) => {
    try {
      const session = await focusSessionsService.resumeSession(request.params.id);

      if (!session) {
        return sendError(
          reply,
          HTTP_STATUS.NOT_FOUND,
          "Focus session not found or cannot be resumed"
        );
      }

      reply.status(HTTP_STATUS.OK).send(session);
    } catch (error) {
      app.log.error(error);
      sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to resume session");
    }
  });
}

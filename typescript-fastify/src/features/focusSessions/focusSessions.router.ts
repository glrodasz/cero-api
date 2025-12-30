import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { FocusSession } from "./FocusSession.js";
import { HTTP_STATUS } from "../common/constants.js";
import { focusSessionsService } from "./focusSessions.service.js";
import { tasksService } from "../tasks/tasks.service.js";
import type { Task } from "../tasks/Task.js";
import { ACTIVE_TASK_STATUSES } from "../tasks/Task.js";

type ErrorResponse = { message: string };

type FocusSessionParams = { id: FocusSession["id"] };

type CreateSessionRequest = FastifyRequest<{
  Body: { tasks?: Task["id"][]; startTime?: number };
}>;

type SessionRequest = FastifyRequest<{ Params: FocusSessionParams }>;

const isCreateSessionBody = (
  body: unknown
): body is { tasks: Task["id"][]; startTime?: number } => {
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

export default async function focusSessionRouter(app: FastifyInstance) {
  app.get("/", async (_request, reply: FastifyReply<FocusSession[] | ErrorResponse>) => {
    try {
      const sessions = await focusSessionsService.getAllSessions();
      reply.status(HTTP_STATUS.OK).send(sessions);
    } catch (error) {
      app.log.error(error);
      reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to fetch focus sessions" });
    }
  });

  app.get("/active", async (_request, reply: FastifyReply<FocusSession | ErrorResponse | {}>) => {
    try {
      const session = await focusSessionsService.getActiveSessionWithAdjustedStartTime();
      if (!session) {
        return reply.status(HTTP_STATUS.OK).send({});
      }
      reply.status(HTTP_STATUS.OK).send(session);
    } catch (error) {
      app.log.error(error);
      reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to fetch active focus session" });
    }
  });

  app.post("/", async (request: CreateSessionRequest, reply: FastifyReply<FocusSession | ErrorResponse>) => {
    try {
      // If no tasks provided, get in-progress/pending tasks automatically
      let taskIds: Task["id"][] = [];
      if (request.body && typeof request.body === "object" && "tasks" in request.body) {
        const candidate = request.body as { tasks?: unknown };
        if (Array.isArray(candidate.tasks)) {
          taskIds = candidate.tasks.filter((id) => typeof id === "string");
        }
      }

      // If no tasks provided, get all in-progress/pending tasks
      if (taskIds.length === 0) {
        const tasks = await tasksService.getTasksByStatuses(ACTIVE_TASK_STATUSES);
        taskIds = tasks.map((task: Task) => task.id);
      }

      // Create session
      const session = await focusSessionsService.createSession({
        tasks: taskIds,
        startTime: request.body && typeof request.body === "object" && "startTime" in request.body
          ? (request.body as { startTime?: number }).startTime
          : undefined,
      });

      // Update all tasks' focusSessionId to the new session ID
      if (taskIds.length > 0) {
        await tasksService.updateTasksFocusSessionId(taskIds, session.id);
      }

      reply.status(HTTP_STATUS.CREATED).send(session);
    } catch (error) {
      app.log.error(error);
      reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to create focus session" });
    }
  });

  app.patch(
    "/finish",
    async (_request, reply: FastifyReply<FocusSession | ErrorResponse>) => {
      try {
        // Get active focus session (matching local API behavior)
        const activeSessions = await focusSessionsService.getActiveSessions();
        const activeFocusSession = activeSessions[0] || null;

        if (!activeFocusSession) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "No active focus session found" });
        }

        // Finish the session
        const session = await focusSessionsService.finishSession(activeFocusSession.id);

        if (!session) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "Focus session not found" });
        }

        // Get all tasks with status "in-progress" or "pending" (not filtered by session)
        // This matches the local API which gets all in-progress/pending tasks
        const tasks = await tasksService.getTasksByStatuses(ACTIVE_TASK_STATUSES);

        // Update all those tasks' focusSessionId to empty string
        if (tasks.length > 0) {
          await tasksService.updateTasksFocusSessionId(
            tasks.map((task: Task) => task.id),
            ""
          );
        }

        reply.status(HTTP_STATUS.OK).send(session);
      } catch (error) {
        app.log.error(error);
        reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to finish focus session" });
      }
    }
  );

  app.patch(
    "/:id/finish",
    async (request: SessionRequest, reply: FastifyReply<FocusSession | ErrorResponse>) => {
      try {
        const session = await focusSessionsService.finishSession(request.params.id);

        if (!session) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "Focus session not found" });
        }

        // Get all tasks with status "in-progress" or "pending" that belong to this session
        const tasks = await tasksService.getTasksByFocusSessionIdAndStatuses(
          session.id,
          ACTIVE_TASK_STATUSES
        );

        // Update all those tasks' focusSessionId to empty string
        if (tasks.length > 0) {
          await tasksService.updateTasksFocusSessionId(
            tasks.map((task: Task) => task.id),
            ""
          );
        }

        reply.status(HTTP_STATUS.OK).send(session);
      } catch (error) {
        app.log.error(error);
        reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to finish focus session" });
      }
    }
  );

  app.patch(
    "/:id/pause",
    async (request: SessionRequest, reply: FastifyReply<FocusSession | ErrorResponse>) => {
      try {
        const session = await focusSessionsService.pauseSession(request.params.id);

        if (!session) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "Focus session not found or cannot be paused" });
        }

        reply.status(HTTP_STATUS.OK).send(session);
      } catch (error) {
        app.log.error(error);
        reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to pause focus session" });
      }
    }
  );

  app.patch(
    "/pause",
    async (request: FastifyRequest<{ Body?: { time?: number } }>, reply: FastifyReply<FocusSession | ErrorResponse>) => {
      try {
        const time = request.body && typeof request.body === "object" && "time" in request.body
          ? typeof (request.body as { time?: unknown }).time === "number"
            ? (request.body as { time: number }).time
            : undefined
          : undefined;

        const session = await focusSessionsService.pauseActiveSession(time);

        if (!session) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "No active focus session found" });
        }

        reply.status(HTTP_STATUS.OK).send(session);
      } catch (error) {
        app.log.error(error);
        reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to pause focus session" });
      }
    }
  );

  app.patch(
    "/resume",
    async (_request, reply: FastifyReply<FocusSession | ErrorResponse>) => {
      try {
        const session = await focusSessionsService.resumeActiveSession();

        if (!session) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "No active focus session found" });
        }

        reply.status(HTTP_STATUS.OK).send(session);
      } catch (error) {
        app.log.error(error);
        reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to resume focus session" });
      }
    }
  );

  app.patch(
    "/:id/resume",
    async (request: SessionRequest, reply: FastifyReply<FocusSession | ErrorResponse>) => {
      try {
        const session = await focusSessionsService.resumeSession(request.params.id);

        if (!session) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "Focus session not found or cannot be resumed" });
        }

        reply.status(HTTP_STATUS.OK).send(session);
      } catch (error) {
        app.log.error(error);
        reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to resume focus session" });
      }
    }
  );
}

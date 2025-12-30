import {
  Router,
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { FocusSession } from "./FocusSession.js";
import { HTTP_STATUS } from "../common/constants.js";
import { focusSessionsService } from "./focusSessions.service.js";
import { tasksService } from "../tasks/tasks.service.js";
import type { Task } from "../tasks/Task.js";
import { ACTIVE_TASK_STATUSES } from "../tasks/Task.js";

type ErrorResponse = { message: string };

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

const focusSessionRouter: Router = Router();

focusSessionRouter.get(
  "/",
  async (
    req: Request,
    res: Response<FocusSession[] | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const sessions = await focusSessionsService.getAllSessions();
      res.status(HTTP_STATUS.OK).json(sessions);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.get(
  "/active",
  async (
    req: Request,
    res: Response<FocusSession | ErrorResponse | {}>,
    next: NextFunction
  ) => {
    try {
      const session = await focusSessionsService.getActiveSessionWithAdjustedStartTime();
      if (!session) {
        return res.status(HTTP_STATUS.OK).json({});
      }
      res.status(HTTP_STATUS.OK).json(session);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.post(
  "/",
  async (
    req: Request,
    res: Response<FocusSession | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      // If no tasks provided, get in-progress/pending tasks automatically
      let taskIds: Task["id"][] = [];
      if (req.body && typeof req.body === "object" && "tasks" in req.body) {
        const candidate = req.body as { tasks?: unknown };
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
        startTime: req.body && typeof req.body === "object" && "startTime" in req.body
          ? (req.body as { startTime?: number }).startTime
          : undefined,
      });

      // Update all tasks' focusSessionId to the new session ID
      if (taskIds.length > 0) {
        await tasksService.updateTasksFocusSessionId(taskIds, session.id);
      }

      res.status(HTTP_STATUS.CREATED).json(session);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.patch(
  "/finish",
  async (
    req: Request,
    res: Response<FocusSession | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      // Get active focus session (matching local API behavior)
      const activeSessions = await focusSessionsService.getActiveSessions();
      const activeFocusSession = activeSessions[0] || null;

      if (!activeFocusSession) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "No active focus session found" });
      }

      // Finish the session
      const session = await focusSessionsService.finishSession(activeFocusSession.id);

      if (!session) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "Focus session not found" });
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

      res.status(HTTP_STATUS.OK).json(session);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.patch(
  "/:id/finish",
  async (
    req: Request<{ id: FocusSession["id"] }>,
    res: Response<FocusSession | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const session = await focusSessionsService.finishSession(req.params.id);

      if (!session) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "Focus session not found" });
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

      res.status(HTTP_STATUS.OK).json(session);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.patch(
  "/:id/pause",
  async (
    req: Request<{ id: FocusSession["id"] }>,
    res: Response<FocusSession | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const session = await focusSessionsService.pauseSession(req.params.id);

      if (!session) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "Focus session not found or cannot be paused" });
      }

      res.status(HTTP_STATUS.OK).json(session);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.patch(
  "/pause",
  async (
    req: Request,
    res: Response<FocusSession | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const time = req.body && typeof req.body === "object" && "time" in req.body
        ? typeof (req.body as { time?: unknown }).time === "number"
          ? (req.body as { time: number }).time
          : undefined
        : undefined;

      const session = await focusSessionsService.pauseActiveSession(time);

      if (!session) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "No active focus session found" });
      }

      res.status(HTTP_STATUS.OK).json(session);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.patch(
  "/resume",
  async (
    req: Request,
    res: Response<FocusSession | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const session = await focusSessionsService.resumeActiveSession();

      if (!session) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "No active focus session found" });
      }

      res.status(HTTP_STATUS.OK).json(session);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.patch(
  "/:id/resume",
  async (
    req: Request<{ id: FocusSession["id"] }>,
    res: Response<FocusSession | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const session = await focusSessionsService.resumeSession(req.params.id);

      if (!session) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "Focus session not found or cannot be resumed" });
      }

      res.status(HTTP_STATUS.OK).json(session);
    } catch (error) {
      next(error);
    }
  }
);

export default (app: Application) => {
  app.use("/focus-sessions", focusSessionRouter);
};

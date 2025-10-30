import {
  Router,
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { FocusSession } from "./FocusSession";
import { HTTP_STATUS } from "../common/constants";
import { focusSessionsService } from "./focusSessions.service";

type ErrorResponse = { message: string };

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

const focusSessionRouter: Router = Router();

focusSessionRouter.get(
  "/active",
  async (
    req: Request,
    res: Response<FocusSession[] | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const sessions = await focusSessionsService.getActiveSessions();
      res.status(HTTP_STATUS.OK).json(sessions);
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
      if (!isCreateSessionBody(req.body)) {
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ message: "Invalid focus session payload" });
      }

      const session = await focusSessionsService.createSession(req.body);
      res.status(HTTP_STATUS.CREATED).json(session);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.patch(
  "/:id/finish",
  async (
    req: Request<{ id: string }>,
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

      res.status(HTTP_STATUS.OK).json(session);
    } catch (error) {
      next(error);
    }
  }
);

focusSessionRouter.patch(
  "/:id/pause",
  async (
    req: Request<{ id: string }>,
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
  "/:id/resume",
  async (
    req: Request<{ id: string }>,
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

import {
  Router,
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { Task, TaskStatus } from "./Task";
import { HTTP_STATUS } from "../common/constants";
import { tasksService } from "./tasks.service";

const tasksRouter: Router = Router();

type ErrorResponse = { message: string };

const isTaskStatus = (status: unknown): status is TaskStatus =>
  status === "complete" || status === "reset";

const isCreateTaskBody = (body: unknown): body is Omit<Task, "id"> => {
  if (body == null || typeof body !== "object") {
    return false;
  }

  const candidate = body as Partial<Omit<Task, "id">>;
  return (
    typeof candidate.description === "string" &&
    typeof candidate.priority === "number" &&
    isTaskStatus(candidate.status) &&
    typeof candidate.focusSessionId === "string"
  );
};

tasksRouter.get(
  "/",
  async (
    req: Request,
    res: Response<Task[] | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const tasks = await tasksService.getTasks();
      res.status(HTTP_STATUS.OK).json(tasks);
    } catch (error) {
      next(error);
    }
  }
);

tasksRouter.get(
  "/:id",
  async (
    req: Request<{ id: Task["id"] }>,
    res: Response<Task | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const task = await tasksService.getTask(req.params.id);

      if (task == null) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "Task not found" });
      }

      res.status(HTTP_STATUS.OK).json(task);
    } catch (error) {
      next(error);
    }
  }
);

tasksRouter.post(
  "/",
  async (req: Request, res: Response<Task | ErrorResponse>, next: NextFunction) => {
    try {
      if (!isCreateTaskBody(req.body)) {
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ message: "Invalid task payload" });
      }

      const result = await tasksService.createTask(req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      next(error);
    }
  }
);

tasksRouter.patch(
  "/:id/:status",
  async (
    req: Request<{
      id: Task["id"];
      status: TaskStatus;
    }>,
    res: Response<Task | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const { id, status } = req.params;
      if (!isTaskStatus(status)) {
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ message: "Invalid task status" });
      }
      const updatedTask = await tasksService.updateTask(id, { status });

      if (!updatedTask) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "Task not found" });
      }

      res.status(HTTP_STATUS.OK).json(updatedTask);
    } catch (error) {
      next(error);
    }
  }
);

tasksRouter.patch(
  "/:id/",
  async (
    req: Request<{ id: Task["id"] }, Task | ErrorResponse, Partial<Task>>,
    res: Response<Task | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const { id: _ignoredId, ...body } = req.body ?? {};
      const updatedTask = await tasksService.updateTask(id, body);

      if (!updatedTask) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "Task not found" });
      }

      res.status(HTTP_STATUS.OK).json(updatedTask);
    } catch (error) {
      next(error);
    }
  }
);

tasksRouter.delete(
  "/:id",
  async (
    req: Request<{
      id: Task["id"];
    }>,
    res: Response<Task | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const deletedTask = await tasksService.deleteTask(id);

      if (!deletedTask) {
        return res
          .status(HTTP_STATUS.NOT_FOUND)
          .json({ message: "Task not found" });
      }

      res.status(HTTP_STATUS.OK).json(deletedTask);
    } catch (error) {
      next(error);
    }
  }
);

export default (app: Application) => {
  app.use("/tasks", tasksRouter);
};

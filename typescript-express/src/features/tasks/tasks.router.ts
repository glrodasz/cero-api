import express, {
  Express,
  Router,
  Request,
  Response,
  NextFunction,
} from "express";
import type { Task, TaskStatus } from "./Task";
import { HTTP_STATUS } from "../common/constants";
import { tasksService } from "./tasks.service";

const tasksRouter: Router = express.Router();

tasksRouter.get(
  "/",
  async (req: Request, res: Response<Task[]>, next: NextFunction) => {
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
    res: Response<Task>,
    next: NextFunction
  ) => {
    try {
      const task = await tasksService.getTask(req.params.id);

      if (task == null) {
        return res.status(HTTP_STATUS.NOT_FOUND);
      }

      res.status(HTTP_STATUS.OK).json(task);
    } catch (error) {
      next(error);
    }
  }
);

tasksRouter.post(
  "/",
  async (
    req: Request<null, Omit<Task, "id">>,
    res: Response<Task>,
    next: NextFunction
  ) => {
    try {
      const task = req.body.task;
      const result = await tasksService.createTask();
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
    res: Response<Task>,
    next: NextFunction
  ) => {
    try {
      const { id, status } = req.params;
      const updatedTask = await tasksService.updateTask(id, { status });

      if (!updatedTask) {
        return res.status(HTTP_STATUS.NOT_FOUND);
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
    req: Request<{ id: Task["id"] }, Partial<Task>>,
    res: Response<Task>,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const updatedTask = await tasksService.updateTask(id, body);

      if (!updatedTask) {
        return res.status(HTTP_STATUS.NOT_FOUND);
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
    res: Response<Task>,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const deletedTask = await tasksService.deleteTask(id);

      if (!deletedTask) {
        return res.status(HTTP_STATUS.NOT_FOUND);
      }

      res.status(HTTP_STATUS.OK).json(deletedTask);
    } catch (error) {
      next(error);
    }
  }
);

export default (app: Express) => {
  app.use("/tasks", tasksRouter);
};

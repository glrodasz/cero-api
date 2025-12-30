import {
  Router,
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { Task, TaskStatus } from "./Task.js";
import { ACTIVE_TASK_STATUSES } from "./Task.js";
import { HTTP_STATUS } from "../common/constants.js";
import { tasksService } from "./tasks.service.js";
import { focusSessionsService } from "../focusSessions/focusSessions.service.js";

const tasksRouter: Router = Router();

type ErrorResponse = { message: string };

const isTaskStatus = (status: unknown): status is TaskStatus =>
  status === "in-progress" || status === "pending" || status === "completed";

const isCreateTaskBody = (body: unknown): body is Omit<Task, "id"> => {
  if (body == null || typeof body !== "object") {
    return false;
  }

  const candidate = body as Partial<Omit<Task, "id">>;
  return (
    typeof candidate.description === "string" &&
    typeof candidate.priority === "number" &&
    isTaskStatus(candidate.status) &&
    (typeof candidate.focusSessionId === "string" || candidate.focusSessionId === null)
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
      // Get active focus session
      const activeFocusSession = await focusSessionsService.getActiveSession();

      let tasks: Task[];

      if (activeFocusSession) {
        // If there's an active focus session, return tasks for that session
        tasks = await tasksService.getTasksByFocusSessionId(activeFocusSession.id);
      } else {
        // If no active session, return tasks with status "in-progress" OR "pending"
        tasks = await tasksService.getTasksByStatuses(ACTIVE_TASK_STATUSES);
      }

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
      // Only require description
      if (!req.body || typeof req.body.description !== "string") {
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ message: "Invalid task payload: description is required" });
      }

      // Get active focus session
      const activeFocusSession = (await focusSessionsService.getActiveSessions())[0] || null;

      // Count in-progress tasks (status === "in-progress")
      const inProgressTasks = await tasksService.getTasksByStatus("in-progress");
      const MAXIMUM_IN_PRIORITY_TASKS = 3; // Default, can be made configurable

      // Determine status based on in-progress task count
      let status: TaskStatus;
      if (inProgressTasks.length < MAXIMUM_IN_PRIORITY_TASKS) {
        status = "in-progress";
      } else {
        status = "pending";
      }

      const taskData: Omit<Task, "id"> = {
        description: req.body.description,
        priority: 0,
        status,
        focusSessionId: activeFocusSession?.id ?? null,
      };

      const result = await tasksService.createTask(taskData);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      next(error);
    }
  }
);

tasksRouter.patch(
  "/:id/complete",
  async (
    req: Request<{ id: Task["id"] }>,
    res: Response<Task | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const taskId = req.params.id;

      // Get all completed tasks (excluding the target task)
      const completedTasks = (await tasksService.getTasksByStatus("completed")).filter(
        (task) => task.id !== taskId
      );

      // Update priorities of completed tasks (reorder them)
      if (completedTasks.length > 0) {
        const priorityUpdates = completedTasks.map((task, index) => ({
          id: task.id,
          priority: index + 1,
        }));
        await tasksService.updateTasksPriorities(priorityUpdates);
      }

      // Complete the target task (set status to "completed", priority to 0)
      const updatedTask = await tasksService.updateTask(taskId, {
        status: "completed",
        priority: 0,
      });

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
  "/:id/reset",
  async (
    req: Request<{ id: Task["id"] }>,
    res: Response<Task | ErrorResponse>,
    next: NextFunction
  ) => {
    try {
      const taskId = req.params.id;

      // Get all pending tasks (excluding the target task)
      const pendingTasks = (await tasksService.getTasksByStatus("pending")).filter(
        (task) => task.id !== taskId
      );

      // Update priorities of pending tasks (reorder them)
      if (pendingTasks.length > 0) {
        const priorityUpdates = pendingTasks.map((task, index) => ({
          id: task.id,
          priority: index + 1,
        }));
        await tasksService.updateTasksPriorities(priorityUpdates);
      }

      // Reset the target task (set status to "pending", priority to 0)
      const updatedTask = await tasksService.updateTask(taskId, {
        status: "pending",
        priority: 0,
      });

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
  "/:id/:status",
  async (
    req: Request<{
      id: Task["id"];
      status: string;
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

import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { Task, TaskStatus } from "./Task.js";
import { ACTIVE_TASK_STATUSES } from "./Task.js";
import { HTTP_STATUS } from "../common/constants.js";
import { tasksService } from "./tasks.service.js";
import { focusSessionsService } from "../focusSessions/focusSessions.service.js";

type ErrorResponse = { message: string };

type TaskParams = { id: Task["id"] };

type TaskStatusParams = TaskParams & { status: string };

type UpdateTaskRequest = FastifyRequest<{ Params: TaskParams; Body: Partial<Task> }>;

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

export default async function tasksRouter(app: FastifyInstance) {
  app.get("/", async (_request, reply: FastifyReply<Task[] | ErrorResponse>) => {
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

      reply.status(HTTP_STATUS.OK).send(tasks);
    } catch (error) {
      app.log.error(error);
      reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/:id", async (request: FastifyRequest<{ Params: TaskParams }>, reply: FastifyReply<Task | ErrorResponse>) => {
    try {
      const task = await tasksService.getTask(request.params.id);

      if (task == null) {
        return reply.status(HTTP_STATUS.NOT_FOUND).send({ message: "Task not found" });
      }

      reply.status(HTTP_STATUS.OK).send(task);
    } catch (error) {
      app.log.error(error);
      reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to fetch task" });
    }
  });

  app.post("/", async (request: FastifyRequest<{ Body: { description: string } }>, reply: FastifyReply<Task | ErrorResponse>) => {
    try {
      // Only require description
      if (!request.body || typeof request.body.description !== "string") {
        return reply
          .status(HTTP_STATUS.BAD_REQUEST)
          .send({ message: "Invalid task payload: description is required" });
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
        description: request.body.description,
        priority: 0,
        status,
        focusSessionId: activeFocusSession?.id ?? null,
      };

      const result = await tasksService.createTask(taskData);
      reply.status(HTTP_STATUS.CREATED).send(result);
    } catch (error) {
      app.log.error(error);
      reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to create task" });
    }
  });

  app.patch(
    "/:id/complete",
    async (request: FastifyRequest<{ Params: TaskParams }>, reply: FastifyReply<Task | ErrorResponse>) => {
      try {
        const taskId = request.params.id;

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
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "Task not found" });
        }

        reply.status(HTTP_STATUS.OK).send(updatedTask);
      } catch (error) {
        app.log.error(error);
        reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to complete task" });
      }
    }
  );

  app.patch(
    "/:id/reset",
    async (request: FastifyRequest<{ Params: TaskParams }>, reply: FastifyReply<Task | ErrorResponse>) => {
      try {
        const taskId = request.params.id;

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
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "Task not found" });
        }

        reply.status(HTTP_STATUS.OK).send(updatedTask);
      } catch (error) {
        app.log.error(error);
        reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to reset task" });
      }
    }
  );

  app.patch(
    "/:id/:status",
    async (request: FastifyRequest<{ Params: TaskStatusParams }>, reply: FastifyReply<Task | ErrorResponse>) => {
      try {
        const { id, status } = request.params;
        
        if (!isTaskStatus(status)) {
          return reply
            .status(HTTP_STATUS.BAD_REQUEST)
            .send({ message: "Invalid task status" });
        }

        const updatedTask = await tasksService.updateTask(id, { status });

        if (!updatedTask) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send({ message: "Task not found" });
        }

        reply.status(HTTP_STATUS.OK).send(updatedTask);
      } catch (error) {
        app.log.error(error);
        reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to update task" });
      }
    }
  );

  app.patch("/:id/", async (request: UpdateTaskRequest, reply: FastifyReply<Task | ErrorResponse>) => {
    try {
      const { id } = request.params;
      const { id: _ignoredId, ...body } = request.body ?? {};
      const updatedTask = await tasksService.updateTask(id, body);

      if (!updatedTask) {
        return reply
          .status(HTTP_STATUS.NOT_FOUND)
          .send({ message: "Task not found" });
      }

      reply.status(HTTP_STATUS.OK).send(updatedTask);
    } catch (error) {
      app.log.error(error);
      reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to update task" });
    }
  });

  app.delete("/:id", async (request: FastifyRequest<{ Params: TaskParams }>, reply: FastifyReply<Task | ErrorResponse>) => {
    try {
      const deletedTask = await tasksService.deleteTask(request.params.id);

      if (!deletedTask) {
        return reply
          .status(HTTP_STATUS.NOT_FOUND)
          .send({ message: "Task not found" });
      }

      reply.status(HTTP_STATUS.OK).send(deletedTask);
    } catch (error) {
      app.log.error(error);
      reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ message: "Failed to delete task" });
    }
  });
}

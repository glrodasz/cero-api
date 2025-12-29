import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { HTTP_STATUS } from "../common/constants";
import type { Task, TaskStatus } from "./Task";
import { tasksService } from "./tasks.service";

type ErrorResponse = { message: string };

type TaskParams = { id: Task["id"] };

type TaskStatusParams = TaskParams & { status: TaskStatus };

type UpdateTaskRequest = FastifyRequest<{ Params: TaskParams; Body: Partial<Task> }>;

type CreateTaskRequest = FastifyRequest<{ Body: Omit<Task, "id"> }>;

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

const sendError = (reply: FastifyReply, statusCode: number, message: string) =>
  reply.status(statusCode).send({ message });

export default async function tasksRouter(app: FastifyInstance) {
  app.get("/", async (_request, reply: FastifyReply) => {
    try {
      const tasks = await tasksService.getTasks();
      reply.status(HTTP_STATUS.OK).send(tasks);
    } catch (error) {
      app.log.error(error);
      sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch tasks");
    }
  });

  app.get("/:id", async (request: FastifyRequest<{ Params: TaskParams }>, reply) => {
    try {
      const task = await tasksService.getTask(request.params.id);

      if (task == null) {
        return sendError(reply, HTTP_STATUS.NOT_FOUND, "Task not found");
      }

      reply.status(HTTP_STATUS.OK).send(task);
    } catch (error) {
      app.log.error(error);
      sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch task");
    }
  });

  app.post("/", async (request: CreateTaskRequest, reply) => {
    try {
      if (!isCreateTaskBody(request.body)) {
        return sendError(reply, HTTP_STATUS.BAD_REQUEST, "Invalid task payload");
      }

      const result = await tasksService.createTask(request.body);
      reply.status(HTTP_STATUS.CREATED).send(result);
    } catch (error) {
      app.log.error(error);
      sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create task");
    }
  });

  app.patch(
    "/:id/:status",
    async (request: FastifyRequest<{ Params: TaskStatusParams }>, reply) => {
      try {
        const { id, status } = request.params;
        if (!isTaskStatus(status)) {
          return sendError(reply, HTTP_STATUS.BAD_REQUEST, "Invalid task status");
        }

        const updatedTask = await tasksService.updateTask(id, { status });

        if (!updatedTask) {
          return sendError(reply, HTTP_STATUS.NOT_FOUND, "Task not found");
        }

        reply.status(HTTP_STATUS.OK).send(updatedTask);
      } catch (error) {
        app.log.error(error);
        sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update task");
      }
    }
  );

  app.patch("/:id", async (request: UpdateTaskRequest, reply) => {
    try {
      const { id } = request.params;
      const { id: _ignoredId, ...body } = request.body ?? {};
      const updatedTask = await tasksService.updateTask(id, body);

      if (!updatedTask) {
        return sendError(reply, HTTP_STATUS.NOT_FOUND, "Task not found");
      }

      reply.status(HTTP_STATUS.OK).send(updatedTask);
    } catch (error) {
      app.log.error(error);
      sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update task");
    }
  });

  app.delete("/:id", async (request: FastifyRequest<{ Params: TaskParams }>, reply) => {
    try {
      const deletedTask = await tasksService.deleteTask(request.params.id);

      if (!deletedTask) {
        return sendError(reply, HTTP_STATUS.NOT_FOUND, "Task not found");
      }

      reply.status(HTTP_STATUS.OK).send(deletedTask);
    } catch (error) {
      app.log.error(error);
      sendError(reply, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete task");
    }
  });
}

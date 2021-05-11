import { RouteHandlerMethod, RouteOptions } from "fastify";
import * as taskController from "../controllers/tasks";
import createTaskBodySchema from "../schemas/createTaskBodySchema.json";

const createTaskRoute: RouteOptions = {
  method: "POST",
  url: "/tasks",
  handler: taskController.createTask as RouteHandlerMethod,
  schema: { body: createTaskBodySchema },
};

const readTasksRoute: RouteOptions = {
  method: "GET",
  url: "/tasks",
  handler: taskController.readTasks as RouteHandlerMethod,
};

const tasksRoutes = [createTaskRoute, readTasksRoute];

export default tasksRoutes;

import { RouteHandlerMethod, RouteOptions } from "fastify";
import * as taskController from "../controllers/tasks";
import createTaskBodySchema from "../schemas/createTaskBodySchema.json";

const createTaskRoute: RouteOptions = {
  method: "POST",
  url: "/tasks",
  handler: taskController.createTask as RouteHandlerMethod,
  schema: { body: createTaskBodySchema },
};

const getTasksRoute: RouteOptions = {
  method: "GET",
  url: "/tasks",
  handler: taskController.getTasks as RouteHandlerMethod,
};

const updateTaskRoute: RouteOptions = {
  method: "PUT",
  url: "/tasks/:taskId",
  handler: taskController.updateTask as RouteHandlerMethod,
};

const deleteTaskRoute: RouteOptions = {
  method: "DELETE",
  url: "/tasks/:taskId",
  handler: taskController.deleteTask as RouteHandlerMethod,
};

const tasksRoutes = [
  createTaskRoute,
  getTasksRoute,
  updateTaskRoute,
  deleteTaskRoute,
];

export default tasksRoutes;

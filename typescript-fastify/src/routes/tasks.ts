import { RouteHandlerMethod, RouteOptions } from 'fastify'
import * as taskController from '../controllers/tasks'
import createTaskBodySchema from '../schemas/createTaskBodySchema.json'
import updateTaskBodySchema from '../schemas/updateTaskBodySchema.json'
import updateTaskParamsSchema from '../schemas/updateTaskParamsSchema.json'
import deleteTaskParamsSchema from '../schemas/deleteTaskParamsSchema.json'

const createTaskRoute: RouteOptions = {
  method: 'POST',
  url: '/tasks',
  handler: taskController.createTask as RouteHandlerMethod,
  schema: { body: createTaskBodySchema },
}

const getTasksRoute: RouteOptions = {
  method: 'GET',
  url: '/tasks',
  handler: taskController.getTasks as RouteHandlerMethod,
}

const updateTaskRoute: RouteOptions = {
  method: 'PUT',
  url: '/tasks/:id',
  handler: taskController.updateTask as RouteHandlerMethod,
  schema: { body: updateTaskBodySchema, params: updateTaskParamsSchema },
}

const deleteTaskRoute: RouteOptions = {
  method: 'DELETE',
  url: '/tasks/:id',
  handler: taskController.deleteTask as RouteHandlerMethod,
  schema: { params: deleteTaskParamsSchema },
}

const tasksRoutes = [
  createTaskRoute,
  getTasksRoute,
  updateTaskRoute,
  deleteTaskRoute,
]

export default tasksRoutes

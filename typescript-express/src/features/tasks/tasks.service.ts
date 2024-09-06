import { Task } from "./Task";

export const tasksService = {
  getTasks: (): Task[] => {
    return [] as Task[];
  },
  getTask: (id: string): Task => ({} as Task),
  deleteTask: (id: string): Task => ({} as Task),
  createTask: (body: Omit<Task, "id">): Task => ({} as Task),
  updateTask: (id: string, body: Partial<Task>): Task => ({} as Task),
};

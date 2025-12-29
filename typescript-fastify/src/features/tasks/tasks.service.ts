import {
  Schema,
  model,
  models,
  isValidObjectId,
  type Document,
  type Model,
} from "mongoose";
import type { Task } from "./Task";

type TaskAttributes = Omit<Task, "id">;

interface TaskDocument extends Document, TaskAttributes {
  id: string;
}

const taskSchema = new Schema<TaskDocument>({
  description: { type: String, required: true },
  priority: { type: Number, required: true },
  status: { type: String, enum: ["complete", "reset"], required: true },
  focusSessionId: { type: String, required: true },
});

const TaskModel: Model<TaskDocument> =
  models.Task ?? model<TaskDocument>("Task", taskSchema);

const toTask = (task: TaskDocument): Task => ({
  id: task.id,
  description: task.description,
  priority: task.priority,
  status: task.status,
  focusSessionId: task.focusSessionId,
});

export const tasksService = {
  getTasks: async (): Promise<Task[]> => {
    const tasks = await TaskModel.find().exec();
    return tasks.map(toTask);
  },
  getTask: async (id: string): Promise<Task | null> => {
    if (!isValidObjectId(id)) {
      return null;
    }

    const task = await TaskModel.findById(id).exec();
    return task ? toTask(task) : null;
  },
  deleteTask: async (id: string): Promise<Task | null> => {
    if (!isValidObjectId(id)) {
      return null;
    }

    const deletedTask = await TaskModel.findByIdAndDelete(id).exec();
    return deletedTask ? toTask(deletedTask) : null;
  },
  createTask: async (body: TaskAttributes): Promise<Task> => {
    const createdTask = await TaskModel.create(body);
    return toTask(createdTask);
  },
  updateTask: async (
    id: string,
    body: Partial<TaskAttributes>
  ): Promise<Task | null> => {
    if (!isValidObjectId(id)) {
      return null;
    }

    const updatedTask = await TaskModel.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).exec();

    return updatedTask ? toTask(updatedTask) : null;
  },
};

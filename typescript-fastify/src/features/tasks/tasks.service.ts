import mongoose, {
  Schema,
  model,
  isValidObjectId,
  type Document,
  type Model,
} from "mongoose";
import type { Task, TaskStatus } from "./Task.js";
import type { FocusSession } from "../focusSessions/FocusSession.js";

type TaskAttributes = Omit<Task, "id">;

interface TaskDocument extends Document, TaskAttributes {
  id: string;
}

const taskSchema = new Schema<TaskDocument>({
  description: { type: String, required: true },
  priority: { type: Number, required: true },
  status: { type: String, enum: ["in-progress", "pending", "completed"], required: true },
  focusSessionId: { type: String, required: false, default: null },
});

const TaskModel: Model<TaskDocument> =
  mongoose.models.Task ?? model<TaskDocument>("Task", taskSchema);

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
  getTask: async (id: Task["id"]): Promise<Task | null> => {
    if (!isValidObjectId(id)) {
      return null;
    }

    const task = await TaskModel.findById(id).exec();
    return task ? toTask(task) : null;
  },
  getTasksByStatus: async (status: TaskStatus): Promise<Task[]> => {
    const tasks = await TaskModel.find({ status }).exec();
    return tasks.map(toTask);
  },
  getTasksByFocusSessionId: async (focusSessionId: FocusSession["id"]): Promise<Task[]> => {
    const tasks = await TaskModel.find({ focusSessionId })
      .sort({ priority: 1 })
      .exec();
    return tasks.map(toTask);
  },
  getTasksByStatusSorted: async (status: TaskStatus): Promise<Task[]> => {
    const tasks = await TaskModel.find({ status })
      .sort({ priority: 1 })
      .exec();
    return tasks.map(toTask);
  },
  getTasksByStatuses: async (statuses: TaskStatus[]): Promise<Task[]> => {
    const tasks = await TaskModel.find({ status: { $in: statuses } })
      .sort({ priority: 1 })
      .exec();
    return tasks.map(toTask);
  },
  getTasksByFocusSessionIdAndStatuses: async (
    focusSessionId: FocusSession["id"],
    statuses: TaskStatus[]
  ): Promise<Task[]> => {
    const tasks = await TaskModel.find({
      focusSessionId,
      status: { $in: statuses },
    })
      .sort({ priority: 1 })
      .exec();
    return tasks.map(toTask);
  },
  updateTasksFocusSessionId: async (
    taskIds: Task["id"][],
    focusSessionId: FocusSession["id"]
  ): Promise<void> => {
    const validIds = taskIds.filter((id) => isValidObjectId(id));
    if (validIds.length > 0) {
      await TaskModel.updateMany(
        { _id: { $in: validIds } },
        { $set: { focusSessionId } }
      ).exec();
    }
  },
  updateTasksPriorities: async (
    tasks: Array<{ id: Task["id"]; priority: number }>
  ): Promise<void> => {
    const updates = tasks
      .filter((task) => isValidObjectId(task.id))
      .map((task) =>
        TaskModel.updateOne(
          { _id: task.id },
          { $set: { priority: task.priority } }
        ).exec()
      );

    await Promise.all(updates);
  },
  deleteTask: async (id: Task["id"]): Promise<Task | null> => {
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
    id: Task["id"],
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

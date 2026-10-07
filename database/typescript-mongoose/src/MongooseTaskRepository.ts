import type { NewTask, Task, TaskFilter, TaskRepository, TaskStatus } from "@cero/core";
import { isObjectIdOrHexString, type Connection, type Model } from "mongoose";
import { taskSchema, type TaskDocument } from "./schemas.ts";

const toTask = (document: TaskDocument): Task => ({
  id: document._id.toHexString(),
  description: document.description,
  priority: document.priority,
  status: document.status,
  focusSessionId: document.focusSessionId,
});

/** ObjectIds grow with time, so sorting by `_id` is sorting by creation. */
const BY_PRIORITY_THEN_CREATION = { priority: 1, _id: 1 } as const;

export class MongooseTaskRepository implements TaskRepository {
  #model: Model<TaskDocument>;

  constructor(connection: Connection) {
    this.#model = connection.models.Task ?? connection.model<TaskDocument>("Task", taskSchema);
  }

  async findById(id: string): Promise<Task | null> {
    if (!isObjectIdOrHexString(id)) {
      return null;
    }

    const document = await this.#model.findById(id).lean<TaskDocument>().exec();
    return document ? toTask(document) : null;
  }

  async findMany({ ids, statuses, focusSessionId }: TaskFilter): Promise<Task[]> {
    const query = this.#model.find();
    if (ids !== undefined) {
      query.where("_id").in(ids.filter((id) => isObjectIdOrHexString(id)));
    }
    if (statuses !== undefined) {
      query.where("status").in([...statuses]);
    }
    if (focusSessionId !== undefined) {
      query.where("focusSessionId").equals(focusSessionId);
    }

    const documents = await query.sort(BY_PRIORITY_THEN_CREATION).lean<TaskDocument[]>().exec();
    return documents.map(toTask);
  }

  async countByStatus(status: TaskStatus): Promise<number> {
    return this.#model.countDocuments({ status }).exec();
  }

  async create(task: NewTask): Promise<Task> {
    const document = await this.#model.create(task);
    return toTask(document.toObject());
  }

  async save({ id, ...fields }: Task): Promise<void> {
    if (isObjectIdOrHexString(id)) {
      await this.#model.updateOne({ _id: id }, { $set: fields }).exec();
    }
  }

  async delete(id: string): Promise<void> {
    if (isObjectIdOrHexString(id)) {
      await this.#model.deleteOne({ _id: id }).exec();
    }
  }

  async assignFocusSession(taskIds: readonly string[], focusSessionId: string | null): Promise<void> {
    const ids = taskIds.filter((id) => isObjectIdOrHexString(id));
    if (ids.length > 0) {
      await this.#model.updateMany({ _id: { $in: ids } }, { $set: { focusSessionId } }).exec();
    }
  }
}

import type { NewTask, Task, TaskFilter, TaskRepository, TaskStatus } from "@cero/core";
import type { CollectionReference, DocumentSnapshot, Firestore, Query, Timestamp } from "firebase-admin/firestore";
import { taskConverter, type TaskDocument } from "./converters.ts";
import { isDocumentId, isNotFound } from "./documentIds.ts";

type TaskSnapshot = DocumentSnapshot<Task, TaskDocument>;

const compareTimestamps = (a: Timestamp, b: Timestamp) => a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;

/** The order of `orderBy("priority").orderBy("createdAt")`, for tasks fetched by id. */
const byPriorityThenCreation = (a: TaskSnapshot, b: TaskSnapshot) =>
  a.get("priority") - b.get("priority") || compareTimestamps(a.get("createdAt"), b.get("createdAt"));

export class FirestoreTaskRepository implements TaskRepository {
  #db: Firestore;
  #tasks: CollectionReference<Task, TaskDocument>;

  constructor(db: Firestore) {
    this.#db = db;
    this.#tasks = db.collection("tasks").withConverter(taskConverter);
  }

  async findById(id: string): Promise<Task | null> {
    if (!isDocumentId(id)) {
      return null;
    }

    const snapshot = await this.#tasks.doc(id).get();
    return snapshot.data() ?? null;
  }

  async findMany({ ids, statuses, focusSessionId }: TaskFilter): Promise<Task[]> {
    if (ids !== undefined) {
      const tasks = await this.#findByIds(ids);
      return tasks.filter(
        (task) =>
          (statuses === undefined || statuses.includes(task.status)) &&
          (focusSessionId === undefined || task.focusSessionId === focusSessionId),
      );
    }
    if (statuses?.length === 0) {
      return []; // Firestore refuses an empty `in`, and nothing could match it anyway.
    }

    let query: Query<Task, TaskDocument> = this.#tasks;
    if (statuses !== undefined) {
      query = query.where("status", "in", statuses);
    }
    if (focusSessionId !== undefined) {
      query = query.where("focusSessionId", "==", focusSessionId);
    }

    const snapshot = await query.orderBy("priority").orderBy("createdAt").get();
    return snapshot.docs.map((document) => document.data());
  }

  async countByStatus(status: TaskStatus): Promise<number> {
    // An aggregation query: the server counts, no document is downloaded.
    const snapshot = await this.#tasks.where("status", "==", status).count().get();
    return snapshot.data().count;
  }

  async create(newTask: NewTask): Promise<Task> {
    // Firestore makes up the id on the client, so the task is known before it is written.
    const reference = this.#tasks.doc();
    const task: Task = { id: reference.id, ...newTask };
    await reference.create(task);
    return task;
  }

  async save({ id, ...fields }: Task): Promise<void> {
    if (!isDocumentId(id)) {
      return;
    }

    try {
      await this.#tasks.doc(id).update(fields);
    } catch (error) {
      // Saving a task that does not exist is a no-op, as the port asks.
      if (!isNotFound(error)) throw error;
    }
  }

  async delete(id: string): Promise<void> {
    if (isDocumentId(id)) {
      await this.#tasks.doc(id).delete();
    }
  }

  async assignFocusSession(taskIds: readonly string[], focusSessionId: string | null): Promise<void> {
    const references = taskIds.filter(isDocumentId).map((id) => this.#tasks.doc(id));
    if (references.length === 0) {
      return;
    }

    // A transaction reads which tasks exist and updates only those, all at once:
    // a batched `update` of an unknown id would fail the whole batch.
    await this.#db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(...references);
      for (const snapshot of snapshots.filter((candidate) => candidate.exists)) {
        transaction.update(snapshot.ref, { focusSessionId });
      }
    });
  }

  /** One round trip for every id, sorted like the queries: Firestore's `in` stops at 30 values. */
  async #findByIds(ids: readonly string[]): Promise<Task[]> {
    const references = ids.filter(isDocumentId).map((id) => this.#tasks.doc(id));
    if (references.length === 0) {
      return [];
    }

    // The references carry the converter; only the typings of `Firestore#getAll` forget it.
    const snapshots = (await this.#db.getAll(...references)) as TaskSnapshot[];
    return snapshots
      .filter((snapshot) => snapshot.exists)
      .sort(byPriorityThenCreation)
      .flatMap((snapshot) => snapshot.data() ?? []);
  }
}

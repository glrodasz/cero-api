import type { NewTask, Task, TaskFilter, TaskRepository, TaskStatus } from "@cero/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";
import { toTask, toTaskRow } from "./rows.ts";
import { isUuid } from "./uuid.ts";

/**
 * Tasks through PostgREST. Every query ends in `throwOnError()`: supabase-js
 * returns `{ data, error }` by default, and a storage failure must reach the
 * transport as an exception (500), never as an empty result.
 */
export class SupabaseTaskRepository implements TaskRepository {
  #client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.#client = client;
  }

  async findById(id: string): Promise<Task | null> {
    if (!isUuid(id)) {
      return null;
    }

    const { data } = await this.#tasks().select().eq("id", id).maybeSingle().throwOnError();
    return data && toTask(data);
  }

  async findMany({ ids, statuses, focusSessionId }: TaskFilter): Promise<Task[]> {
    if (focusSessionId !== undefined && !isUuid(focusSessionId)) {
      return [];
    }

    let query = this.#tasks().select();
    if (ids !== undefined) {
      query = query.in("id", ids.filter(isUuid));
    }
    if (statuses !== undefined) {
      query = query.in("status", statuses);
    }
    if (focusSessionId !== undefined) {
      query = query.eq("focus_session_id", focusSessionId);
    }

    const { data } = await query.order("priority").order("created_at").throwOnError();
    return data.map(toTask);
  }

  async countByStatus(status: TaskStatus): Promise<number> {
    // `head: true` sends a HEAD request: Postgres counts, no rows travel back.
    const { count } = await this.#tasks().select("*", { count: "exact", head: true }).eq("status", status)
      .throwOnError();
    return count ?? 0;
  }

  async create(task: NewTask): Promise<Task> {
    const { data } = await this.#tasks().insert(toTaskRow(task)).select().single().throwOnError();
    return toTask(data);
  }

  async save({ id, ...task }: Task): Promise<void> {
    if (isUuid(id)) {
      await this.#tasks().update(toTaskRow(task)).eq("id", id).throwOnError();
    }
  }

  async delete(id: string): Promise<void> {
    if (isUuid(id)) {
      await this.#tasks().delete().eq("id", id).throwOnError();
    }
  }

  async assignFocusSession(taskIds: readonly string[], focusSessionId: string | null): Promise<void> {
    const ids = taskIds.filter(isUuid);
    if (ids.length > 0) {
      await this.#tasks().update({ focus_session_id: focusSessionId }).in("id", ids).throwOnError();
    }
  }

  #tasks() {
    return this.#client.from("tasks");
  }
}

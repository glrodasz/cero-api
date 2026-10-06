import {
  CURRENT_SESSION_STATUSES,
  type FocusSession,
  type FocusSessionRepository,
  type NewFocusSession,
} from "@cero/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";
import { toFocusSession, toFocusSessionRow } from "./rows.ts";
import { isUuid } from "./uuid.ts";

/** Focus sessions through PostgREST; pauses live in a jsonb column of their session. */
export class SupabaseFocusSessionRepository implements FocusSessionRepository {
  #client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.#client = client;
  }

  async findAll(): Promise<FocusSession[]> {
    const { data } = await this.#sessions().select().order("created_at").throwOnError();
    return data.map(toFocusSession);
  }

  async findById(id: string): Promise<FocusSession | null> {
    if (!isUuid(id)) {
      return null;
    }

    const { data } = await this.#sessions().select().eq("id", id).maybeSingle().throwOnError();
    return data && toFocusSession(data);
  }

  async findCurrent(): Promise<FocusSession | null> {
    const { data } = await this.#sessions()
      .select()
      .in("status", CURRENT_SESSION_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .throwOnError();
    return data && toFocusSession(data);
  }

  async create(session: NewFocusSession): Promise<FocusSession> {
    const { data } = await this.#sessions().insert(toFocusSessionRow(session)).select().single().throwOnError();
    return toFocusSession(data);
  }

  async save({ id, ...session }: FocusSession): Promise<void> {
    if (isUuid(id)) {
      await this.#sessions().update(toFocusSessionRow(session)).eq("id", id).throwOnError();
    }
  }

  #sessions() {
    return this.#client.from("focus_sessions");
  }
}

import type { Repositories } from "@cero/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";
import { SupabaseFocusSessionRepository } from "./SupabaseFocusSessionRepository.ts";
import { SupabaseTaskRepository } from "./SupabaseTaskRepository.ts";

export type { Database } from "./database.types.ts";
export { SupabaseFocusSessionRepository } from "./SupabaseFocusSessionRepository.ts";
export { SupabaseTaskRepository } from "./SupabaseTaskRepository.ts";

/**
 * A supabase-js client for trusted server code. The service role key bypasses
 * Row Level Security, so it must never reach a browser. There is no signed-in
 * user on the server, hence no session to persist or refresh.
 */
export const createServiceRoleClient = (url: string, serviceRoleKey: string): SupabaseClient<Database> =>
  createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const createSupabaseRepositories = (client: SupabaseClient<Database>): Repositories => ({
  tasks: new SupabaseTaskRepository(client),
  focusSessions: new SupabaseFocusSessionRepository(client),
});

import { testRepositoryContract } from "@cero/core/testing";
import { after, describe } from "node:test";
import { createServiceRoleClient, createSupabaseRepositories } from "../src/mod.ts";

// Runs against the local Supabase stack: `deno task supabase start` in typescript-supabase/.
// Like `supabase db reset`, it empties the tables, so local data does not survive a test run.

/** The service role key of every local Supabase stack: signed with the public development secret. */
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const client = createServiceRoleClient(
  Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? LOCAL_SERVICE_ROLE_KEY,
);

const emptyTables = async () => {
  // PostgREST refuses a DELETE without a filter, so the filter matches every row.
  await client.from("tasks").delete().not("id", "is", null).throwOnError();
  await client.from("focus_sessions").delete().not("id", "is", null).throwOnError();
};

describe("Supabase adapter", () => {
  after(emptyTables);

  testRepositoryContract("Supabase", async () => {
    await emptyTables();
    return createSupabaseRepositories(client);
  });
});

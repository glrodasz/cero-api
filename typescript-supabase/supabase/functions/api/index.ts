import { createServices } from "@cero/core";
import { createServiceRoleClient, createSupabaseRepositories } from "@cero/supabase";
import { createApp } from "./app.ts";
import { config } from "./config.ts";

// Composition root: the Edge Runtime boots this module once per worker and
// hands every request of the worker's lifetime to `app.fetch`.

const client = createServiceRoleClient(config.supabaseUrl, config.serviceRoleKey);
const app = createApp(createServices(createSupabaseRepositories(client)));

Deno.serve(app.fetch);

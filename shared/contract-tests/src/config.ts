import type { ApiClient } from "./client/ApiClient.ts";
import { GraphqlClient } from "./client/GraphqlClient.ts";
import { RestClient } from "./client/RestClient.ts";

/** Where the implementation under test listens, e.g. http://127.0.0.1:3000 or http://127.0.0.1:3003/graphql. */
export const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

export const API_PROTOCOL: "rest" | "graphql" = process.env.API_PROTOCOL === "graphql" ? "graphql" : "rest";

/** A well-formed UUID that no storage will ever have assigned. */
export const MISSING_ID = "00000000-0000-4000-8000-000000000000";

export const createClient = (): ApiClient => (API_PROTOCOL === "graphql" ? new GraphqlClient(API_URL) : new RestClient(API_URL));

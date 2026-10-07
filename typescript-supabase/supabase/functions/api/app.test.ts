import { createServices } from "@cero/core";
import { createInMemoryRepositories } from "@cero/core/in-memory";
import { assertEquals } from "@std/assert";
import { createApp } from "./app.ts";

// The behaviour itself is covered by the core tests and the shared contract
// suite. These tests cover what is Hono's job: routing, validation, errors.
// `app.request` sends a Request straight into the app, without a server.

const app = (repositories = createInMemoryRepositories()) => createApp(createServices(repositories));

const json = (body: unknown): RequestInit => ({
  headers: { "content-type": "application/json" },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

Deno.test("routes PATCH /tasks/:id/complete before PATCH /tasks/:id/:status", async () => {
  const server = app();
  const { id } = await (await server.request("/api/tasks", { method: "POST", ...json({ description: "routing" }) }))
    .json();

  const response = await server.request(`/api/tasks/${id}/complete`, { method: "PATCH" });

  assertEquals(response.status, 200);
  assertEquals((await response.json()).status, "completed");
});

Deno.test("refuses bodies that do not match the schema", async () => {
  const response = await app().request("/api/tasks", { method: "POST", ...json({ description: 42 }) });

  assertEquals(response.status, 400);
  assertEquals(typeof (await response.json()).message, "string");
});

Deno.test("drops unknown fields from bodies", async () => {
  const server = app();
  const task = await (await server.request("/api/tasks", { method: "POST", ...json({ description: "keeps its id" }) }))
    .json();

  const response = await server.request(`/api/tasks/${task.id}`, {
    method: "PATCH",
    ...json({ id: "another-id", priority: 3 }),
  });

  assertEquals(await response.json(), { ...task, priority: 3 });
});

Deno.test("treats a request without a JSON body as an empty body", async () => {
  const response = await app().request("/api/focus-sessions", { method: "POST" });

  assertEquals(response.status, 201);
});

Deno.test("answers 400 for malformed JSON", async () => {
  const response = await app().request("/api/tasks", { method: "POST", ...json("{ nope") });

  assertEquals(response.status, 400);
  assertEquals(typeof (await response.json()).message, "string");
});

Deno.test("answers 404 for unknown routes", async () => {
  const response = await app().request("/api/nowhere");

  assertEquals(response.status, 404);
  assertEquals(await response.json(), { message: "Not found" });
});

Deno.test("hides the details of unexpected errors", async () => {
  const broken = createInMemoryRepositories();
  broken.focusSessions.findCurrent = () => Promise.reject(new Error("connection string with a password"));

  const response = await app(broken).request("/api/tasks");

  assertEquals(response.status, 500);
  assertEquals(await response.json(), { message: "Internal server error" });
});

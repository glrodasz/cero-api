import { createServices } from "@cero/core";
import { createInMemoryRepositories } from "@cero/core/in-memory";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildApp } from "../src/app.ts";

// The behaviour itself is covered by the core tests and the shared contract
// suite. These tests cover what is Fastify's job: routing, schemas, errors.
// `inject` sends fake requests straight into the app, without opening a port.

const app = (repositories = createInMemoryRepositories()) => buildApp(createServices(repositories));

describe("Fastify app", () => {
  it("routes PATCH /tasks/:id/complete before PATCH /tasks/:id/:status", async () => {
    const server = app();
    const { id } = (await server.inject({ method: "POST", url: "/tasks", payload: { description: "routing" } })).json();

    const response = await server.inject({ method: "PATCH", url: `/tasks/${id}/complete` });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, "completed");
  });

  it("refuses bodies that do not match the schema, without coercing types", async () => {
    const response = await app().inject({ method: "POST", url: "/tasks", payload: { description: 42 } });

    assert.equal(response.statusCode, 400);
    assert.equal(typeof response.json().message, "string");
  });

  it("answers 404 for unknown routes", async () => {
    const response = await app().inject({ method: "GET", url: "/nowhere" });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { message: "Not found" });
  });

  it("hides the details of unexpected errors", async () => {
    const broken = createInMemoryRepositories();
    broken.focusSessions.findCurrent = async () => {
      throw new Error("connection string with a password");
    };

    const response = await app(broken).inject({ method: "GET", url: "/tasks" });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.json(), { message: "Internal server error" });
  });
});

import { createServices, type Repositories } from "@cero/core";
import { createInMemoryRepositories } from "@cero/core/in-memory";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.ts";

// The behaviour itself is covered by the core tests and the shared contract
// suite. These tests cover what is Express's job: routing, parsing, errors.

const serve = async (repositories: Repositories) => {
  const server = createApp(createServices(repositories)).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: (path: string) => `http://127.0.0.1:${port}${path}` };
};

describe("Express app", () => {
  let app: Awaited<ReturnType<typeof serve>>;

  before(async () => {
    app = await serve(createInMemoryRepositories());
  });
  after(() => app.server.close());

  it("routes PATCH /tasks/:id/complete before PATCH /tasks/:id/:status", async () => {
    const created = await fetch(app.url("/tasks"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "routing" }),
    });
    const { id } = (await created.json()) as { id: string };

    const response = await fetch(app.url(`/tasks/${id}/complete`), { method: "PATCH" });

    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as { status: string }).status, "completed");
  });

  it("answers 400 for malformed JSON", async () => {
    const response = await fetch(app.url("/tasks"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ nope",
    });

    assert.equal(response.status, 400);
  });

  it("answers 404 for unknown routes", async () => {
    const response = await fetch(app.url("/nowhere"));

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { message: "Not found" });
  });

  it("hides the details of unexpected errors", async () => {
    const broken = createInMemoryRepositories();
    broken.focusSessions.findCurrent = async () => {
      throw new Error("connection string with a password");
    };
    const brokenApp = await serve(broken);

    const response = await fetch(brokenApp.url("/tasks"));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { message: "Internal server error" });
    brokenApp.server.close();
  });
});

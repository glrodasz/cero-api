import { createInMemoryRepositories } from "@cero/core/in-memory";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { AppModule } from "../src/app.module.ts";
import { FOCUS_SESSION_REPOSITORY } from "../src/storage/storage.tokens.ts";

// The behaviour itself is covered by the core tests and the shared contract
// suite. These tests cover what is Nest's job: routing, validation, errors.

const start = async (configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder) => {
  const moduleRef = await configure(Test.createTestingModule({ imports: [AppModule.forRoot({ storage: "memory" })] })).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  return app.init();
};

describe("Nest app", () => {
  let app: INestApplication;

  before(async () => {
    app = await start();
  });
  after(() => app.close());

  const createTask = async (description: string) =>
    (await request(app.getHttpServer()).post("/tasks").send({ description })).body as { id: string };

  it("routes PATCH /tasks/:id/complete before PATCH /tasks/:id/:status", async () => {
    const { id } = await createTask("routing");

    const response = await request(app.getHttpServer()).patch(`/tasks/${id}/complete`);

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "completed");
  });

  it("refuses invalid bodies with every ValidationPipe message in one string", async () => {
    const { id } = await createTask("typed");

    const response = await request(app.getHttpServer()).patch(`/tasks/${id}`).send({ priority: "high", status: "done" });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /priority must be an integer number; status must be one of/);
  });

  it("refuses null for a field that can only be omitted", async () => {
    const { id } = await createTask("not null");

    const response = await request(app.getHttpServer()).patch(`/tasks/${id}`).send({ description: null });

    assert.equal(response.status, 400);
  });

  it("drops properties the DTO does not declare", async () => {
    const task = await createTask("keeps its id");

    const response = await request(app.getHttpServer()).patch(`/tasks/${task.id}`).send({ id: "another-id", priority: 3 });

    assert.deepEqual(response.body, { ...task, priority: 3 });
  });

  it("answers 400 for malformed JSON", async () => {
    const response = await request(app.getHttpServer()).post("/tasks").set("content-type", "application/json").send("{ nope");

    assert.equal(response.status, 400);
    assert.equal(typeof response.body.message, "string");
  });

  it("answers 404 for unknown routes", async () => {
    const response = await request(app.getHttpServer()).get("/nowhere");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { message: "Not found" });
  });

  it("hides the details of unexpected errors", async () => {
    const broken = createInMemoryRepositories().focusSessions;
    broken.findCurrent = async () => {
      throw new Error("connection string with a password");
    };
    const brokenApp = await start((builder) => builder.overrideProvider(FOCUS_SESSION_REPOSITORY).useValue(broken));

    const response = await request(brokenApp.getHttpServer()).get("/tasks");

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { message: "Internal server error" });
    await brokenApp.close();
  });
});

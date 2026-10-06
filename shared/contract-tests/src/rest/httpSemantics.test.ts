import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { sendRequest } from "../client/RestClient.ts";
import { API_PROTOCOL, API_URL, MISSING_ID } from "../config.ts";
import { createTask, deleteCreatedTasks, finishEveryCurrentSession } from "../scenarios/helpers.ts";

// What the shared scenarios cannot see through ApiClient: exact status codes,
// canonical messages, and how malformed requests are refused.

const request = (method: string, path: string, body?: unknown) => sendRequest(API_URL, method, path, body);

const assertAnswers = async (
  response: Promise<{ status: number; body: unknown }>,
  expectedStatus: number,
  expectedMessage?: string,
) => {
  const { status, body } = await response;
  assert.equal(status, expectedStatus);

  const { message } = body as { message?: unknown };
  assert.equal(typeof message, "string", "errors have the shape { message: string }");
  if (expectedMessage !== undefined) assert.equal(message, expectedMessage);
};

describe("REST semantics", { skip: API_PROTOCOL !== "rest" && "REST only" }, () => {
  beforeEach(finishEveryCurrentSession);
  after(deleteCreatedTasks);

  describe("success codes", () => {
    it("answers 201 when creating", async () => {
      const task = await request("POST", "/tasks", { description: "contract: 201" });
      assert.equal(task.status, 201);
      await request("DELETE", `/tasks/${(task.body as { id: string }).id}`);

      const session = await request("POST", "/focus-sessions", { tasks: [(await createTask("seed")).id] });
      assert.equal(session.status, 201);
    });

    it("answers {} for the active session when there is none", async () => {
      const { status, body } = await request("GET", "/focus-sessions/active");

      assert.equal(status, 200);
      assert.deepEqual(body, {});
    });

    it("accepts a start request without a body", async () => {
      const { status } = await request("POST", "/focus-sessions");

      assert.equal(status, 201);
    });
  });

  describe("not found", () => {
    for (const [method, path, message] of [
      ["GET", `/tasks/${MISSING_ID}`, "Task not found"],
      ["GET", "/tasks/not-a-valid-id", "Task not found"],
      ["PATCH", `/tasks/${MISSING_ID}/complete`, "Task not found"],
      ["PATCH", `/tasks/${MISSING_ID}/reset`, "Task not found"],
      ["PATCH", `/tasks/${MISSING_ID}/pending`, "Task not found"],
      ["DELETE", `/tasks/${MISSING_ID}`, "Task not found"],
      ["PATCH", `/focus-sessions/${MISSING_ID}/finish`, "Focus session not found"],
      ["PATCH", `/focus-sessions/${MISSING_ID}/pause`, "Focus session not found or cannot be paused"],
      ["PATCH", `/focus-sessions/${MISSING_ID}/resume`, "Focus session not found or cannot be resumed"],
      ["PATCH", "/focus-sessions/finish", "No active focus session found"],
      ["PATCH", "/focus-sessions/pause", "No active focus session found"],
      ["PATCH", "/focus-sessions/resume", "No active focus session found"],
      ["GET", "/no-such-route", "Not found"],
    ] as const) {
      it(`${method} ${path} → 404 "${message}"`, async () => {
        await assertAnswers(request(method, path), 404, message);
      });
    }

    it("PATCH /tasks/:id with a valid body → 404 for an unknown task", async () => {
      await assertAnswers(request("PATCH", `/tasks/${MISSING_ID}`, { priority: 1 }), 404, "Task not found");
    });
  });

  describe("bad requests", () => {
    it("refuses an unknown status, even for an unknown task", async () => {
      await assertAnswers(request("PATCH", `/tasks/${MISSING_ID}/done`), 400);
    });

    it("refuses a task without a string description", async () => {
      await assertAnswers(request("POST", "/tasks", {}), 400);
      await assertAnswers(request("POST", "/tasks", { description: 42 }), 400);
    });

    it("refuses task changes of the wrong type", async () => {
      const task = await createTask("typed");

      await assertAnswers(request("PATCH", `/tasks/${task.id}`, { priority: "high" }), 400);
      await assertAnswers(request("PATCH", `/tasks/${task.id}`, { status: "done" }), 400);
      await assertAnswers(request("PATCH", `/tasks/${task.id}`, { description: null }), 400);
    });

    it("refuses a session start of the wrong shape", async () => {
      await assertAnswers(request("POST", "/focus-sessions", { tasks: "all" }), 400);
      await assertAnswers(request("POST", "/focus-sessions", { tasks: [1, 2] }), 400);
      await assertAnswers(request("POST", "/focus-sessions", { startTime: "now" }), 400);
    });

    it("refuses a pause time that is not a number", async () => {
      await request("POST", "/focus-sessions", { tasks: [(await createTask("seed")).id] });

      await assertAnswers(request("PATCH", "/focus-sessions/pause", { time: "soon" }), 400);
    });

    it("refuses malformed JSON", async () => {
      await assertAnswers(request("POST", "/tasks", "{ not json"), 400);
    });
  });

  describe("bodies", () => {
    it("ignores an id in the body of a task update", async () => {
      const task = await createTask("keeps its id");

      const { body } = await request("PATCH", `/tasks/${task.id}`, { id: MISSING_ID, priority: 3 });

      assert.deepEqual(body, { ...task, priority: 3 });
    });
  });
});

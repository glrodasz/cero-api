import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { sendGraphql } from "../client/GraphqlClient.ts";
import { API_PROTOCOL, API_URL, MISSING_ID } from "../config.ts";
import { createTask, deleteCreatedTasks, finishEveryCurrentSession } from "../scenarios/helpers.ts";

// What the shared scenarios cannot see through ApiClient: error codes and
// messages, and nullable queries.

const firstError = async (query: string, variables: Record<string, unknown> = {}) => {
  const { errors } = await sendGraphql(API_URL, query, variables);
  assert.ok(errors?.[0] !== undefined, "expected a GraphQL error");
  return errors[0];
};

describe("GraphQL semantics", { skip: API_PROTOCOL !== "graphql" && "GraphQL only" }, () => {
  beforeEach(finishEveryCurrentSession);
  after(deleteCreatedTasks);

  it("answers null for an unknown task and for no current session", async () => {
    const { data, errors } = await sendGraphql(
      API_URL,
      "query ($id: ID!) { task(id: $id) { id } currentFocusSession { id } }",
      { id: MISSING_ID },
    );

    assert.equal(errors, undefined);
    assert.deepEqual(data, { task: null, currentFocusSession: null });
  });

  for (const [mutation, message] of [
    [`completeTask(id: "${MISSING_ID}") { id }`, "Task not found"],
    [`deleteTask(id: "${MISSING_ID}") { id }`, "Task not found"],
    [`finishFocusSession(id: "${MISSING_ID}") { id }`, "Focus session not found"],
    [`pauseFocusSession(id: "${MISSING_ID}") { id }`, "Focus session not found or cannot be paused"],
    [`resumeFocusSession(id: "${MISSING_ID}") { id }`, "Focus session not found or cannot be resumed"],
    ["finishCurrentFocusSession { id }", "No active focus session found"],
  ] as const) {
    it(`${mutation.split("(")[0]?.split(" ")[0]} → NOT_FOUND "${message}"`, async () => {
      const error = await firstError(`mutation { ${mutation} }`);

      assert.equal(error.extensions?.code, "NOT_FOUND");
      assert.equal(error.message, message);
    });
  }

  it("answers BAD_USER_INPUT for a focusSessionId that matches no session", async () => {
    const task = await createTask("orphan");

    const error = await firstError("mutation ($id: ID!, $session: ID!) { updateTask(id: $id, input: { focusSessionId: $session }) { id } }", {
      id: task.id,
      session: MISSING_ID,
    });

    assert.equal(error.extensions?.code, "BAD_USER_INPUT");
  });

  it("carries timestamps beyond 32 bits", async () => {
    const { data } = await sendGraphql(API_URL, "mutation ($t: Millis) { startFocusSession(input: { startTime: $t }) { startTime } }", {
      t: 1_700_000_000_000,
    });

    assert.deepEqual(data, { startFocusSession: { startTime: 1_700_000_000_000 } });
  });
});

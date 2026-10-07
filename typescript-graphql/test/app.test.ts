import { createServices, type Repositories } from "@cero/core";
import { createInMemoryRepositories } from "@cero/core/in-memory";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApp } from "../src/app.ts";

// The behaviour itself is covered by the core tests and the shared contract
// suite. These tests cover what is GraphQL's job: the scalar, the enums,
// null versus absent, and how errors are reported. `yoga.fetch` sends
// requests straight into the server, without opening a port.

type GraphqlResult = {
  data?: Record<string, any> | null;
  errors?: { message: string; extensions?: { code?: string } }[];
};

const app = (repositories: Repositories = createInMemoryRepositories()) => {
  const yoga = createApp(createServices(repositories));
  return async (query: string, variables: Record<string, unknown> = {}): Promise<GraphqlResult> => {
    const response = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    return (await response.json()) as GraphqlResult;
  };
};

describe("GraphQL app", () => {
  it("maps the status enums both ways", async () => {
    const graphql = app();
    const { data: created } = await graphql('mutation { createTask(input: { description: "enum" }) { id status } }');

    const { data } = await graphql("mutation ($id: ID!) { changeTaskStatus(id: $id, status: COMPLETED) { status } }", {
      id: created?.createTask.id,
    });

    assert.equal(created?.createTask.status, "IN_PROGRESS");
    assert.deepEqual(data, { changeTaskStatus: { status: "COMPLETED" } });
  });

  it("carries Millis beyond 32 bits, inline and as variables, and refuses non-integers", async () => {
    const graphql = app();

    const inline = await graphql("mutation { startFocusSession(input: { startTime: 1700000000000 }) { startTime } }");
    const variable = await graphql("mutation ($time: Millis) { pauseCurrentFocusSession(time: $time) { pauses { time } } }", {
      time: 4_000_000_000,
    });
    const fractional = await graphql("mutation ($time: Millis) { pauseCurrentFocusSession(time: $time) { status } }", { time: 1.5 });

    assert.deepEqual(inline.data, { startFocusSession: { startTime: 1_700_000_000_000 } });
    assert.deepEqual(variable.data, { pauseCurrentFocusSession: { pauses: [{ time: 4_000_000_000 }] } });
    assert.match(fractional.errors?.[0]?.message ?? "", /Millis must be an integer/);
  });

  it("tells an absent focusSessionId (unchanged) from null (detached)", async () => {
    const graphql = app();
    const { data: started } = await graphql("mutation { startFocusSession { id } }");
    const { data: created } = await graphql('mutation { createTask(input: { description: "attached" }) { id } }');
    const id = created?.createTask.id;

    const absent = await graphql("mutation ($id: ID!) { updateTask(id: $id, input: { priority: 2 }) { focusSessionId } }", { id });
    const nulled = await graphql("mutation ($id: ID!) { updateTask(id: $id, input: { focusSessionId: null }) { focusSessionId } }", { id });

    assert.equal(absent.data?.updateTask.focusSessionId, started?.startFocusSession.id);
    assert.equal(nulled.data?.updateTask.focusSessionId, null);
  });

  it("refuses null for a field that can only be omitted", async () => {
    const graphql = app();
    const { data } = await graphql('mutation { createTask(input: { description: "not null" }) { id } }');

    const { errors } = await graphql("mutation ($id: ID!) { updateTask(id: $id, input: { description: null }) { id } }", {
      id: data?.createTask.id,
    });

    assert.equal(errors?.[0]?.extensions?.code, "BAD_USER_INPUT");
  });

  it("reports core refusals with their message and a code", async () => {
    const { errors } = await app()('mutation { deleteTask(id: "missing") { id } }');

    assert.equal(errors?.[0]?.message, "Task not found");
    assert.equal(errors?.[0]?.extensions?.code, "NOT_FOUND");
  });

  it("hides the details of unexpected errors", async () => {
    const broken = createInMemoryRepositories();
    broken.focusSessions.findCurrent = async () => {
      throw new Error("connection string with a password");
    };

    const { errors } = await app(broken)("{ tasks { id } }");

    assert.equal(errors?.[0]?.message, "Internal server error");
    assert.doesNotMatch(JSON.stringify(errors), /password/);
  });

  it("answers 404 for paths other than /graphql", async () => {
    const response = await createApp(createServices(createInMemoryRepositories())).fetch("http://localhost/nowhere");

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { message: "Not found" });
  });
});

import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { MISSING_ID } from "../config.ts";
import { api, createTask, deleteCreatedTasks, finishEveryCurrentSession, ids, rejectsWith } from "./helpers.ts";

describe("Tasks", () => {
  beforeEach(finishEveryCurrentSession);
  after(deleteCreatedTasks);

  describe("creating", () => {
    it("creates a task at priority 0 outside any session", async () => {
      const task = await createTask("fresh");

      assert.equal(task.priority, 0);
      assert.equal(task.focusSessionId, null);
      assert.ok(["in-progress", "pending"].includes(task.status));
      assert.deepEqual(await api.getTask(task.id), task);
    });

    it("starts tasks in progress until three are in progress, then as pending", async () => {
      const inProgress = async () => (await api.listTasks()).filter((task) => task.status === "in-progress").length;
      while ((await inProgress()) < 3) {
        await createTask("fills the in-progress slots");
      }

      const overflow = await createTask("one too many");

      assert.equal(overflow.status, "pending");
    });

    it("attaches new tasks to the current session", async () => {
      const session = await api.startFocusSession({ tasks: [(await createTask("seed")).id] });

      const task = await createTask("joins");

      assert.equal(task.focusSessionId, session.id);
    });
  });

  describe("listing", () => {
    it("lists unfinished tasks, not completed ones, when no session is current", async () => {
      const unfinished = await createTask("unfinished");
      const completed = await createTask("completed");
      await api.completeTask(completed.id);

      const listed = ids(await api.listTasks());

      assert.ok(listed.includes(unfinished.id));
      assert.ok(!listed.includes(completed.id));
    });

    it("lists only the current session's tasks while a session is current", async () => {
      const inSession = await createTask("in session");
      const outside = await createTask("outside");
      await api.startFocusSession({ tasks: [inSession.id] });

      const listed = ids(await api.listTasks());

      assert.ok(listed.includes(inSession.id));
      assert.ok(!listed.includes(outside.id));
    });

    it("sorts by priority", async () => {
      const low = await createTask("low");
      const high = await createTask("high");
      await api.updateTask(low.id, { priority: 9_001 });
      await api.updateTask(high.id, { priority: -1 });

      const listed = ids(await api.listTasks());

      assert.equal(listed[0], high.id);
      assert.equal(listed.at(-1), low.id);
    });
  });

  describe("reading", () => {
    it("answers not found for an unknown task", async () => {
      await rejectsWith(api.getTask(MISSING_ID), "not_found");
    });
  });

  describe("completing and resetting", () => {
    it("puts a completed task on top of the completed group", async () => {
      const first = await createTask("completed first");
      const second = await createTask("completed second");
      await api.completeTask(first.id);

      const completed = await api.completeTask(second.id);

      assert.deepEqual({ status: completed.status, priority: completed.priority }, { status: "completed", priority: 0 });
      assert.equal((await api.getTask(first.id)).priority, 1);
    });

    it("puts a reset task on top of the pending group", async () => {
      const first = await createTask("reset first");
      const second = await createTask("reset second");
      await api.resetTask(first.id);

      const reset = await api.resetTask(second.id);

      assert.deepEqual({ status: reset.status, priority: reset.priority }, { status: "pending", priority: 0 });
      assert.equal((await api.getTask(first.id)).priority, 1);
    });

    it("answers not found for unknown tasks", async () => {
      await rejectsWith(api.completeTask(MISSING_ID), "not_found");
      await rejectsWith(api.resetTask(MISSING_ID), "not_found");
    });
  });

  describe("changing", () => {
    it("changes only the status", async () => {
      const task = await createTask("status");
      await api.updateTask(task.id, { priority: 4 });

      const changed = await api.changeTaskStatus(task.id, "completed");

      assert.deepEqual({ status: changed.status, priority: changed.priority }, { status: "completed", priority: 4 });
    });

    it("updates the given fields only", async () => {
      const task = await createTask("before");

      const updated = await api.updateTask(task.id, { description: "after", priority: 2 });

      assert.deepEqual(updated, { ...task, description: "after", priority: 2 });
      assert.deepEqual(await api.getTask(task.id), updated);
    });

    it("moves a task in and out of a session", async () => {
      const task = await createTask("moves");
      const session = await api.startFocusSession({ tasks: [(await createTask("seed")).id] });

      assert.equal((await api.updateTask(task.id, { focusSessionId: session.id })).focusSessionId, session.id);
      assert.equal((await api.updateTask(task.id, { focusSessionId: null })).focusSessionId, null);
    });

    it("refuses a focusSessionId that matches no session", async () => {
      const task = await createTask("orphan");

      await rejectsWith(api.updateTask(task.id, { focusSessionId: MISSING_ID }), "invalid");
    });

    it("answers not found for unknown tasks", async () => {
      await rejectsWith(api.changeTaskStatus(MISSING_ID, "pending"), "not_found");
      await rejectsWith(api.updateTask(MISSING_ID, { priority: 1 }), "not_found");
    });
  });

  describe("deleting", () => {
    it("deletes a task and returns it", async () => {
      const task = await createTask("deleted");

      assert.deepEqual(await api.deleteTask(task.id), task);
      await rejectsWith(api.getTask(task.id), "not_found");
    });

    it("answers not found for an unknown task", async () => {
      await rejectsWith(api.deleteTask(MISSING_ID), "not_found");
    });
  });
});

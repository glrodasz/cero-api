import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MESSAGES, NotFoundError, ValidationError, type Task } from "../src/index.ts";
import { setup } from "./helpers.ts";

describe("TasksService", () => {
  describe("list", () => {
    it("lists in-progress and pending tasks by priority when no session is current", async () => {
      const app = setup();
      const first = await app.tasks.create({ description: "first" });
      const second = await app.tasks.create({ description: "second" });
      const done = await app.tasks.create({ description: "done" });
      await app.tasks.complete(done.id);
      await app.tasks.update(first.id, { priority: 5 });

      const tasks = await app.tasks.list();

      assert.deepEqual(
        tasks.map((task) => task.id),
        [second.id, first.id],
      );
    });

    it("lists the current session's tasks, completed ones included", async () => {
      const app = setup();
      const inSession = await app.tasks.create({ description: "in session" });
      await app.focusSessions.start({ taskIds: [inSession.id] });
      await app.tasks.complete(inSession.id);
      const outside = await app.tasks.create({ description: "created during the session" });
      await app.tasks.update(outside.id, { focusSessionId: null });

      const tasks = await app.tasks.list();

      assert.deepEqual(
        tasks.map((task) => task.id),
        [inSession.id],
      );
    });

    it("keeps creation order between tasks with the same priority", async () => {
      const app = setup();
      const descriptions = ["a", "b", "c"];
      for (const description of descriptions) {
        await app.tasks.create({ description });
      }

      const tasks = await app.tasks.list();

      assert.deepEqual(
        tasks.map((task) => task.description),
        descriptions,
      );
    });
  });

  describe("get", () => {
    it("fails with NotFound for an unknown id", async () => {
      const app = setup();

      await assert.rejects(app.tasks.get("unknown"), new NotFoundError(MESSAGES.TASK_NOT_FOUND));
    });
  });

  describe("create", () => {
    it("starts tasks in progress until three are in progress, then as pending", async () => {
      const app = setup();

      const statuses = [];
      for (const description of ["1", "2", "3", "4"]) {
        statuses.push((await app.tasks.create({ description })).status);
      }

      assert.deepEqual(statuses, ["in-progress", "in-progress", "in-progress", "pending"]);
    });

    it("creates the task at priority 0 without a session when none is current", async () => {
      const app = setup();

      const task = await app.tasks.create({ description: "write tests" });

      assert.deepEqual(
        { ...task, id: undefined },
        { id: undefined, description: "write tests", priority: 0, status: "in-progress", focusSessionId: null },
      );
    });

    it("attaches the task to the current session", async () => {
      const app = setup();
      const session = await app.focusSessions.start();

      const task = await app.tasks.create({ description: "joins the session" });

      assert.equal(task.focusSessionId, session.id);
    });
  });

  describe("complete", () => {
    it("puts the task on top of the completed group and renumbers the rest", async () => {
      const app = setup();
      const [a, b, c] = await createTasks(app, ["a", "b", "c"]);
      await app.tasks.complete(a.id);
      await app.tasks.complete(b.id);

      const completed = await app.tasks.complete(c.id);

      assert.deepEqual(
        { status: completed.status, priority: completed.priority },
        { status: "completed", priority: 0 },
      );
      assert.deepEqual(await priorities(app, [c.id, b.id, a.id]), [0, 1, 2]);
    });

    it("changes nothing when the task does not exist", async () => {
      const app = setup();
      const [a] = await createTasks(app, ["a"]);
      await app.tasks.complete(a.id);
      await app.tasks.update(a.id, { priority: 7 });

      await assert.rejects(app.tasks.complete("unknown"), NotFoundError);

      assert.deepEqual(await priorities(app, [a.id]), [7]);
    });
  });

  describe("reset", () => {
    it("puts the task on top of the pending group and renumbers the rest", async () => {
      const app = setup();
      const [a, b, c, d] = await createTasks(app, ["a", "b", "c", "d"]); // d starts pending
      await app.tasks.reset(c.id);

      const reset = await app.tasks.reset(a.id);

      assert.deepEqual({ status: reset.status, priority: reset.priority }, { status: "pending", priority: 0 });
      assert.deepEqual(await priorities(app, [a.id, c.id, d.id]), [0, 1, 2]);
      assert.equal((await app.tasks.get(b.id)).status, "in-progress");
    });
  });

  describe("changeStatus", () => {
    it("sets only the status", async () => {
      const app = setup();
      const [task] = await createTasks(app, ["a"]);
      await app.tasks.update(task.id, { priority: 4 });

      const updated = await app.tasks.changeStatus(task.id, "pending");

      assert.deepEqual({ status: updated.status, priority: updated.priority }, { status: "pending", priority: 4 });
    });

    it("rejects an unknown status before looking the task up", async () => {
      const app = setup();

      await assert.rejects(app.tasks.changeStatus("unknown", "done"), new ValidationError(MESSAGES.INVALID_TASK_STATUS));
    });
  });

  describe("update", () => {
    it("changes only the given fields", async () => {
      const app = setup();
      await app.focusSessions.start();
      const task = await app.tasks.create({ description: "before" }); // joins the session

      const updated = await app.tasks.update(task.id, { description: "after", focusSessionId: null });

      assert.deepEqual(updated, { ...task, description: "after", focusSessionId: null });
    });

    it("rejects an unknown status", async () => {
      const app = setup();
      const [task] = await createTasks(app, ["a"]);

      // A transport without its own enum validation could pass anything through.
      const changes = { status: "done" } as unknown as { status: "pending" };
      await assert.rejects(app.tasks.update(task.id, changes), new ValidationError(MESSAGES.INVALID_TASK_STATUS));
    });

    it("rejects a focusSessionId that does not match a session", async () => {
      const app = setup();
      const [task] = await createTasks(app, ["a"]);

      await assert.rejects(
        app.tasks.update(task.id, { focusSessionId: "unknown" }),
        new ValidationError(MESSAGES.UNKNOWN_FOCUS_SESSION),
      );
    });
  });

  describe("delete", () => {
    it("removes the task and returns it", async () => {
      const app = setup();
      const [task] = await createTasks(app, ["a"]);

      const deleted = await app.tasks.delete(task.id);

      assert.deepEqual(deleted, task);
      await assert.rejects(app.tasks.get(task.id), NotFoundError);
    });

    it("fails with NotFound for an unknown id", async () => {
      const app = setup();

      await assert.rejects(app.tasks.delete("unknown"), new NotFoundError(MESSAGES.TASK_NOT_FOUND));
    });
  });
});

/** Creates the tasks one after another (creation order matters) and returns them in that order. */
const createTasks = async <const Descriptions extends readonly string[]>(
  app: ReturnType<typeof setup>,
  descriptions: Descriptions,
): Promise<{ -readonly [Index in keyof Descriptions]: Task }> => {
  const tasks: Task[] = [];
  for (const description of descriptions) {
    tasks.push(await app.tasks.create({ description }));
  }
  return tasks as { -readonly [Index in keyof Descriptions]: Task };
};

const priorities = async (app: ReturnType<typeof setup>, ids: string[]) =>
  Promise.all(ids.map(async (id) => (await app.tasks.get(id)).priority));

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { NewFocusSession } from "../focusSessions/FocusSession.ts";
import type { Repositories } from "../index.ts";
import type { NewTask } from "../tasks/Task.ts";

/**
 * The behaviour every storage adapter must honour, as runnable tests.
 *
 * An adapter package calls this from its own test file with a factory that
 * returns repositories over empty storage:
 *
 *     testRepositoryContract("MongoDB", async () => createMongooseRepositories(await freshDatabase()));
 */
export const testRepositoryContract = (adapterName: string, createRepositories: () => Promise<Repositories>) => {
  describe(`${adapterName} repositories honour the storage contract`, () => {
    let repositories: Repositories;

    beforeEach(async () => {
      repositories = await createRepositories();
    });

    const newTask = (changes: Partial<NewTask> = {}): NewTask => ({
      description: "a task",
      priority: 0,
      status: "pending",
      focusSessionId: null,
      ...changes,
    });

    const newSession = (changes: Partial<NewFocusSession> = {}): NewFocusSession => ({
      status: "active",
      startTime: 1_000,
      tasks: [],
      pauses: [],
      ...changes,
    });

    describe("tasks", () => {
      it("assigns an id on create and finds the task by it", async () => {
        const created = await repositories.tasks.create(newTask({ description: "stored" }));

        assert.equal(typeof created.id, "string");
        assert.deepEqual(await repositories.tasks.findById(created.id), created);
      });

      it("finds nothing for unknown or malformed ids", async () => {
        const deleted = await repositories.tasks.create(newTask());
        await repositories.tasks.delete(deleted.id);

        assert.equal(await repositories.tasks.findById(deleted.id), null);
        assert.equal(await repositories.tasks.findById("not-an-id"), null);
      });

      it("sorts by priority, then creation order", async () => {
        const second = await repositories.tasks.create(newTask({ priority: 1 }));
        const third = await repositories.tasks.create(newTask({ priority: 1 }));
        const first = await repositories.tasks.create(newTask({ priority: 0 }));

        const tasks = await repositories.tasks.findMany({});

        assert.deepEqual(
          tasks.map((task) => task.id),
          [first.id, second.id, third.id],
        );
      });

      it("combines every filter criterion", async () => {
        const session = await repositories.focusSessions.create(newSession());
        const match = await repositories.tasks.create(newTask({ status: "pending", focusSessionId: session.id }));
        await repositories.tasks.create(newTask({ status: "completed", focusSessionId: session.id }));
        const other = await repositories.tasks.create(newTask({ status: "pending" }));

        const byAll = await repositories.tasks.findMany({
          ids: [match.id, other.id, "not-an-id"],
          statuses: ["pending", "in-progress"],
          focusSessionId: session.id,
        });

        assert.deepEqual(
          byAll.map((task) => task.id),
          [match.id],
        );
        assert.deepEqual(await repositories.tasks.findMany({ ids: [] }), []);
      });

      it("counts tasks by status", async () => {
        await repositories.tasks.create(newTask({ status: "in-progress" }));
        await repositories.tasks.create(newTask({ status: "in-progress" }));
        await repositories.tasks.create(newTask({ status: "pending" }));

        assert.equal(await repositories.tasks.countByStatus("in-progress"), 2);
        assert.equal(await repositories.tasks.countByStatus("completed"), 0);
      });

      it("overwrites a task on save", async () => {
        const task = await repositories.tasks.create(newTask());
        const changed = { ...task, description: "changed", priority: 3, status: "completed" as const };

        await repositories.tasks.save(changed);

        assert.deepEqual(await repositories.tasks.findById(task.id), changed);
      });

      it("assigns and clears the focus session of many tasks at once", async () => {
        const session = await repositories.focusSessions.create(newSession());
        const a = await repositories.tasks.create(newTask());
        const b = await repositories.tasks.create(newTask());

        await repositories.tasks.assignFocusSession([a.id, b.id, "not-an-id"], session.id);
        assert.deepEqual(
          (await repositories.tasks.findMany({ focusSessionId: session.id })).map((task) => task.id),
          [a.id, b.id],
        );

        await repositories.tasks.assignFocusSession([a.id], null);
        assert.equal((await repositories.tasks.findById(a.id))?.focusSessionId, null);
      });

      it("ignores malformed ids on save and delete", async () => {
        await repositories.tasks.save({ ...newTask(), id: "not-an-id" });
        await repositories.tasks.delete("not-an-id");

        assert.deepEqual(await repositories.tasks.findMany({}), []);
      });
    });

    describe("focus sessions", () => {
      it("assigns an id on create and finds the session by it, pauses included", async () => {
        const created = await repositories.focusSessions.create(
          newSession({
            status: "paused",
            tasks: ["task-1", "task-2"],
            pauses: [{ id: "pause-1", startTime: 1_500, endTime: null, time: 0 }],
          }),
        );

        assert.equal(typeof created.id, "string");
        assert.deepEqual(await repositories.focusSessions.findById(created.id), created);
        assert.equal(await repositories.focusSessions.findById("not-an-id"), null);
      });

      it("lists sessions oldest first", async () => {
        const first = await repositories.focusSessions.create(newSession({ startTime: 9 }));
        const second = await repositories.focusSessions.create(newSession({ startTime: 1 }));

        const sessions = await repositories.focusSessions.findAll();

        assert.deepEqual(
          sessions.map((session) => session.id),
          [first.id, second.id],
        );
      });

      it("finds the newest active or paused session as current", async () => {
        assert.equal(await repositories.focusSessions.findCurrent(), null);

        await repositories.focusSessions.create(newSession({ status: "active" }));
        const newest = await repositories.focusSessions.create(newSession({ status: "paused" }));
        await repositories.focusSessions.create(newSession({ status: "finished" }));

        assert.equal((await repositories.focusSessions.findCurrent())?.id, newest.id);
      });

      it("overwrites a session on save", async () => {
        const session = await repositories.focusSessions.create(newSession());
        const changed = {
          ...session,
          status: "finished" as const,
          pauses: [{ id: "pause-1", startTime: 1_100, endTime: 1_400, time: 300 }],
        };

        await repositories.focusSessions.save(changed);

        assert.deepEqual(await repositories.focusSessions.findById(session.id), changed);
      });
    });
  });
};

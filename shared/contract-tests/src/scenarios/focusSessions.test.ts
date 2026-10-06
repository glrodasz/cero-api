import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import type { FocusSession, Pause } from "../client/ApiClient.ts";
import { MISSING_ID } from "../config.ts";
import { api, createTask, deleteCreatedTasks, finishEveryCurrentSession, ids, rejectsWith } from "./helpers.ts";

const closedPauses = (session: FocusSession) => session.pauses.filter((pause) => pause.endTime !== null);

const assertClosedCorrectly = (pause: Pause | undefined) => {
  assert.ok(pause !== undefined && pause.endTime !== null, "expected a closed pause");
  assert.equal(pause.time, pause.endTime - pause.startTime);
};

describe("Focus sessions", () => {
  beforeEach(finishEveryCurrentSession);
  after(async () => {
    await finishEveryCurrentSession();
    await deleteCreatedTasks();
  });

  describe("starting", () => {
    it("starts an active session with every unfinished task by default", async () => {
      const unfinished = await createTask("unfinished");
      const completed = await createTask("completed");
      await api.completeTask(completed.id);
      const before = Date.now();

      const session = await api.startFocusSession();

      assert.equal(session.status, "active");
      assert.deepEqual(session.pauses, []);
      assert.ok(session.startTime >= before - 5_000, "startTime defaults to now");
      assert.ok(session.tasks.includes(unfinished.id));
      assert.ok(!session.tasks.includes(completed.id));
      assert.equal((await api.getTask(unfinished.id)).focusSessionId, session.id);
    });

    it("keeps the requested tasks in order and drops unknown ones", async () => {
      const a = await createTask("a");
      const b = await createTask("b");

      const session = await api.startFocusSession({ tasks: [b.id, MISSING_ID, a.id] });

      assert.deepEqual(session.tasks, [b.id, a.id]);
    });

    it("uses the given start time", async () => {
      const session = await api.startFocusSession({ tasks: [(await createTask("seed")).id], startTime: 1_700_000_000_000 });

      assert.equal(session.startTime, 1_700_000_000_000);
    });

    it("lists every session, the new one last", async () => {
      const session = await api.startFocusSession({ tasks: [(await createTask("seed")).id] });

      const sessions = await api.listFocusSessions();

      assert.equal(sessions.at(-1)?.id, session.id);
    });
  });

  describe("the current session", () => {
    it("is null when every session is finished", async () => {
      assert.equal(await api.getCurrentFocusSession(), null);
    });

    it("is the newest active or paused session", async () => {
      await api.startFocusSession({ tasks: [(await createTask("older")).id] });
      const newest = await api.startFocusSession({ tasks: [(await createTask("newer")).id] });

      assert.equal((await api.getCurrentFocusSession())?.id, newest.id);
    });

    it("has its startTime moved forward by the closed pauses", async () => {
      const session = await api.startFocusSession({ tasks: [(await createTask("seed")).id] });
      await api.pauseFocusSession(session.id);
      const resumed = await api.resumeFocusSession(session.id);
      await api.pauseFocusSession(session.id); // left open: not counted

      const current = await api.getCurrentFocusSession();

      const pausedTime = closedPauses(resumed).reduce((total, pause) => total + pause.time, 0);
      assert.equal(current?.startTime, session.startTime + pausedTime);
    });
  });

  describe("pausing and resuming by id", () => {
    it("pauses an active session and resumes it", async () => {
      const session = await api.startFocusSession({ tasks: [(await createTask("seed")).id] });

      const paused = await api.pauseFocusSession(session.id);
      assert.equal(paused.status, "paused");
      assert.equal(paused.pauses.length, 1);
      assert.equal(paused.pauses[0]?.endTime, null);

      const resumed = await api.resumeFocusSession(session.id);
      assert.equal(resumed.status, "active");
      assertClosedCorrectly(resumed.pauses[0]);
    });

    it("refuses to pause a session that is not active", async () => {
      const session = await api.startFocusSession({ tasks: [(await createTask("seed")).id] });
      await api.pauseFocusSession(session.id);

      await rejectsWith(api.pauseFocusSession(session.id), "not_found");
      await rejectsWith(api.pauseFocusSession(MISSING_ID), "not_found");
    });

    it("refuses to resume a session that is not paused", async () => {
      const session = await api.startFocusSession({ tasks: [(await createTask("seed")).id] });

      await rejectsWith(api.resumeFocusSession(session.id), "not_found");
      await rejectsWith(api.resumeFocusSession(MISSING_ID), "not_found");
    });
  });

  describe("pausing and resuming the current session", () => {
    it("opens a pause, and leaves it alone when asked again without a time", async () => {
      await api.startFocusSession({ tasks: [(await createTask("seed")).id] });

      const paused = await api.pauseCurrentFocusSession();
      const pausedAgain = await api.pauseCurrentFocusSession();

      assert.equal(paused.status, "paused");
      assert.deepEqual(pausedAgain, paused);
    });

    it("closes the open pause and opens a new one when a time is given", async () => {
      await api.startFocusSession({ tasks: [(await createTask("seed")).id] });
      await api.pauseCurrentFocusSession();

      const paused = await api.pauseCurrentFocusSession(1_234);

      assert.equal(paused.pauses.length, 2);
      assertClosedCorrectly(paused.pauses[0]);
      assert.deepEqual({ endTime: paused.pauses[1]?.endTime, time: paused.pauses[1]?.time }, { endTime: null, time: 1_234 });
    });

    it("resumes, and leaves an unpaused session alone", async () => {
      await api.startFocusSession({ tasks: [(await createTask("seed")).id] });
      await api.pauseCurrentFocusSession();

      const resumed = await api.resumeCurrentFocusSession();
      const resumedAgain = await api.resumeCurrentFocusSession();

      assert.equal(resumed.status, "active");
      assertClosedCorrectly(resumed.pauses[0]);
      assert.deepEqual(resumedAgain, resumed);
    });

    it("answers not found when no session is current", async () => {
      await rejectsWith(api.pauseCurrentFocusSession(), "not_found");
      await rejectsWith(api.resumeCurrentFocusSession(), "not_found");
      await rejectsWith(api.finishCurrentFocusSession(), "not_found");
    });
  });

  describe("finishing", () => {
    it("finishes a session, closing its pause and releasing its unfinished tasks", async () => {
      const unfinished = await createTask("unfinished");
      const completed = await createTask("completed");
      const session = await api.startFocusSession({ tasks: [unfinished.id, completed.id] });
      await api.completeTask(completed.id);
      await api.pauseFocusSession(session.id);

      const finished = await api.finishFocusSession(session.id);

      assert.equal(finished.status, "finished");
      assertClosedCorrectly(finished.pauses[0]);
      assert.equal((await api.getTask(unfinished.id)).focusSessionId, null);
      assert.equal((await api.getTask(completed.id)).focusSessionId, session.id);
      assert.ok(!ids(await api.listTasks()).includes(completed.id));
    });

    it("finishes the current session", async () => {
      const session = await api.startFocusSession({ tasks: [(await createTask("seed")).id] });

      const finished = await api.finishCurrentFocusSession();

      assert.deepEqual({ id: finished.id, status: finished.status }, { id: session.id, status: "finished" });
      assert.equal(await api.getCurrentFocusSession(), null);
    });

    it("answers not found for an unknown session", async () => {
      await rejectsWith(api.finishFocusSession(MISSING_ID), "not_found");
    });
  });
});

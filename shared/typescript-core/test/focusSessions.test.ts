import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MESSAGES, NotFoundError } from "../src/index.ts";
import { setup } from "./helpers.ts";

describe("FocusSessionsService", () => {
  describe("start", () => {
    it("starts an active session with every in-progress and pending task by default", async () => {
      const app = setup();
      const active = await app.tasks.create({ description: "active" });
      const done = await app.tasks.create({ description: "done" });
      await app.tasks.complete(done.id);

      const session = await app.focusSessions.start();

      assert.deepEqual(
        { ...session, id: undefined },
        { id: undefined, status: "active", startTime: app.now, tasks: [active.id], pauses: [] },
      );
      assert.equal((await app.tasks.get(active.id)).focusSessionId, session.id);
      assert.equal((await app.tasks.get(done.id)).focusSessionId, null);
    });

    it("keeps requested tasks in request order, dropping unknown and repeated ids", async () => {
      const app = setup();
      const a = await app.tasks.create({ description: "a" });
      const b = await app.tasks.create({ description: "b" });

      const session = await app.focusSessions.start({ taskIds: [b.id, "unknown", a.id, b.id] });

      assert.deepEqual(session.tasks, [b.id, a.id]);
    });

    it("uses the given start time", async () => {
      const app = setup();

      const session = await app.focusSessions.start({ startTime: 42 });

      assert.equal(session.startTime, 42);
    });
  });

  describe("getCurrent", () => {
    it("returns null when no session is current", async () => {
      const app = setup();
      await app.focusSessions.start();
      await app.focusSessions.finishCurrent();

      assert.equal(await app.focusSessions.getCurrent(), null);
    });

    it("moves startTime forward by the closed pauses only", async () => {
      const app = setup();
      const session = await app.focusSessions.start();
      await app.focusSessions.pause(session.id);
      app.advanceClock(300);
      await app.focusSessions.resume(session.id);
      await app.focusSessions.pause(session.id);
      app.advanceClock(5_000); // still open: not counted yet

      const current = await app.focusSessions.getCurrent();

      assert.equal(current?.startTime, session.startTime + 300);
    });

    it("returns the newest current session", async () => {
      const app = setup();
      await app.focusSessions.start();
      const newest = await app.focusSessions.start();

      assert.equal((await app.focusSessions.getCurrent())?.id, newest.id);
    });
  });

  describe("pause", () => {
    it("opens a pause on an active session", async () => {
      const app = setup();
      const session = await app.focusSessions.start();
      app.advanceClock(1_000);

      const paused = await app.focusSessions.pause(session.id);

      assert.equal(paused.status, "paused");
      assert.deepEqual(
        paused.pauses.map(({ id, ...pause }) => pause),
        [{ startTime: app.now, endTime: null, time: 0 }],
      );
    });

    it("refuses sessions that are not active", async () => {
      const app = setup();
      const session = await app.focusSessions.start();
      await app.focusSessions.pause(session.id);
      const cannotPause = new NotFoundError(MESSAGES.CANNOT_PAUSE);

      await assert.rejects(app.focusSessions.pause(session.id), cannotPause);
      await assert.rejects(app.focusSessions.pause("unknown"), cannotPause);
    });
  });

  describe("pauseCurrent", () => {
    it("fails when no session is current", async () => {
      const app = setup();

      await assert.rejects(app.focusSessions.pauseCurrent(), new NotFoundError(MESSAGES.NO_CURRENT_FOCUS_SESSION));
    });

    it("opens a pause on an active session", async () => {
      const app = setup();
      await app.focusSessions.start();

      const paused = await app.focusSessions.pauseCurrent();

      assert.equal(paused.status, "paused");
      assert.equal(paused.pauses.length, 1);
      assert.equal(paused.pauses[0]?.endTime, null);
    });

    it("leaves an already paused session as is when no time is given", async () => {
      const app = setup();
      await app.focusSessions.start();
      const paused = await app.focusSessions.pauseCurrent();
      app.advanceClock(1_000);

      assert.deepEqual(await app.focusSessions.pauseCurrent(), paused);
    });

    it("closes the open pause and opens a new one with the given time", async () => {
      const app = setup();
      await app.focusSessions.start();
      await app.focusSessions.pauseCurrent();
      const firstPauseStart = app.now;
      app.advanceClock(1_000);

      const paused = await app.focusSessions.pauseCurrent({ time: 25 });

      assert.deepEqual(
        paused.pauses.map(({ id, ...pause }) => pause),
        [
          { startTime: firstPauseStart, endTime: app.now, time: 1_000 },
          { startTime: app.now, endTime: null, time: 25 },
        ],
      );
    });
  });

  describe("resume", () => {
    it("closes the open pause of a paused session", async () => {
      const app = setup();
      const session = await app.focusSessions.start();
      await app.focusSessions.pause(session.id);
      app.advanceClock(700);

      const resumed = await app.focusSessions.resume(session.id);

      assert.equal(resumed.status, "active");
      assert.deepEqual(
        resumed.pauses.map(({ endTime, time }) => ({ endTime, time })),
        [{ endTime: app.now, time: 700 }],
      );
    });

    it("refuses sessions that are not paused", async () => {
      const app = setup();
      const session = await app.focusSessions.start();

      await assert.rejects(app.focusSessions.resume(session.id), new NotFoundError(MESSAGES.CANNOT_RESUME));
    });
  });

  describe("resumeCurrent", () => {
    it("closes the open pause of the current session", async () => {
      const app = setup();
      await app.focusSessions.start();
      await app.focusSessions.pauseCurrent();
      app.advanceClock(200);

      const resumed = await app.focusSessions.resumeCurrent();

      assert.equal(resumed.status, "active");
      assert.equal(resumed.pauses[0]?.time, 200);
    });

    it("leaves a session without an open pause as is", async () => {
      const app = setup();
      const session = await app.focusSessions.start();

      assert.deepEqual(await app.focusSessions.resumeCurrent(), session);
    });

    it("fails when no session is current", async () => {
      const app = setup();

      await assert.rejects(app.focusSessions.resumeCurrent(), new NotFoundError(MESSAGES.NO_CURRENT_FOCUS_SESSION));
    });
  });

  describe("finish", () => {
    it("closes the open pause and releases the unfinished tasks only", async () => {
      const app = setup();
      const unfinished = await app.tasks.create({ description: "unfinished" });
      const done = await app.tasks.create({ description: "done" });
      const session = await app.focusSessions.start();
      await app.tasks.complete(done.id);
      await app.focusSessions.pause(session.id);
      app.advanceClock(400);

      const finished = await app.focusSessions.finish(session.id);

      assert.equal(finished.status, "finished");
      assert.equal(finished.pauses[0]?.time, 400);
      assert.equal((await app.tasks.get(unfinished.id)).focusSessionId, null);
      assert.equal((await app.tasks.get(done.id)).focusSessionId, session.id);
    });

    it("fails with NotFound for an unknown id", async () => {
      const app = setup();

      await assert.rejects(app.focusSessions.finish("unknown"), new NotFoundError(MESSAGES.FOCUS_SESSION_NOT_FOUND));
    });
  });

  describe("finishCurrent", () => {
    it("finishes the current session", async () => {
      const app = setup();
      const session = await app.focusSessions.start();

      const finished = await app.focusSessions.finishCurrent();

      assert.deepEqual({ id: finished.id, status: finished.status }, { id: session.id, status: "finished" });
    });

    it("fails when no session is current", async () => {
      const app = setup();

      await assert.rejects(app.focusSessions.finishCurrent(), new NotFoundError(MESSAGES.NO_CURRENT_FOCUS_SESSION));
    });
  });
});

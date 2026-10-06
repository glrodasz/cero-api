import assert from "node:assert/strict";
import { ApiError, type Task } from "../client/ApiClient.ts";
import { createClient } from "../config.ts";

// The suite runs against real, possibly non-empty storage. It never assumes an
// empty database: it labels what it creates, cleans up after itself, and
// derives expectations from what it observes.

export const api = createClient();

const runId = Math.random().toString(36).slice(2, 8);
let sequence = 0;
export const uniqueDescription = (label: string) => `contract ${runId} #${++sequence} ${label}`;

const createdTaskIds = new Set<string>();

export const createTask = async (label: string): Promise<Task> => {
  const task = await api.createTask(uniqueDescription(label));
  createdTaskIds.add(task.id);
  return task;
};

export const deleteCreatedTasks = async () => {
  for (const id of createdTaskIds) {
    await api.deleteTask(id).catch(() => undefined);
  }
  createdTaskIds.clear();
};

/** Several sessions can be current at once; finish them all so each test starts from "no session". */
export const finishEveryCurrentSession = async () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await api.finishCurrentFocusSession();
    } catch (error) {
      if (error instanceof ApiError && error.kind === "not_found") return;
      throw error;
    }
  }
  throw new Error("Could not finish every current focus session");
};

export const rejectsWith = (promise: Promise<unknown>, kind: ApiError["kind"], message?: string) =>
  assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError, `expected an ApiError, got ${String(error)}`);
    assert.equal(error.kind, kind);
    if (message !== undefined) assert.equal(error.message, message);
    return true;
  });

export const ids = (items: { id: string }[]) => items.map((item) => item.id);

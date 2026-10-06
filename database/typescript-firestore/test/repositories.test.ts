import { testRepositoryContract } from "@cero/core/testing";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import assert from "node:assert/strict";
import { after, describe } from "node:test";
import { createFirestoreRepositories } from "../src/index.ts";

// Runs against the Firestore emulator: `yarn workspace typescript-firebase emulators`
// from the repository root (see typescript-firebase/README.md). The Admin SDK
// talks to it instead of Google Cloud while FIRESTORE_EMULATOR_HOST is set.
// A project of its own keeps the test run away from the app's emulator data;
// "demo-" projects need no credentials and can never reach production.
const emulatorHost = (process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8180");
const projectId = "demo-cero-test";

/** The emulator's own endpoint for wiping a project's documents. */
const clearDatabase = async () => {
  const response = await fetch(`http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {
    method: "DELETE",
  });
  assert.ok(response.ok, `Could not clear the Firestore emulator at ${emulatorHost}: HTTP ${response.status}`);
};

describe("Firestore adapter", { skip: process.env.SKIP_DATABASE_TESTS === "1" && "SKIP_DATABASE_TESTS=1" }, () => {
  const app = initializeApp({ projectId }, "repository-contract");

  after(() => deleteApp(app));

  testRepositoryContract("Firestore", async () => {
    await clearDatabase();
    return createFirestoreRepositories(getFirestore(app));
  });
});

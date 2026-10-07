import { deleteApp, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

// typescript-express tests the Express app and @cero/firestore tests the
// storage. This checks the wiring in between: the exported function serves
// that app and stores in Firestore. It needs the Firestore emulator (see the
// README), in a project of its own so it never meets the app's data.
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8180";
process.env.GCLOUD_PROJECT = "demo-cero-functions-test";

// Imported once the environment is set: the module initializes Firebase as it loads.
const { api } = await import("../src/index.ts");

// Cloud Functions hands the function Express's request and response. Node's
// own are what Express builds those from, and all the Express app inside needs.
type FunctionRequest = Parameters<typeof api>[0];
type FunctionResponse = Parameters<typeof api>[1];

describe("api function", () => {
  const server = createServer((request, response) => api(request as FunctionRequest, response as FunctionResponse));
  const url = (path: string) => `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`;

  before(() => new Promise<void>((resolve) => server.listen(0, resolve)));
  after(async () => {
    server.close();
    await deleteApp(getApp());
  });

  it("serves the Express app and stores tasks in Firestore", async () => {
    const response = await fetch(url("/tasks"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "stored in Firestore" }),
    });
    const task = (await response.json()) as { id: string };

    assert.equal(response.status, 201);
    const document = await getFirestore().collection("tasks").doc(task.id).get();
    assert.equal(document.get("description"), "stored in Firestore");
  });

  it("answers unknown routes like the Express app does", async () => {
    const response = await fetch(url("/nowhere"));

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { message: "Not found" });
  });
});

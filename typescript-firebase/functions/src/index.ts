import { createServices } from "@cero/core";
import { createFirestoreRepositories } from "@cero/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/https";
import { createApp } from "typescript-express/app";

// Composition root, run once per function instance: the Express app of
// typescript-express, on Firestore, served by one HTTPS function. Express
// apps are request handlers, which is what `onRequest` takes.
//
// `initializeApp()` reads the project and credentials from the environment:
// the emulator's when emulated, the function's service account when deployed.

initializeApp();

export const api = onRequest(createApp(createServices(createFirestoreRepositories(getFirestore()))));

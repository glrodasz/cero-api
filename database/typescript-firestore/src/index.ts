import type { Repositories } from "@cero/core";
import type { Firestore } from "firebase-admin/firestore";
import { FirestoreFocusSessionRepository } from "./FirestoreFocusSessionRepository.ts";
import { FirestoreTaskRepository } from "./FirestoreTaskRepository.ts";

export { FirestoreFocusSessionRepository } from "./FirestoreFocusSessionRepository.ts";
export { FirestoreTaskRepository } from "./FirestoreTaskRepository.ts";

/**
 * Repositories over a Firestore database. The caller owns the `Firestore`
 * instance: in a Cloud Function it comes from `getFirestore()`, and the
 * emulator is picked up from `FIRESTORE_EMULATOR_HOST`.
 */
export const createFirestoreRepositories = (db: Firestore): Repositories => ({
  tasks: new FirestoreTaskRepository(db),
  focusSessions: new FirestoreFocusSessionRepository(db),
});

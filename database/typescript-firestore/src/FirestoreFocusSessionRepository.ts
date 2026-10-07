import { CURRENT_SESSION_STATUSES, type FocusSession, type FocusSessionRepository, type NewFocusSession } from "@cero/core";
import type { CollectionReference, Firestore } from "firebase-admin/firestore";
import { focusSessionConverter, type FocusSessionDocument } from "./converters.ts";
import { isDocumentId, isNotFound } from "./documentIds.ts";

export class FirestoreFocusSessionRepository implements FocusSessionRepository {
  #sessions: CollectionReference<FocusSession, FocusSessionDocument>;

  constructor(db: Firestore) {
    this.#sessions = db.collection("focus_sessions").withConverter(focusSessionConverter);
  }

  async findAll(): Promise<FocusSession[]> {
    const snapshot = await this.#sessions.orderBy("createdAt").get();
    return snapshot.docs.map((document) => document.data());
  }

  async findById(id: string): Promise<FocusSession | null> {
    if (!isDocumentId(id)) {
      return null;
    }

    const snapshot = await this.#sessions.doc(id).get();
    return snapshot.data() ?? null;
  }

  async findCurrent(): Promise<FocusSession | null> {
    const snapshot = await this.#sessions
      .where("status", "in", CURRENT_SESSION_STATUSES)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    return snapshot.docs[0]?.data() ?? null;
  }

  async create(newSession: NewFocusSession): Promise<FocusSession> {
    const reference = this.#sessions.doc();
    const session: FocusSession = { id: reference.id, ...newSession };
    await reference.create(session);
    return session;
  }

  async save({ id, ...fields }: FocusSession): Promise<void> {
    if (!isDocumentId(id)) {
      return;
    }

    try {
      await this.#sessions.doc(id).update(fields);
    } catch (error) {
      // Saving a session that does not exist is a no-op, as the port asks.
      if (!isNotFound(error)) throw error;
    }
  }
}

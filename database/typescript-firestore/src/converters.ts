import type { FocusSession, NewFocusSession, NewTask, Task } from "@cero/core";
import { FieldValue, type FirestoreDataConverter, type Timestamp, type WithFieldValue } from "firebase-admin/firestore";

// How the documents look inside Firestore: the domain fields, plus the
// server's `createdAt`, which orders lists. The id is the document's own, so
// it is not stored as a field. Pauses are embedded in their session.

export type TaskDocument = NewTask & { createdAt: Timestamp };

export type FocusSessionDocument = NewFocusSession & { createdAt: Timestamp };

// Collections read through these converters hand out domain objects. Only
// `create` writes whole documents through them, so that is where `createdAt`
// is stamped; `save` goes through `update`, which leaves it alone.

export const taskConverter: FirestoreDataConverter<Task, TaskDocument> = {
  toFirestore({ description, priority, status, focusSessionId }: WithFieldValue<Task>): WithFieldValue<TaskDocument> {
    return { description, priority, status, focusSessionId, createdAt: FieldValue.serverTimestamp() };
  },
  fromFirestore(snapshot): Task {
    const { description, priority, status, focusSessionId } = snapshot.data() as TaskDocument;
    return { id: snapshot.id, description, priority, status, focusSessionId };
  },
};

export const focusSessionConverter: FirestoreDataConverter<FocusSession, FocusSessionDocument> = {
  toFirestore({ status, startTime, tasks, pauses }: WithFieldValue<FocusSession>): WithFieldValue<FocusSessionDocument> {
    return { status, startTime, tasks, pauses, createdAt: FieldValue.serverTimestamp() };
  },
  fromFirestore(snapshot): FocusSession {
    const { status, startTime, tasks, pauses } = snapshot.data() as FocusSessionDocument;
    return { id: snapshot.id, status, startTime, tasks, pauses };
  },
};

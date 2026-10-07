import { FOCUS_SESSION_STATUSES, TASK_STATUSES, type FocusSessionStatus, type TaskStatus } from "@cero/core";
import { Schema, type Types } from "mongoose";

// How the documents look inside MongoDB. The Python MongoDB adapter reads and
// writes the very same shape, so both languages can share a database.

export type TaskDocument = {
  _id: Types.ObjectId;
  description: string;
  priority: number;
  status: TaskStatus;
  focusSessionId: string | null;
};

export type PauseDocument = {
  id: string;
  startTime: number;
  endTime: number | null;
  time: number;
};

export type FocusSessionDocument = {
  _id: Types.ObjectId;
  status: FocusSessionStatus;
  startTime: number;
  tasks: string[];
  pauses: PauseDocument[];
};

export const taskSchema = new Schema<TaskDocument>(
  {
    description: { type: String, required: true },
    priority: { type: Number, required: true, default: 0 },
    status: { type: String, enum: TASK_STATUSES, required: true },
    focusSessionId: { type: String, default: null },
  },
  { collection: "tasks", versionKey: false },
);

// Pauses live inside their session and carry their own id, so Mongoose must
// neither add an `_id` nor shadow `id` with its virtual.
const pauseSchema = new Schema<PauseDocument>(
  {
    id: { type: String, required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, default: null },
    time: { type: Number, required: true },
  },
  { _id: false, id: false },
);

export const focusSessionSchema = new Schema<FocusSessionDocument>(
  {
    status: { type: String, enum: FOCUS_SESSION_STATUSES, required: true },
    startTime: { type: Number, required: true },
    tasks: { type: [String], default: [] },
    pauses: { type: [pauseSchema], default: [] },
  },
  { collection: "focus_sessions", versionKey: false },
);

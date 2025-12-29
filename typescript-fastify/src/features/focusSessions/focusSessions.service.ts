import {
  Schema,
  model,
  models,
  isValidObjectId,
  type Document,
  type Model,
} from "mongoose";
import type {
  FocusSession,
  FocusSessionStatus,
  Pause,
} from "./FocusSession";

type FocusSessionAttributes = {
  status: FocusSessionStatus;
  startTime: number;
  tasks: string[];
  pauses: Pause[];
};

interface PauseDocument extends Document, Omit<Pause, "id"> {
  id: string;
}

interface FocusSessionDocument
  extends Omit<FocusSession, "id" | "pauses">,
    Document {
  id: string;
  pauses: PauseDocument[];
}

const pauseSchema = new Schema<PauseDocument>({
  startTime: { type: Number, required: true },
  endTime: { type: Number, default: null },
  time: { type: Number, default: 0 },
});

const focusSessionSchema = new Schema<FocusSessionDocument>({
  status: {
    type: String,
    enum: ["active", "paused", "finished"],
    default: "active",
  },
  startTime: { type: Number, required: true },
  tasks: { type: [String], required: true },
  pauses: { type: [pauseSchema], default: [] },
});

const FocusSessionModel: Model<FocusSessionDocument> =
  models.FocusSession ??
  model<FocusSessionDocument>("FocusSession", focusSessionSchema);

const toPause = (pause: PauseDocument): Pause => ({
  id: pause.id,
  startTime: pause.startTime,
  endTime: pause.endTime,
  time: pause.time,
});

const toFocusSession = (session: FocusSessionDocument): FocusSession => ({
  id: session.id,
  status: session.status,
  startTime: session.startTime,
  tasks: session.tasks,
  pauses: session.pauses.map(toPause),
});

const closeActivePause = (session: FocusSessionDocument) => {
  const lastPause = session.pauses[session.pauses.length - 1];
  if (lastPause && lastPause.endTime == null) {
    const now = Date.now();
    lastPause.endTime = now;
    lastPause.time = now - lastPause.startTime;
  }
};

export const focusSessionsService = {
  getActiveSessions: async (): Promise<FocusSession[]> => {
    const sessions = await FocusSessionModel.find({
      status: { $in: ["active", "paused"] },
    }).exec();

    return sessions.map(toFocusSession);
  },
  createSession: async (
    payload: Pick<FocusSessionAttributes, "tasks"> &
      Partial<Pick<FocusSessionAttributes, "startTime">>
  ): Promise<FocusSession> => {
    const session = await FocusSessionModel.create({
      status: "active",
      startTime: payload.startTime ?? Date.now(),
      tasks: payload.tasks,
      pauses: [],
    });

    return toFocusSession(session);
  },
  finishSession: async (id: string): Promise<FocusSession | null> => {
    if (!isValidObjectId(id)) {
      return null;
    }

    const session = await FocusSessionModel.findById(id).exec();
    if (!session) {
      return null;
    }

    closeActivePause(session);
    session.status = "finished";

    await session.save();
    return toFocusSession(session);
  },
  pauseSession: async (id: string): Promise<FocusSession | null> => {
    if (!isValidObjectId(id)) {
      return null;
    }

    const session = await FocusSessionModel.findById(id).exec();
    if (!session || session.status !== "active") {
      return null;
    }

    const newPause = session.pauses.create({
      startTime: Date.now(),
      endTime: null,
      time: 0,
    });

    session.pauses.push(newPause);

    session.status = "paused";

    await session.save();
    return toFocusSession(session);
  },
  resumeSession: async (id: string): Promise<FocusSession | null> => {
    if (!isValidObjectId(id)) {
      return null;
    }

    const session = await FocusSessionModel.findById(id).exec();
    if (!session || session.status !== "paused") {
      return null;
    }

    closeActivePause(session);
    session.status = "active";

    await session.save();
    return toFocusSession(session);
  },
};

import mongoose, {
  Schema,
  model,
  isValidObjectId,
  type Document,
  type Model,
} from "mongoose";
import type {
  FocusSession,
  FocusSessionStatus,
  Pause,
} from "./FocusSession.js";
import { ACTIVE_SESSION_STATUSES } from "./FocusSession.js";
import type { Task } from "../tasks/Task.js";

type FocusSessionAttributes = {
  status: FocusSessionStatus;
  startTime: number;
  tasks: Task["id"][];
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
  mongoose.models.FocusSession ??
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

const calculateTotalPauseTime = (session: FocusSessionDocument): number => {
  return session.pauses.reduce((total: number, pause: PauseDocument) => {
    if (pause.endTime != null) {
      return total + (pause.endTime - pause.startTime);
    }
    return total;
  }, 0);
};

export const focusSessionsService = {
  getAllSessions: async (): Promise<FocusSession[]> => {
    const sessions = await FocusSessionModel.find().exec();
    return sessions.map(toFocusSession);
  },
  getActiveSessions: async (): Promise<FocusSession[]> => {
    const sessions = await FocusSessionModel.find({
      status: { $in: ACTIVE_SESSION_STATUSES },
    }).exec();

    return sessions.map(toFocusSession);
  },
  getActiveSession: async (): Promise<FocusSession | null> => {
    const session = await FocusSessionModel.findOne({
      status: { $in: ACTIVE_SESSION_STATUSES },
    }).exec();

    return session ? toFocusSession(session) : null;
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
  finishSession: async (id: FocusSession["id"]): Promise<FocusSession | null> => {
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
  pauseSession: async (id: FocusSession["id"]): Promise<FocusSession | null> => {
    if (!isValidObjectId(id)) {
      return null;
    }

    const session = await FocusSessionModel.findById(id).exec();
    if (!session || session.status !== "active") {
      return null;
    }

    session.pauses.push({
      startTime: Date.now(),
      endTime: null,
      time: 0,
    } as PauseDocument);

    session.status = "paused";

    await session.save();
    return toFocusSession(session);
  },
  resumeSession: async (id: FocusSession["id"]): Promise<FocusSession | null> => {
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
  pauseActiveSession: async (time?: number): Promise<FocusSession | null> => {
    const session = await FocusSessionModel.findOne({
      status: { $in: ACTIVE_SESSION_STATUSES },
    }).exec();

    if (!session) {
      return null;
    }

    // Check if there's an active pause
    const activePause = session.pauses.find((pause: PauseDocument) => pause.endTime === null);

    // If active pause exists and time parameter provided, resume first
    if (activePause && time !== undefined) {
      closeActivePause(session);
      await session.save();
    } else if (activePause && time === undefined) {
      // Already paused, return current session
      return toFocusSession(session);
    }

    // Create new pause
    session.pauses.push({
      startTime: Date.now(),
      endTime: null,
      time: time ?? 0,
    } as PauseDocument);
    session.status = "paused";

    await session.save();
    return toFocusSession(session);
  },
  resumeActiveSession: async (): Promise<FocusSession | null> => {
    const session = await FocusSessionModel.findOne({
      status: { $in: ACTIVE_SESSION_STATUSES },
    }).exec();

    if (!session) {
      return null;
    }

    const activePause = session.pauses.find((pause: PauseDocument) => pause.endTime === null);

    if (!activePause) {
      // No active pause, return current session
      return toFocusSession(session);
    }

    // Close the active pause
    const now = Date.now();
    activePause.endTime = now;
    activePause.time = now - activePause.startTime;

    session.status = "active";
    await session.save();

    return toFocusSession(session);
  },
  getActiveSessionWithAdjustedStartTime: async (): Promise<FocusSession | null> => {
    const session = await FocusSessionModel.findOne({
      status: { $in: ACTIVE_SESSION_STATUSES },
    }).exec();

    if (!session) {
      return null;
    }

    const totalPauseTime = calculateTotalPauseTime(session);
    const adjustedSession = toFocusSession(session);
    
    return {
      ...adjustedSession,
      startTime: adjustedSession.startTime + totalPauseTime,
    };
  },
};

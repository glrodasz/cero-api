export const FOCUS_SESSION_STATUSES = ["active", "paused", "finished"] as const;

export type FocusSessionStatus = (typeof FOCUS_SESSION_STATUSES)[number];

/** A session in one of these statuses is "current": it has not been finished yet. */
export const CURRENT_SESSION_STATUSES: readonly FocusSessionStatus[] = ["active", "paused"];

export type Pause = {
  id: string;
  startTime: number;
  /** Null while the pause is open. */
  endTime: number | null;
  time: number;
};

export type FocusSession = {
  id: string;
  status: FocusSessionStatus;
  startTime: number;
  /** Ids of the tasks the session started with. */
  tasks: string[];
  /** Oldest first. Only the last pause can be open. */
  pauses: Pause[];
};

export type NewFocusSession = Omit<FocusSession, "id">;

// The rules below are pure: they take a session and return a new one.
// The service decides when to apply them and persists the result.

export const createPause = ({ startTime, time = 0 }: { startTime: number; time?: number }): Pause => ({
  id: crypto.randomUUID(),
  startTime,
  endTime: null,
  time,
});

export const openPause = (session: FocusSession): Pause | undefined => {
  const lastPause = session.pauses.at(-1);
  return lastPause?.endTime === null ? lastPause : undefined;
};

export const closeOpenPause = (session: FocusSession, now: number): FocusSession => {
  const pause = openPause(session);
  if (pause === undefined) {
    return session;
  }

  const closedPause: Pause = { ...pause, endTime: now, time: now - pause.startTime };
  return { ...session, pauses: [...session.pauses.slice(0, -1), closedPause] };
};

export const startPause = (session: FocusSession, pause: Pause): FocusSession => ({
  ...session,
  status: "paused",
  pauses: [...session.pauses, pause],
});

export const resumeSession = (session: FocusSession, now: number): FocusSession => ({
  ...closeOpenPause(session, now),
  status: "active",
});

export const finishSession = (session: FocusSession, now: number): FocusSession => ({
  ...closeOpenPause(session, now),
  status: "finished",
});

/**
 * Moves `startTime` forward by the time spent in closed pauses, so a client
 * can compute the focused time as `now - startTime`.
 */
export const shiftStartTimeByClosedPauses = (session: FocusSession): FocusSession => {
  const pausedTime = session.pauses.reduce(
    (total, pause) => (pause.endTime === null ? total : total + (pause.endTime - pause.startTime)),
    0,
  );

  return { ...session, startTime: session.startTime + pausedTime };
};

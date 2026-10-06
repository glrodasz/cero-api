import type { Context } from "../context.ts";

type StartFocusSessionInput = { tasks?: string[] | null; startTime?: number | null };

// GraphQL lets a client send null for an optional argument. For these
// arguments null means the same as leaving them out: use the default.

export const focusSessionResolvers = {
  Query: {
    focusSessions: (_parent: unknown, _args: unknown, { focusSessions }: Context) => focusSessions.list(),
    currentFocusSession: (_parent: unknown, _args: unknown, { focusSessions }: Context) => focusSessions.getCurrent(),
  },
  Mutation: {
    startFocusSession: (_parent: unknown, { input }: { input?: StartFocusSessionInput | null }, { focusSessions }: Context) =>
      focusSessions.start({ taskIds: input?.tasks ?? undefined, startTime: input?.startTime ?? undefined }),
    finishFocusSession: (_parent: unknown, { id }: { id: string }, { focusSessions }: Context) => focusSessions.finish(id),
    finishCurrentFocusSession: (_parent: unknown, _args: unknown, { focusSessions }: Context) => focusSessions.finishCurrent(),
    pauseFocusSession: (_parent: unknown, { id }: { id: string }, { focusSessions }: Context) => focusSessions.pause(id),
    pauseCurrentFocusSession: (_parent: unknown, { time }: { time?: number | null }, { focusSessions }: Context) =>
      focusSessions.pauseCurrent({ time: time ?? undefined }),
    resumeFocusSession: (_parent: unknown, { id }: { id: string }, { focusSessions }: Context) => focusSessions.resume(id),
    resumeCurrentFocusSession: (_parent: unknown, _args: unknown, { focusSessions }: Context) => focusSessions.resumeCurrent(),
  },
};

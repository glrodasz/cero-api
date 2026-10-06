/** Tells the current time in epoch milliseconds. Injected so tests can control time. */
export type Clock = () => number;

export const systemClock: Clock = () => Date.now();

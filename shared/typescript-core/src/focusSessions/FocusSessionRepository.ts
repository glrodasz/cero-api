import type { FocusSession, NewFocusSession } from "./FocusSession.ts";

/**
 * The storage port for focus sessions. Pauses are stored inside their session.
 *
 * Contract every adapter honours:
 * - a malformed id is simply "not found", it never throws;
 * - `findAll` lists sessions oldest first.
 */
export interface FocusSessionRepository {
  findAll(): Promise<FocusSession[]>;
  findById(id: string): Promise<FocusSession | null>;
  /** The newest session that is active or paused. */
  findCurrent(): Promise<FocusSession | null>;
  /** Storage assigns the id. */
  create(session: NewFocusSession): Promise<FocusSession>;
  /** Overwrites the stored session with the same id. */
  save(session: FocusSession): Promise<void>;
}

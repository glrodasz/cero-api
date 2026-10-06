// The API as the scenarios see it, independent of REST or GraphQL.
// These types restate ../../../api-contract.md; they deliberately do not
// import any implementation.

export type TaskStatus = "in-progress" | "pending" | "completed";

export type Task = {
  id: string;
  description: string;
  priority: number;
  status: TaskStatus;
  focusSessionId: string | null;
};

export type TaskChanges = Partial<Omit<Task, "id">>;

export type Pause = {
  id: string;
  startTime: number;
  endTime: number | null;
  time: number;
};

export type FocusSession = {
  id: string;
  status: "active" | "paused" | "finished";
  startTime: number;
  tasks: string[];
  pauses: Pause[];
};

/** A refusal the contract defines: REST 404 / 400, GraphQL NOT_FOUND / BAD_USER_INPUT. */
export class ApiError extends Error {
  kind: "not_found" | "invalid";

  constructor(kind: "not_found" | "invalid", message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface ApiClient {
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task>;
  createTask(description: string): Promise<Task>;
  completeTask(id: string): Promise<Task>;
  resetTask(id: string): Promise<Task>;
  changeTaskStatus(id: string, status: TaskStatus): Promise<Task>;
  updateTask(id: string, changes: TaskChanges): Promise<Task>;
  deleteTask(id: string): Promise<Task>;

  listFocusSessions(): Promise<FocusSession[]>;
  getCurrentFocusSession(): Promise<FocusSession | null>;
  startFocusSession(input?: { tasks?: string[]; startTime?: number }): Promise<FocusSession>;
  finishFocusSession(id: string): Promise<FocusSession>;
  finishCurrentFocusSession(): Promise<FocusSession>;
  pauseFocusSession(id: string): Promise<FocusSession>;
  pauseCurrentFocusSession(time?: number): Promise<FocusSession>;
  resumeFocusSession(id: string): Promise<FocusSession>;
  resumeCurrentFocusSession(): Promise<FocusSession>;
}

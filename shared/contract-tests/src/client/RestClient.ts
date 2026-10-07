import { ApiError, type ApiClient, type FocusSession, type Task, type TaskChanges, type TaskStatus } from "./ApiClient.ts";

export type RestResponse = { status: number; body: unknown };

/** Sends a request and returns the raw outcome, whatever the status. */
export const sendRequest = async (baseUrl: string, method: string, path: string, body?: unknown): Promise<RestResponse> => {
  // Appended, not resolved: base URLs may carry a path (e.g. a Cloud Function's /demo-cero/us-central1/api).
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? undefined : JSON.parse(text) };
};

export class RestClient implements ApiClient {
  #baseUrl: string;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl;
  }

  listTasks = () => this.#call<Task[]>("GET", "/tasks");
  getTask = (id: string) => this.#call<Task>("GET", `/tasks/${id}`);
  createTask = (description: string) => this.#call<Task>("POST", "/tasks", { description });
  completeTask = (id: string) => this.#call<Task>("PATCH", `/tasks/${id}/complete`);
  resetTask = (id: string) => this.#call<Task>("PATCH", `/tasks/${id}/reset`);
  changeTaskStatus = (id: string, status: TaskStatus) => this.#call<Task>("PATCH", `/tasks/${id}/${status}`);
  updateTask = (id: string, changes: TaskChanges) => this.#call<Task>("PATCH", `/tasks/${id}`, changes);
  deleteTask = (id: string) => this.#call<Task>("DELETE", `/tasks/${id}`);

  listFocusSessions = () => this.#call<FocusSession[]>("GET", "/focus-sessions");
  startFocusSession = (input: { tasks?: string[]; startTime?: number } = {}) =>
    this.#call<FocusSession>("POST", "/focus-sessions", input);
  finishFocusSession = (id: string) => this.#call<FocusSession>("PATCH", `/focus-sessions/${id}/finish`);
  finishCurrentFocusSession = () => this.#call<FocusSession>("PATCH", "/focus-sessions/finish");
  pauseFocusSession = (id: string) => this.#call<FocusSession>("PATCH", `/focus-sessions/${id}/pause`);
  pauseCurrentFocusSession = (time?: number) =>
    this.#call<FocusSession>("PATCH", "/focus-sessions/pause", time === undefined ? undefined : { time });
  resumeFocusSession = (id: string) => this.#call<FocusSession>("PATCH", `/focus-sessions/${id}/resume`);
  resumeCurrentFocusSession = () => this.#call<FocusSession>("PATCH", "/focus-sessions/resume");

  async getCurrentFocusSession(): Promise<FocusSession | null> {
    // The contract answers {} when no session is current.
    const session = await this.#call<Partial<FocusSession>>("GET", "/focus-sessions/active");
    return session.id === undefined ? null : (session as FocusSession);
  }

  async #call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const { status, body: responseBody } = await sendRequest(this.#baseUrl, method, path, body);
    const message = (responseBody as { message?: string } | undefined)?.message ?? `HTTP ${status}`;

    if (status === 404) throw new ApiError("not_found", message);
    if (status === 400) throw new ApiError("invalid", message);
    if (status >= 300) throw new Error(`${method} ${path} answered ${status}: ${message}`);
    return responseBody as T;
  }
}

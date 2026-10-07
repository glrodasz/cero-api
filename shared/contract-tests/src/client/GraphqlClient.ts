import { ApiError, type ApiClient, type FocusSession, type Task, type TaskChanges, type TaskStatus } from "./ApiClient.ts";

const TASK_FIELDS = "id description priority status focusSessionId";
const SESSION_FIELDS = "id status startTime tasks pauses { id startTime endTime time }";

// GraphQL enums are SCREAMING_CASE; the API speaks kebab-case.
const toGraphqlStatus = (status: string) => status.toUpperCase().replaceAll("-", "_");
const fromGraphqlStatus = (status: string) => status.toLowerCase().replaceAll("_", "-");

type GraphqlTask = Omit<Task, "status"> & { status: string };
type GraphqlSession = Omit<FocusSession, "status"> & { status: string };

const toTask = (task: GraphqlTask): Task => ({ ...task, status: fromGraphqlStatus(task.status) as TaskStatus });
const toSession = (session: GraphqlSession): FocusSession => ({
  ...session,
  status: fromGraphqlStatus(session.status) as FocusSession["status"],
});

export type GraphqlResponse = {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions?: { code?: string } }[];
};

export const sendGraphql = async (url: string, query: string, variables: Record<string, unknown> = {}): Promise<GraphqlResponse> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return (await response.json()) as GraphqlResponse;
};

export class GraphqlClient implements ApiClient {
  #url: string;

  constructor(url: string) {
    this.#url = url;
  }

  listTasks = async () => (await this.#field<GraphqlTask[]>(`query { tasks { ${TASK_FIELDS} } }`, "tasks")).map(toTask);

  async getTask(id: string): Promise<Task> {
    const task = await this.#field<GraphqlTask | null>(`query ($id: ID!) { task(id: $id) { ${TASK_FIELDS} } }`, "task", { id });
    if (task === null) throw new ApiError("not_found", "Task not found");
    return toTask(task);
  }

  createTask = (description: string) =>
    this.#taskMutation(`mutation ($input: CreateTaskInput!) { createTask(input: $input) { ${TASK_FIELDS} } }`, "createTask", {
      input: { description },
    });
  completeTask = (id: string) => this.#taskMutation(`mutation ($id: ID!) { completeTask(id: $id) { ${TASK_FIELDS} } }`, "completeTask", { id });
  resetTask = (id: string) => this.#taskMutation(`mutation ($id: ID!) { resetTask(id: $id) { ${TASK_FIELDS} } }`, "resetTask", { id });
  changeTaskStatus = (id: string, status: TaskStatus) =>
    this.#taskMutation(
      `mutation ($id: ID!, $status: TaskStatus!) { changeTaskStatus(id: $id, status: $status) { ${TASK_FIELDS} } }`,
      "changeTaskStatus",
      { id, status: toGraphqlStatus(status) },
    );
  updateTask = (id: string, { status, ...changes }: TaskChanges) =>
    this.#taskMutation(
      `mutation ($id: ID!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { ${TASK_FIELDS} } }`,
      "updateTask",
      { id, input: status === undefined ? changes : { ...changes, status: toGraphqlStatus(status) } },
    );
  deleteTask = (id: string) => this.#taskMutation(`mutation ($id: ID!) { deleteTask(id: $id) { ${TASK_FIELDS} } }`, "deleteTask", { id });

  listFocusSessions = async () =>
    (await this.#field<GraphqlSession[]>(`query { focusSessions { ${SESSION_FIELDS} } }`, "focusSessions")).map(toSession);

  async getCurrentFocusSession(): Promise<FocusSession | null> {
    const session = await this.#field<GraphqlSession | null>(`query { currentFocusSession { ${SESSION_FIELDS} } }`, "currentFocusSession");
    return session && toSession(session);
  }

  startFocusSession = (input: { tasks?: string[]; startTime?: number } = {}) =>
    this.#sessionMutation(
      `mutation ($input: StartFocusSessionInput) { startFocusSession(input: $input) { ${SESSION_FIELDS} } }`,
      "startFocusSession",
      { input },
    );
  finishFocusSession = (id: string) =>
    this.#sessionMutation(`mutation ($id: ID!) { finishFocusSession(id: $id) { ${SESSION_FIELDS} } }`, "finishFocusSession", { id });
  finishCurrentFocusSession = () =>
    this.#sessionMutation(`mutation { finishCurrentFocusSession { ${SESSION_FIELDS} } }`, "finishCurrentFocusSession");
  pauseFocusSession = (id: string) =>
    this.#sessionMutation(`mutation ($id: ID!) { pauseFocusSession(id: $id) { ${SESSION_FIELDS} } }`, "pauseFocusSession", { id });
  pauseCurrentFocusSession = (time?: number) =>
    this.#sessionMutation(
      `mutation ($time: Millis) { pauseCurrentFocusSession(time: $time) { ${SESSION_FIELDS} } }`,
      "pauseCurrentFocusSession",
      time === undefined ? {} : { time },
    );
  resumeFocusSession = (id: string) =>
    this.#sessionMutation(`mutation ($id: ID!) { resumeFocusSession(id: $id) { ${SESSION_FIELDS} } }`, "resumeFocusSession", { id });
  resumeCurrentFocusSession = () =>
    this.#sessionMutation(`mutation { resumeCurrentFocusSession { ${SESSION_FIELDS} } }`, "resumeCurrentFocusSession");

  #taskMutation = async (query: string, field: string, variables: Record<string, unknown>) =>
    toTask(await this.#field<GraphqlTask>(query, field, variables));

  #sessionMutation = async (query: string, field: string, variables: Record<string, unknown> = {}) =>
    toSession(await this.#field<GraphqlSession>(query, field, variables));

  async #field<T>(query: string, field: string, variables: Record<string, unknown> = {}): Promise<T> {
    const { data, errors } = await sendGraphql(this.#url, query, variables);
    const [error] = errors ?? [];
    if (error !== undefined) {
      if (error.extensions?.code === "NOT_FOUND") throw new ApiError("not_found", error.message);
      if (error.extensions?.code === "BAD_USER_INPUT") throw new ApiError("invalid", error.message);
      throw new Error(`GraphQL error (${error.extensions?.code ?? "no code"}): ${error.message}`);
    }
    return data?.[field] as T;
  }
}

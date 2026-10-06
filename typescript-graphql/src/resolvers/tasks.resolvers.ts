import { NotFoundError, ValidationError, type TaskChanges, type TaskStatus } from "@cero/core";
import type { Context } from "../context.ts";

type UpdateTaskInput = {
  [Field in keyof TaskChanges]?: TaskChanges[Field] | null;
};

const NON_NULLABLE_CHANGES = ["description", "priority", "status"] as const;

/**
 * GraphQL cannot declare an input field that may be omitted but not be null,
 * so this check does. Absent fields stay absent ("unchanged"); a null
 * `focusSessionId` is meaningful: it detaches the task from its session.
 */
const toTaskChanges = (input: UpdateTaskInput): TaskChanges => {
  const nullField = NON_NULLABLE_CHANGES.find((field) => input[field] === null);
  if (nullField !== undefined) {
    throw new ValidationError(`${nullField} cannot be null`);
  }
  return input as TaskChanges;
};

/** The schema answers null for an unknown task instead of an error. */
const nullIfNotFound = (error: unknown): null => {
  if (error instanceof NotFoundError) {
    return null;
  }
  throw error;
};

export const taskResolvers = {
  Query: {
    tasks: (_parent: unknown, _args: unknown, { tasks }: Context) => tasks.list(),
    task: (_parent: unknown, { id }: { id: string }, { tasks }: Context) => tasks.get(id).catch(nullIfNotFound),
  },
  Mutation: {
    createTask: (_parent: unknown, { input }: { input: { description: string } }, { tasks }: Context) => tasks.create(input),
    updateTask: (_parent: unknown, { id, input }: { id: string; input: UpdateTaskInput }, { tasks }: Context) =>
      tasks.update(id, toTaskChanges(input)),
    changeTaskStatus: (_parent: unknown, { id, status }: { id: string; status: TaskStatus }, { tasks }: Context) =>
      tasks.changeStatus(id, status),
    completeTask: (_parent: unknown, { id }: { id: string }, { tasks }: Context) => tasks.complete(id),
    resetTask: (_parent: unknown, { id }: { id: string }, { tasks }: Context) => tasks.reset(id),
    deleteTask: (_parent: unknown, { id }: { id: string }, { tasks }: Context) => tasks.delete(id),
  },
};

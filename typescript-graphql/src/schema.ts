import { typeDefs } from "@cero/graphql-schema";
import { createSchema } from "graphql-yoga";
import type { Context } from "./context.ts";
import { FocusSessionStatusEnum, TaskStatusEnum } from "./resolvers/enums.ts";
import { focusSessionResolvers } from "./resolvers/focusSessions.resolvers.ts";
import { Millis } from "./resolvers/millis.ts";
import { taskResolvers } from "./resolvers/tasks.resolvers.ts";

/**
 * Schema-first: the types come from the shared SDL, which every GraphQL
 * implementation serves; this file only attaches the resolvers to it.
 */
export const schema = createSchema<Context>({
  typeDefs,
  resolvers: [
    { Millis, TaskStatus: TaskStatusEnum, FocusSessionStatus: FocusSessionStatusEnum },
    taskResolvers,
    focusSessionResolvers,
  ],
});

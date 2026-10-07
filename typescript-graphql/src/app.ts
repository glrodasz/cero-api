import type { Services } from "@cero/core";
import { createYoga } from "graphql-yoga";
import { maskedErrors, useCoreErrorCodes } from "./errors.ts";
import { useRouteNotFound } from "./http/routeNotFound.ts";
import { schema } from "./schema.ts";

const GRAPHQL_ENDPOINT = "/graphql";

/**
 * Builds the Yoga server around the use cases. It is a plain request handler
 * (Fetch API inside, Node's `http` outside), so `main.ts` mounts it on
 * `node:http` and the tests call `yoga.fetch` without opening a port.
 */
export const createApp = (services: Services) =>
  createYoga({
    schema,
    // Merged into every request's context, where the resolvers find the use cases.
    context: services,
    graphqlEndpoint: GRAPHQL_ENDPOINT,
    maskedErrors,
    plugins: [useRouteNotFound(GRAPHQL_ENDPOINT), useCoreErrorCodes()],
  });

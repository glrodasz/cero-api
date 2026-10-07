import { MESSAGES, NotFoundError, ValidationError } from "@cero/core";
import type { GraphQLError } from "graphql";
import { createGraphQLError, handleStreamOrSingleExecutionResult, type Plugin } from "graphql-yoga";

/** The GraphQL counterpart of REST's 404 and 400, as the shared schema documents. */
const codeOf = (error: unknown): "NOT_FOUND" | "BAD_USER_INPUT" | undefined => {
  if (error instanceof NotFoundError) return "NOT_FOUND";
  if (error instanceof ValidationError) return "BAD_USER_INPUT";
  return undefined;
};

const withCode = (error: GraphQLError): GraphQLError => {
  const code = codeOf(error.originalError);
  if (code === undefined) {
    return error;
  }

  return createGraphQLError(error.message, {
    nodes: error.nodes,
    source: error.source,
    positions: error.positions,
    path: error.path,
    extensions: { code },
  });
};

/**
 * Core errors are expected refusals: they keep their message and gain an
 * `extensions.code`. This plugin runs before Yoga's error masking, which lets
 * GraphQL errors through untouched (and unlogged) and masks everything else.
 */
export const useCoreErrorCodes = (): Plugin => ({
  onExecute: () => ({
    onExecuteDone: (payload) =>
      handleStreamOrSingleExecutionResult(payload, ({ result, setResult }) => {
        if (result.errors !== undefined) {
          setResult({ ...result, errors: result.errors.map(withCode) });
        }
      }),
  }),
});

/** Anything unexpected reaches the client as "Internal server error", without details. */
export const maskedErrors = { errorMessage: MESSAGES.INTERNAL_ERROR };

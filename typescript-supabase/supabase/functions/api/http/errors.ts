import { MESSAGES, NotFoundError, ValidationError } from "@cero/core";
import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const handleRouteNotFound: NotFoundHandler = (c) => c.json({ message: MESSAGES.ROUTE_NOT_FOUND }, 404);

/**
 * Hono catches whatever a handler or middleware throws and hands it here, so
 * routes need no try/catch. Core errors become 404/400, Hono's own
 * HTTPExceptions (a malformed JSON body) keep their status, anything else is
 * a 500 that does not leak internals.
 */
export const handleError: ErrorHandler = (error, c) => {
  if (error instanceof NotFoundError) {
    return c.json({ message: error.message }, 404);
  }
  if (error instanceof ValidationError) {
    return c.json({ message: error.message }, 400);
  }
  if (error instanceof HTTPException) {
    return c.json({ message: error.message }, error.status);
  }

  console.error(error);
  return c.json({ message: MESSAGES.INTERNAL_ERROR }, 500);
};
